package problems

import "github.com/duecit/duecit/internal/models"

// BulkProblem is one entry in a bulk-import payload: a full Problem plus
// its test cases in a single object, so an admin can author everything for
// one problem (statement, driver code, samples, hidden tests) in one JSON
// file instead of N round-trips through the "Create Problem" + "Add Test
// Case" modals.
//
// models.Problem is embedded anonymously, so its JSON fields (title,
// statement, driverCode, signature, inputSpec, etc.) are promoted to the
// top level of this struct - a bulk file looks like a normal Problem
// object with one extra "testCases" key, not a nested wrapper.
type BulkProblem struct {
	models.Problem
	TestCases []models.TestCase `json:"testCases"`
}

// BulkImportResult reports what happened for one problem in a bulk
// import, so a single bad entry (duplicate ID, missing field) doesn't
// silently block the rest of the file, and the admin can see exactly
// which problems landed vs. which need fixing.
type BulkImportResult struct {
	ProblemID      string `json:"problemId"`
	Title          string `json:"title"`
	Status         string `json:"status"` // "created" | "error"
	Error          string `json:"error,omitempty"`
	TestCasesAdded int    `json:"testCasesAdded"`
	TestCasesTotal int    `json:"testCasesTotal"`
}