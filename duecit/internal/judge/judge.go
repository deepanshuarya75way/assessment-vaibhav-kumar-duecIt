package judge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
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

const (
	VerdictAccepted            = "AC"
	VerdictWrongAnswer         = "WA"
	VerdictCompilationError    = "CE"
	VerdictRuntimeError        = "RE"
	VerdictTimeLimitExceeded   = "TLE"
	VerdictEngineError         = "ENGINE_ERROR"
	VerdictUnsupportedLanguage = "UNSUPPORTED_LANGUAGE"
)

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
	Language       string       `json:"language"`
	Version        string       `json:"version"`
	Files          []pistonFile `json:"files"`
	Stdin          string       `json:"stdin"`
	RunTimeout     int          `json:"run_timeout"`
	CompileTimeout int          `json:"compile_timeout"`
}

type pistonFile struct {
	Name    string `json:"name,omitempty"`
	Content string `json:"content"`
}

type pistonResponse struct {
	Run     pistonRun  `json:"run"`
	Compile *pistonRun `json:"compile"`
}

type pistonRun struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Output string `json:"output"`
	Code   int    `json:"code"`
	Signal string `json:"signal"`
}

type EvalResult struct {
	PassedCount     int                 `json:"passedCount"`
	TotalCount      int                 `json:"totalCount"`
	WeightedScore   float64             `json:"weightedScore"`
	ExecutionTimeMs int64               `json:"executionTimeMs"`
	Verdict         string              `json:"verdict"`
	IsFullAC        bool                `json:"isFullAC"`
	TestResults     []models.TestResult `json:"testResults,omitempty"`
}

type OutputChecker func(tc models.TestCase, actualOutput string) bool

func (s *Service) Evaluate(ctx context.Context, code, language string, testCases []models.TestCase, checkers ...OutputChecker) (*EvalResult, error) {
	pistonLang, ok := languageMap[language]
	if !ok {
		return nil, fmt.Errorf("%s: %s", VerdictUnsupportedLanguage, language)
	}
	var checker OutputChecker
	if len(checkers) > 0 {
		checker = checkers[0]
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
			results[idx] = s.runTest(ctx, code, pistonLang, testCase, checker)
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
		Verdict:         overallVerdict(results),
		IsFullAC:        passed == len(testCases),
		TestResults:     results,
	}, nil
}

func (s *Service) runTest(ctx context.Context, code, language string, tc models.TestCase, checker OutputChecker) models.TestResult {
	start := time.Now()
	body, _ := json.Marshal(pistonRequest{
		Language:       language,
		Version:        "*",
		Files:          []pistonFile{{Name: sourceFileName(language), Content: code}},
		Stdin:          tc.Input,
		RunTimeout:     3000,
		CompileTimeout: 10000,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.PistonURL+"/execute", bytes.NewReader(body))
	if err != nil {
		return testFailure(tc, VerdictEngineError, err.Error(), 0)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.cfg.PistonAuthUser != "" && s.cfg.PistonAuthPass != "" {
		req.SetBasicAuth(s.cfg.PistonAuthUser, s.cfg.PistonAuthPass)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return testFailure(tc, classifyRequestError(err), friendlyRequestError(err), time.Since(start).Milliseconds())
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	// Piston returns a non-200 with a JSON {"message": "..."} body when the
	// request itself is rejected (bad language/version, malformed payload,
	// rate limited, etc.) - that's a different failure mode than "the
	// user's code ran and produced no output".
	//
	// CRITICAL: every early-return TestResult below must still carry
	// Input/ExpectedOutput. These fields are `json:"...,omitempty"` on
	// models.TestResult - leaving them unset means an empty string, which
	// omitempty then drops from the JSON response entirely, so the field
	// arrives as `undefined` (not even null) on the frontend. Any frontend
	// code doing tc.input.slice(...) without a guard crashes the whole
	// page on exactly this path - which is intermittent by nature (Piston
	// rate-limiting, network blips), making it look like a random crash
	// instead of the systematic omission it actually is.
	if resp.StatusCode != http.StatusOK {
		var perr struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(raw, &perr)
		msg := perr.Message
		if msg == "" {
			msg = fmt.Sprintf("piston returned HTTP %d", resp.StatusCode)
		}
		return models.TestResult{
			Passed:         false,
			Verdict:        VerdictEngineError,
			Input:          tc.Input,
			ExpectedOutput: tc.ExpectedOutput,
			Error:          "execution engine error: " + msg,
			ExecutionTime:  time.Since(start).Milliseconds(),
		}
	}

	var pr pistonResponse
	if err := json.Unmarshal(raw, &pr); err != nil {
		return testFailure(tc, VerdictEngineError, "could not parse execution engine response: "+err.Error(), time.Since(start).Milliseconds())
	}

	stdout := strings.TrimSpace(pr.Run.Stdout)
	if stdout == "" {
		stdout = strings.TrimSpace(pr.Run.Output)
	}

	if pr.Compile != nil && (pr.Compile.Code != 0 || pr.Compile.Signal != "") {
		return models.TestResult{
			Passed:         false,
			Verdict:        VerdictCompilationError,
			Input:          tc.Input,
			ExpectedOutput: tc.ExpectedOutput,
			ActualOutput:   stdout,
			ExecutionTime:  time.Since(start).Milliseconds(),
			Error:          cleanError(firstNonEmpty(pr.Compile.Stderr, pr.Compile.Output, "compilation failed")),
		}
	}

	if isTimeoutRun(pr.Run) {
		return models.TestResult{
			Passed:         false,
			Verdict:        VerdictTimeLimitExceeded,
			Input:          tc.Input,
			ExpectedOutput: tc.ExpectedOutput,
			ActualOutput:   stdout,
			ExecutionTime:  time.Since(start).Milliseconds(),
			Error:          "time limit exceeded",
		}
	}

	if pr.Run.Code != 0 || pr.Run.Signal != "" {
		verdict := VerdictRuntimeError
		if isInterpretedSyntaxError(language, pr.Run) {
			verdict = VerdictCompilationError
		}
		return models.TestResult{
			Passed:         false,
			Verdict:        verdict,
			Input:          tc.Input,
			ExpectedOutput: tc.ExpectedOutput,
			ActualOutput:   stdout,
			ExecutionTime:  time.Since(start).Milliseconds(),
			Error:          cleanError(firstNonEmpty(pr.Run.Stderr, pr.Run.Output, fmt.Sprintf("process exited with code %d", pr.Run.Code))),
		}
	}

	passed := outputMatches(tc, stdout, checker)
	verdict := VerdictWrongAnswer
	if passed {
		verdict = VerdictAccepted
	}

	return models.TestResult{
		Passed:         passed,
		Verdict:        verdict,
		Input:          tc.Input,
		ExpectedOutput: tc.ExpectedOutput,
		ActualOutput:   stdout,
		ExecutionTime:  time.Since(start).Milliseconds(),
		Error:          cleanError(pr.Run.Stderr),
	}
}

func testFailure(tc models.TestCase, verdict, message string, executionMs int64) models.TestResult {
	return models.TestResult{
		Passed:         false,
		Verdict:        verdict,
		Input:          tc.Input,
		ExpectedOutput: tc.ExpectedOutput,
		Error:          message,
		ExecutionTime:  executionMs,
	}
}

func sourceFileName(language string) string {
	switch language {
	case "python":
		return "main.py"
	case "javascript":
		return "main.js"
	case "cpp":
		return "main.cpp"
	case "java":
		return "Main.java"
	case "c":
		return "main.c"
	case "go":
		return "main.go"
	default:
		return "main.txt"
	}
}

func classifyRequestError(err error) string {
	if isDeadlineError(err) {
		return VerdictTimeLimitExceeded
	}
	return VerdictEngineError
}

func friendlyRequestError(err error) string {
	if isDeadlineError(err) {
		return "execution timed out"
	}
	return "execution engine request failed: " + err.Error()
}

func isDeadlineError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

func isTimeoutRun(run pistonRun) bool {
	text := strings.ToLower(firstNonEmpty(run.Stderr, run.Output, run.Signal))
	if strings.Contains(text, "time limit") || strings.Contains(text, "timed out") || strings.Contains(text, "timeout") {
		return true
	}
	return run.Signal == "SIGKILL" || run.Signal == "SIGTERM"
}

func isInterpretedSyntaxError(language string, run pistonRun) bool {
	if language != "python" && language != "javascript" {
		return false
	}
	text := strings.ToLower(firstNonEmpty(run.Stderr, run.Output))
	return strings.Contains(text, "syntaxerror") || strings.Contains(text, "indentationerror") || strings.Contains(text, "taberror")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func cleanError(s string) string {
	return strings.TrimSpace(s)
}

func overallVerdict(results []models.TestResult) string {
	if len(results) == 0 {
		return VerdictWrongAnswer
	}
	for _, r := range results {
		if r.Verdict == VerdictCompilationError {
			return VerdictCompilationError
		}
	}
	for _, r := range results {
		if r.Verdict == VerdictTimeLimitExceeded {
			return VerdictTimeLimitExceeded
		}
	}
	for _, r := range results {
		if r.Verdict == VerdictRuntimeError {
			return VerdictRuntimeError
		}
	}
	for _, r := range results {
		if r.Verdict == VerdictEngineError {
			return VerdictEngineError
		}
	}
	for _, r := range results {
		if !r.Passed {
			return VerdictWrongAnswer
		}
	}
	return VerdictAccepted
}

func outputMatches(tc models.TestCase, actual string, checker OutputChecker) bool {
	if normalizeOutput(actual) == normalizeOutput(tc.ExpectedOutput) {
		return true
	}
	if checker == nil {
		return false
	}
	return checker(tc, actual)
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
