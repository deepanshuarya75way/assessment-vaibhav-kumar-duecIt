package problems

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/duecit/duecit/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Service struct {
	problems  *mongo.Collection
	testCases *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	s := &Service{
		problems:  db.Collection("problems"),
		testCases: db.Collection("testcases"),
	}
	s.ensureIndexes(context.Background())
	return s
}

// ensureIndexes creates a unique index on problemId so a duplicate ID can
// never be inserted again, at the database level, regardless of which code
// path tries it (admin panel, seed script, a retried request after a
// timeout, anything).
//
// IMPORTANT: if duplicate problemIds already exist in the database from
// before this fix, MongoDB will refuse to create the unique index and this
// will log an error every startup until you run DedupeProblems (below) once
// to clean up the existing duplicates. This is intentionally non-fatal -
// logged, not returned as an error - so a dirty existing database doesn't
// prevent the server from starting; it just means the index (and therefore
// this protection) isn't active yet.
func (s *Service) ensureIndexes(ctx context.Context) {
	_, err := s.problems.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "problemId", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Printf("WARNING: could not create unique index on problems.problemId (likely duplicate problemIds already exist - run problems.DedupeProblems once to fix): %v", err)
	}
}

func (s *Service) CreateProblem(ctx context.Context, p *models.Problem) (*models.Problem, error) {
	// Explicit existence check first, so admins get a clear "already exists"
	// error message instead of a raw Mongo duplicate-key error if the
	// unique index catches it instead. Belt-and-suspenders with the index
	// above: this check has a small race window under concurrent requests,
	// the index is what actually guarantees no duplicate ever lands.
	existing, _ := s.GetProblem(ctx, p.ProblemID)
	if existing != nil {
		return nil, fmt.Errorf("a problem with ID %q already exists", p.ProblemID)
	}

	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	if p.Version == 0 {
		p.Version = 1
	}
	if p.StarterCode == nil {
		p.StarterCode = defaultStarterCode()
	}
	res, err := s.problems.InsertOne(ctx, p)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, fmt.Errorf("a problem with ID %q already exists", p.ProblemID)
		}
		return nil, err
	}
	p.ID = res.InsertedID.(primitive.ObjectID)
	return p, nil
}

func (s *Service) UpdateProblem(ctx context.Context, problemID string, update bson.M) (*models.Problem, error) {
	update["updatedAt"] = time.Now()
	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var p models.Problem
	err := s.problems.FindOneAndUpdate(ctx, bson.M{"problemId": problemID}, bson.M{"$set": update}, opts).Decode(&p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Service) DeleteProblem(ctx context.Context, problemID string) error {
	
	_, err := s.problems.DeleteMany(ctx, bson.M{"problemId": problemID})
	if err != nil {
		return err
	}
	_, _ = s.testCases.DeleteMany(ctx, bson.M{"problemId": problemID})
	return nil
}

func (s *Service) GetProblem(ctx context.Context, problemID string) (*models.Problem, error) {
	var p models.Problem
	err := s.problems.FindOne(ctx, bson.M{"problemId": problemID}).Decode(&p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Service) ListProblems(ctx context.Context, category, difficulty string) ([]models.Problem, error) {
	filter := bson.M{}
	if category != "" {
		filter["category"] = category
	}
	if difficulty != "" {
		filter["difficulty"] = difficulty
	}
	cur, err := s.problems.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var list []models.Problem
	if err := cur.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *Service) GetRandomProblem(ctx context.Context, category, difficulty string) (*models.Problem, error) {
	filter := bson.M{"category": category, "difficulty": difficulty}
	count, err := s.problems.CountDocuments(ctx, filter)
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, errors.New("no problems found")
	}
	skip := rand.Int63n(count)
	var p models.Problem
	err = s.problems.FindOne(ctx, filter, options.FindOne().SetSkip(skip)).Decode(&p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Service) AddTestCase(ctx context.Context, tc *models.TestCase) (*models.TestCase, error) {
	tc.CreatedAt = time.Now()
	res, err := s.testCases.InsertOne(ctx, tc)
	if err != nil {
		return nil, err
	}
	tc.ID = res.InsertedID.(primitive.ObjectID)
	return tc, nil
}

func (s *Service) GetTestCases(ctx context.Context, problemID string, hiddenOnly bool) ([]models.TestCase, error) {
	filter := bson.M{"problemId": problemID}
	if hiddenOnly {
		filter["isHidden"] = true
	}
	cur, err := s.testCases.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var list []models.TestCase
	if err := cur.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *Service) DeleteTestCase(ctx context.Context, id primitive.ObjectID) error {
	_, err := s.testCases.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (s *Service) CountProblems(ctx context.Context) (int64, error) {
	return s.problems.CountDocuments(ctx, bson.M{})
}

// DedupeProblems is a one-time cleanup for databases that already have
// duplicate problemIds from before this fix (which is almost certainly the
// case for this app's production database right now). For each problemId
// with more than one document, it keeps the most recently updated one and
// deletes the rest.
//
// Run this ONCE - e.g. temporarily call it from main.go after connecting to
// Mongo, redeploy, check the logs for what it removed, then remove the call.
// It's safe to run more than once (a no-op once no duplicates remain), but
// it's not something that should run on every startup - it does real
// deletes, and a startup-automatic version defeats the point of noticing
// when duplicates reappear.
func (s *Service) DedupeProblems(ctx context.Context) error {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$problemId"},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
			{Key: "docs", Value: bson.D{{Key: "$push", Value: bson.D{
				{Key: "id", Value: "$_id"},
				{Key: "updatedAt", Value: "$updatedAt"},
			}}}},
		}}},
		{{Key: "$match", Value: bson.D{{Key: "count", Value: bson.D{{Key: "$gt", Value: 1}}}}}},
	}
	cur, err := s.problems.Aggregate(ctx, pipeline)
	if err != nil {
		return err
	}
	defer cur.Close(ctx)

	type dupGroup struct {
		ID   string `bson:"_id"`
		Docs []struct {
			ID        primitive.ObjectID `bson:"id"`
			UpdatedAt time.Time          `bson:"updatedAt"`
		} `bson:"docs"`
	}

	var groups []dupGroup
	if err := cur.All(ctx, &groups); err != nil {
		return err
	}

	for _, g := range groups {
		if len(g.Docs) < 2 {
			continue
		}
		// Keep the most recently updated; delete the rest.
		keepIdx := 0
		for i, d := range g.Docs {
			if d.UpdatedAt.After(g.Docs[keepIdx].UpdatedAt) {
				keepIdx = i
			}
		}
		var toDelete []primitive.ObjectID
		for i, d := range g.Docs {
			if i != keepIdx {
				toDelete = append(toDelete, d.ID)
			}
		}
		res, err := s.problems.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": toDelete}})
		if err != nil {
			log.Printf("DedupeProblems: failed to clean up problemId %q: %v", g.ID, err)
			continue
		}
		log.Printf("DedupeProblems: problemId %q had %d duplicates, removed %d, kept the most recently updated", g.ID, len(g.Docs), res.DeletedCount)
	}
	return nil
}

func defaultStarterCode() map[string]string {
	return map[string]string{
		// --- Competitive: full stdin/stdout program ---
		"python": `# Read from stdin, write to stdout (no extra text)
# Example for n + list input:
# n = int(input())
# arr = list(map(int, input().split()))
# print(result)
`,
		"javascript": `const fs = require('fs');
const input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);
// Write your solution here — use input tokens, print only the answer
`,
		"cpp":  "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Read from cin, write to cout — no extra text\n    return 0;\n}\n",
		"java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read from sc, print only the required output\n    }\n}\n",
		"go":   "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\t_ = reader\n\t// Read from stdin, fmt.Println only the answer\n}\n",

		// --- Practice: logic-only (the wrapper adds stdin/stdout) ---
		"python_practice": `def solve():
    # Write your logic here.
    # Use _readline(), _read_int(), _read_ints(), _read_str() to read input.
    # Return the answer — do NOT print.
    pass
`,
		"javascript_practice": `function solve() {
  // Use readline(), readInt(), readInts() to read input.
  // Return the answer — do NOT console.log.
}
`,
		"cpp_practice": `#include <bits/stdc++.h>
using namespace std;

auto solve() {
    // Read from cin, return the answer.
    int n;
    cin >> n;
    return n; // replace with your answer
}
`,
		"java_practice": `import java.util.*;

class Solution {
    // Add a Scanner field if needed: Scanner sc;
    public Object solve() {
        // Write your logic here. Return the answer.
        return null;
    }
}
`,
		"go_practice": `import "fmt"

func solve() interface{} {
    // Use fmt.Fscan(_reader, &x) to read input.
    var n int
    fmt.Fscan(_reader, &n)
    return n // replace with your answer
}
`,
	}
}