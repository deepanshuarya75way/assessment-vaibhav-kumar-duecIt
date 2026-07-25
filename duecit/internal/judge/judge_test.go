package judge

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/models"
)

func TestEvaluateClassifiesPistonResponses(t *testing.T) {
	tests := []struct {
		name     string
		response pistonResponse
		want     string
		passed   bool
	}{
		{
			name: "accepted",
			response: pistonResponse{
				Run: pistonRun{Stdout: "42\n", Code: 0},
			},
			want:   VerdictAccepted,
			passed: true,
		},
		{
			name: "wrong answer",
			response: pistonResponse{
				Run: pistonRun{Stdout: "41\n", Code: 0},
			},
			want:   VerdictWrongAnswer,
			passed: false,
		},
		{
			name: "compilation error",
			response: pistonResponse{
				Compile: &pistonRun{Stderr: "missing semicolon", Code: 1},
				Run:     pistonRun{Code: 0},
			},
			want:   VerdictCompilationError,
			passed: false,
		},
		{
			name: "runtime error",
			response: pistonResponse{
				Run: pistonRun{Stderr: "panic: divide by zero", Code: 2},
			},
			want:   VerdictRuntimeError,
			passed: false,
		},
		{
			name: "time limit exceeded",
			response: pistonResponse{
				Run: pistonRun{Stderr: "execution timed out", Code: 124},
			},
			want:   VerdictTimeLimitExceeded,
			passed: false,
		},
		{
			name: "interpreted syntax error",
			response: pistonResponse{
				Run: pistonRun{Stderr: "SyntaxError: invalid syntax", Code: 1},
			},
			want:   VerdictCompilationError,
			passed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := newTestService(t, func(r *http.Request) pistonResponse {
				if r.URL.Path != "/execute" {
					t.Fatalf("unexpected path %s", r.URL.Path)
				}
				return tt.response
			})

			result, err := svc.Evaluate(context.Background(), "print(42)", "python", []models.TestCase{{
				Input:          "",
				ExpectedOutput: "42",
				Weight:         1,
			}})
			if err != nil {
				t.Fatalf("Evaluate returned error: %v", err)
			}
			if result.Verdict != tt.want {
				t.Fatalf("overall verdict = %s, want %s", result.Verdict, tt.want)
			}
			if len(result.TestResults) != 1 {
				t.Fatalf("test results = %d, want 1", len(result.TestResults))
			}
			gotCase := result.TestResults[0]
			if gotCase.Verdict != tt.want {
				t.Fatalf("case verdict = %s, want %s", gotCase.Verdict, tt.want)
			}
			if gotCase.Passed != tt.passed {
				t.Fatalf("passed = %v, want %v", gotCase.Passed, tt.passed)
			}
			if gotCase.Input != "" || gotCase.ExpectedOutput != "42" {
				t.Fatalf("test case context was not preserved: %#v", gotCase)
			}
		})
	}
}

func TestEvaluateUnsupportedLanguage(t *testing.T) {
	svc := &Service{cfg: &config.Config{PistonURL: "http://127.0.0.1:1"}, client: http.DefaultClient}
	_, err := svc.Evaluate(context.Background(), "", "ruby", []models.TestCase{{ExpectedOutput: "x"}})
	if err == nil || !strings.Contains(err.Error(), VerdictUnsupportedLanguage) {
		t.Fatalf("unsupported language error = %v, want %s", err, VerdictUnsupportedLanguage)
	}
}

func TestEvaluateUsesJavaSourceFilename(t *testing.T) {
	svc := newTestService(t, func(r *http.Request) pistonResponse {
		var req pistonRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(req.Files) != 1 || req.Files[0].Name != "Main.java" {
			t.Fatalf("source file = %#v, want Main.java", req.Files)
		}
		return pistonResponse{Run: pistonRun{Stdout: "ok\n"}}
	})

	result, err := svc.Evaluate(context.Background(), "class Main {}", "java", []models.TestCase{{ExpectedOutput: "ok"}})
	if err != nil {
		t.Fatalf("Evaluate returned error: %v", err)
	}
	if result.Verdict != VerdictAccepted {
		t.Fatalf("verdict = %s, want %s", result.Verdict, VerdictAccepted)
	}
}

func TestBuildExecutableKeepsJavaMainBeforeSolution(t *testing.T) {
	driver := `import java.util.*;

##SOLUTION##

public class Main {
    public static void main(String[] args) {
        System.out.println(Solution.missingNumber(new int[]{3, 0, 1}));
    }
}
`
	code := `class Solution {
    public static int missingNumber(int[] nums) {
        return 2;
    }
}`

	execCode := BuildExecutable(code, "java", map[string]string{"java": driver}, nil, models.FuncSignature{})
	mainIdx := strings.Index(execCode, "public class Main")
	solutionIdx := strings.Index(execCode, "class Solution")
	if mainIdx < 0 || solutionIdx < 0 {
		t.Fatalf("generated code missing Main or Solution:\n%s", execCode)
	}
	if mainIdx > solutionIdx {
		t.Fatalf("Main must appear before Solution so Piston runs Main:\n%s", execCode)
	}
	if strings.Contains(execCode, SolutionPlaceholder) {
		t.Fatalf("placeholder was not removed:\n%s", execCode)
	}
}

func TestBuildExecutableUsesCppHiddenDriver(t *testing.T) {
	driver := `#include <bits/stdc++.h>
using namespace std;

##SOLUTION##

int main() {
    vector<int> nums{3, 0, 1};
    cout << missingNumber(nums) << endl;
    return 0;
}
`
	code := `int missingNumber(const vector<int>& nums) {
    return 2;
}`

	execCode := BuildExecutable(code, "cpp", map[string]string{"cpp": driver}, nil, models.FuncSignature{})
	for _, want := range []string{"#include <bits/stdc++.h>", "int main()", "int missingNumber"} {
		if !strings.Contains(execCode, want) {
			t.Fatalf("generated C++ driver missing %q:\n%s", want, execCode)
		}
	}
}

func TestWrapPracticeCodeSupportsCArrayReturn(t *testing.T) {
	code := `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* ans = malloc(sizeof(int) * 2);
    ans[0] = 0;
    ans[1] = 1;
    return ans;
}`
	spec := []models.InputVar{
		{Name: "n", Type: models.TypeInt},
		{Name: "nums", Type: models.TypeIntArr, LengthVar: "n"},
		{Name: "target", Type: models.TypeInt},
	}
	sig := models.FuncSignature{
		FuncName:   "twoSum",
		Params:     []string{"nums", "target"},
		ReturnType: models.TypeIntArr,
	}

	execCode := WrapPracticeCode(code, "c", spec, sig)
	for _, want := range []string{
		"#include <stdbool.h>",
		"int returnSize = 0;",
		"twoSum(nums, n, target, &returnSize)",
		"for (int i = 0; i < returnSize; i++)",
	} {
		if !strings.Contains(execCode, want) {
			t.Fatalf("generated C wrapper missing %q:\n%s", want, execCode)
		}
	}
}

func newTestService(t *testing.T, handler func(*http.Request) pistonResponse) *Service {
	t.Helper()
	svc := NewService(&config.Config{PistonURL: "http://piston.test"})
	svc.client = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		var body bytes.Buffer
		if err := json.NewEncoder(&body).Encode(handler(req)); err != nil {
			t.Fatalf("encode response: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(&body),
			Request:    req,
		}, nil
	})}
	return svc
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
