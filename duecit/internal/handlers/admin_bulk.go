package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/duecit/duecit/internal/judge"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"github.com/duecit/duecit/pkg/response"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// fillDefaultStarterCode fills in any missing starter-code languages on a
// Problem before it's saved: competitive-mode syntax boilerplate for every
// language, plus the practice-mode function stub if a signature is
// declared. Never overwrites anything the caller already supplied.
//
// Extracted from AdminCreateProblem so AdminCreateProblem and
// AdminBulkImportProblems can never drift apart on this behavior.
func fillDefaultStarterCode(p *models.Problem) {
	if p.StarterCode == nil {
		p.StarterCode = map[string]string{}
	}
	for lang, tmpl := range judge.AllCompetitiveTemplates() {
		if _, exists := p.StarterCode[lang]; !exists {
			p.StarterCode[lang] = tmpl
		}
	}
	if p.Signature.FuncName != "" {
		for lang, code := range judge.GenerateAllStarterCode(p.InputSpec, p.Signature) {
			if _, exists := p.StarterCode[lang]; !exists {
				p.StarterCode[lang] = code
			}
		}
	}
}

// AdminBulkImportProblems accepts a JSON array of problems.BulkProblem (a
// Problem plus its testCases) and creates them all in one request, reusing
// the exact same Problems.CreateProblem / Problems.AddTestCase calls the
// single-problem form uses - no separate validation path, no drift.
//
// Per-entry errors (duplicate problemId, bad data) don't abort the whole
// import; each entry gets its own result so the admin can see exactly
// what landed and what needs fixing, then re-submit just the failed ones.
func (h *Handlers) AdminBulkImportProblems(w http.ResponseWriter, r *http.Request) {
	var entries []problems.BulkProblem
	if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request: expected a JSON array of problems: "+err.Error())
		return
	}
	if len(entries) == 0 {
		response.Error(w, http.StatusBadRequest, "No problems provided")
		return
	}

	results := make([]problems.BulkImportResult, 0, len(entries))

	for _, entry := range entries {
		p := entry.Problem
		res := problems.BulkImportResult{
			ProblemID:      p.ProblemID,
			Title:          p.Title,
			TestCasesTotal: len(entry.TestCases),
		}

		if p.ProblemID == "" {
			p.ProblemID = "P" + strings.ToUpper(primitive.NewObjectID().Hex()[:6])
			res.ProblemID = p.ProblemID
		}
		if p.Title == "" {
			res.Status = "error"
			res.Error = "title is required"
			results = append(results, res)
			continue
		}

		fillDefaultStarterCode(&p)

		created, err := h.Problems.CreateProblem(r.Context(), &p)
		if err != nil {
			res.Status = "error"
			res.Error = err.Error()
			results = append(results, res)
			continue
		}
		res.Status = "created"

		var tcErrors []string
		for i, tc := range entry.TestCases {
			tc.ProblemID = created.ProblemID
			if tc.Weight == 0 {
				tc.Weight = 10
			}
			if _, err := h.Problems.AddTestCase(r.Context(), &tc); err != nil {
				tcErrors = append(tcErrors, fmt.Sprintf("testCase[%d]: %v", i, err))
				continue
			}
			res.TestCasesAdded++
		}
		if len(tcErrors) > 0 {
			res.Error = strings.Join(tcErrors, "; ")
		}

		results = append(results, res)
	}

	response.JSON(w, http.StatusOK, "Bulk import complete", results)
}