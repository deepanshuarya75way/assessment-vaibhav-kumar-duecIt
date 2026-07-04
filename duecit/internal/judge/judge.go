package judge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/models"
)

var languageMap = map[string]string{
	"javascript": "javascript",
	"python":     "python",
	"cpp":        "cpp",
	"java":       "java",
	"c":          "c",
	"go":         "go",
}

type Service struct {
	cfg    *config.Config
	client *http.Client
}

func NewService(cfg *config.Config) *Service {
	return &Service{
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type pistonRequest struct {
	Language string       `json:"language"`
	Version  string       `json:"version"`
	Files    []pistonFile `json:"files"`
	Stdin    string       `json:"stdin"`
	RunTimeout      int `json:"run_timeout"`
	CompileTimeout  int `json:"compile_timeout"`
}

type pistonFile struct {
	Content string `json:"content"`
}

type pistonResponse struct {
	Run     pistonRun     `json:"run"`
	Compile *pistonRun    `json:"compile"`
}

type pistonRun struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Code   int    `json:"code"`
}

type EvalResult struct {
	PassedCount     int                 `json:"passedCount"`
	TotalCount      int                 `json:"totalCount"`
	WeightedScore   float64             `json:"weightedScore"`
	ExecutionTimeMs int64               `json:"executionTimeMs"`
	IsFullAC        bool                `json:"isFullAC"`
	TestResults     []models.TestResult `json:"testResults,omitempty"`
}

func (s *Service) Evaluate(ctx context.Context, code, language string, testCases []models.TestCase) (*EvalResult, error) {
	pistonLang, ok := languageMap[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	results := make([]models.TestResult, len(testCases))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)

	for i, tc := range testCases {
		wg.Add(1)
		go func(idx int, testCase models.TestCase) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			results[idx] = s.runTest(ctx, code, pistonLang, testCase)
		}(i, tc)
	}
	wg.Wait()

	passed := 0
	var totalWeight, earnedWeight float64
	var totalExec int64
	for i, r := range results {
		if r.Passed {
			passed++
		}
		w := float64(testCases[i].Weight)
		if w == 0 {
			w = 1
		}
		totalWeight += w
		if r.Passed {
			earnedWeight += w
		}
		totalExec += r.ExecutionTime
	}

	avgExec := int64(0)
	if len(results) > 0 {
		avgExec = totalExec / int64(len(results))
	}

	weightedScore := 0.0
	if totalWeight > 0 {
		weightedScore = (earnedWeight / totalWeight) * 100
	}

	return &EvalResult{
		PassedCount:     passed,
		TotalCount:      len(testCases),
		WeightedScore:   weightedScore,
		ExecutionTimeMs: avgExec,
		IsFullAC:        passed == len(testCases),
		TestResults:     results,
	}, nil
}

func (s *Service) runTest(ctx context.Context, code, language string, tc models.TestCase) models.TestResult {
	start := time.Now()
	body, _ := json.Marshal(pistonRequest{
		Language: language,
		Version:  "*",
		Files:    []pistonFile{{Content: code}},
		Stdin:    tc.Input,
		RunTimeout:     3000,
		CompileTimeout: 10000,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.PistonURL+"/execute", bytes.NewReader(body))
	if err != nil {
		return models.TestResult{Passed: false, Error: err.Error(), ExecutionTime: 0}
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return models.TestResult{Passed: false, Error: err.Error(), ExecutionTime: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var pr pistonResponse
	if err := json.Unmarshal(raw, &pr); err != nil {
		return models.TestResult{Passed: false, Error: err.Error(), ExecutionTime: time.Since(start).Milliseconds()}
	}

	stdout := strings.TrimSpace(pr.Run.Stdout)
	stderr := pr.Run.Stderr
	if pr.Compile != nil && pr.Compile.Stderr != "" {
		stderr = pr.Compile.Stderr
	}

	passed := normalizeOutput(stdout) == normalizeOutput(tc.ExpectedOutput)
	errMsg := ""
	if stderr != "" {
		errMsg = stderr
	}

	return models.TestResult{
		Passed:         passed,
		Input:          tc.Input,
		ExpectedOutput: tc.ExpectedOutput,
		ActualOutput:   stdout,
		ExecutionTime:  time.Since(start).Milliseconds(),
		Error:          errMsg,
	}
}

func normalizeOutput(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	return strings.Join(lines, "\n")
}

func SamplesToTestCases(samples []models.Sample) []models.TestCase {
	out := make([]models.TestCase, len(samples))
	for i, s := range samples {
		out[i] = models.TestCase{
			Input:          s.Input,
			ExpectedOutput: s.Output,
			Weight:         1,
			IsHidden:       false,
		}
	}
	return out
}
