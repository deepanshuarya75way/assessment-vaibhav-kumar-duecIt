package seed

import (
	"context"
	"log"
	"time"

	"github.com/duecit/duecit/internal/auth"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func Run(ctx context.Context, db *mongo.Database) error {
	probSvc := problems.NewService(db)
	users := db.Collection("users")

	// Admin user
	count, _ := users.CountDocuments(ctx, bson.M{"role": models.RoleAdmin})
	if count == 0 {
		hash, _ := auth.HashPassword("admin12345")
		_, err := users.InsertOne(ctx, models.User{
			Username: "admin", Email: "admin@duecit.local",
			PasswordHash: hash, RatingDSA: 1200, RatingDB: 1200,
			Role: models.RoleAdmin, CreatedAt: time.Now(), UpdatedAt: time.Now(),
		})
		if err != nil {
			log.Printf("admin seed: %v", err)
		} else {
			log.Println("Seeded admin user: admin / admin12345")
		}
	}

	problemsList := []models.Problem{
		{
			ProblemID: "P001", Title: "Two Sum",
			Statement:    "Given an array of integers and a target, return indices of two numbers that add up to the target.",
			InputFormat:  "First line: n\nSecond line: n integers\nThird line: target",
			OutputFormat: "Two space-separated indices",
			Constraints:  "2 <= n <= 100000",
			Samples:      []models.Sample{{Input: "4\n2 7 11 15\n9", Output: "0 1"}},
			Category: models.CategoryDSA, Difficulty: "easy",
			Tags: []string{"array", "hash-table"},
		},
		{
			ProblemID: "P002", Title: "Reverse String",
			Statement:    "Given a string, reverse it and print the result.",
			InputFormat:  "A single string",
			OutputFormat: "Reversed string",
			Constraints:  "1 <= length <= 100000",
			Samples:      []models.Sample{{Input: "hello", Output: "olleh"}},
			Category: models.CategoryDSA, Difficulty: "easy",
			Tags: []string{"string"},
		},
		{
			ProblemID: "P003", Title: "Second Highest Salary",
			Statement:    "Given employee salaries (one per line after count n), print the second highest unique salary, or 0 if none.",
			InputFormat:  "First line: n\nNext n lines: salary (integer)",
			OutputFormat: "Second highest salary or 0",
			Constraints:  "1 <= n <= 1000",
			Samples:      []models.Sample{{Input: "4\n100\n200\n300\n400", Output: "300"}},
			Category: models.CategoryDB, Difficulty: "medium",
			Tags: []string{"sql", "aggregation"},
		},
		{
			ProblemID: "P004", Title: "Sum of Array",
			Statement:    "Given n integers, print their sum.",
			InputFormat:  "First line: n\nSecond line: n space-separated integers",
			OutputFormat: "Single integer",
			Constraints:  "1 <= n <= 1000",
			Samples:      []models.Sample{{Input: "3\n1 2 3", Output: "6"}},
			Category: models.CategoryDSA, Difficulty: "easy",
			Tags: []string{"array", "math"},
		},
		{
			ProblemID: "P005", Title: "Maximum Element",
			Statement:    "Given n integers, print the maximum value.",
			InputFormat:  "First line: n\nSecond line: n integers",
			OutputFormat: "Single integer",
			Constraints:  "1 <= n <= 100000",
			Samples:      []models.Sample{{Input: "5\n3 1 4 1 5", Output: "5"}},
			Category: models.CategoryDSA, Difficulty: "easy",
			Tags: []string{"array"},
		},
		{
			ProblemID: "P006", Title: "Count Multiples of 3 or 5",
			Statement:    "Given n, count numbers from 1 to n divisible by 3 or 5.",
			InputFormat:  "Single integer n",
			OutputFormat: "Single integer count",
			Constraints:  "1 <= n <= 10^6",
			Samples:      []models.Sample{{Input: "15", Output: "7"}},
			Category: models.CategoryDSA, Difficulty: "medium",
			Tags: []string{"math"},
		},
	}

	for _, p := range problemsList {
		existing, _ := probSvc.GetProblem(ctx, p.ProblemID)
		if existing != nil {
			continue
		}
		created, err := probSvc.CreateProblem(ctx, &p)
		if err != nil {
			log.Printf("seed problem %s: %v", p.ProblemID, err)
			continue
		}
		log.Printf("Seeded problem: %s", created.Title)

		if p.Category == models.CategoryDSA {
			cases := []models.TestCase{
				{ProblemID: p.ProblemID, Input: p.Samples[0].Input, ExpectedOutput: p.Samples[0].Output, SizeBucket: "small", Weight: 20, IsHidden: false},
			}
			switch p.ProblemID {
			case "P001":
				cases = append(cases, models.TestCase{
					ProblemID: p.ProblemID, Input: "3\n3 2 4\n6", ExpectedOutput: "1 2",
					SizeBucket: "small", Weight: 40, IsHidden: true,
				})
			case "P002":
				cases = append(cases, models.TestCase{
					ProblemID: p.ProblemID, Input: "world", ExpectedOutput: "dlrow",
					SizeBucket: "small", Weight: 40, IsHidden: true,
				})
			case "P004":
				cases = append(cases,
					models.TestCase{ProblemID: p.ProblemID, Input: "5\n10 -5 3 7 0", ExpectedOutput: "15", SizeBucket: "small", Weight: 40, IsHidden: true},
					models.TestCase{ProblemID: p.ProblemID, Input: "1\n42", ExpectedOutput: "42", SizeBucket: "medium", Weight: 40, IsHidden: true},
				)
			case "P005":
				cases = append(cases, models.TestCase{
					ProblemID: p.ProblemID, Input: "3\n-10 -3 -7", ExpectedOutput: "-3",
					SizeBucket: "small", Weight: 40, IsHidden: true,
				})
			case "P006":
				cases = append(cases, models.TestCase{
					ProblemID: p.ProblemID, Input: "100", ExpectedOutput: "46",
					SizeBucket: "medium", Weight: 40, IsHidden: true,
				})
			}
			for _, tc := range cases {
				_, _ = probSvc.AddTestCase(ctx, &tc)
			}
		}
		if p.ProblemID == "P003" {
			cases := []models.TestCase{
				{ProblemID: "P003", Input: "4\n100\n200\n300\n400", ExpectedOutput: "300", SizeBucket: "small", Weight: 20, IsHidden: false},
				{ProblemID: "P003", Input: "3\n50\n50\n50", ExpectedOutput: "0", SizeBucket: "small", Weight: 40, IsHidden: true},
			}
			for _, tc := range cases {
				_, _ = probSvc.AddTestCase(ctx, &tc)
			}
		}
	}

	return nil
}
