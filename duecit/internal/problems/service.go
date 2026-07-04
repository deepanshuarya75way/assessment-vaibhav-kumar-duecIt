package problems

import (
	"context"
	"errors"
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
	return &Service{
		problems:  db.Collection("problems"),
		testCases: db.Collection("testcases"),
	}
}

func (s *Service) CreateProblem(ctx context.Context, p *models.Problem) (*models.Problem, error) {
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
	_, err := s.problems.DeleteOne(ctx, bson.M{"problemId": problemID})
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

func defaultStarterCode() map[string]string {
	return map[string]string{
		"python":     "# Write your solution here\n",
		"javascript": "// Write your solution here\n",
		"cpp":        "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n",
		"java":       "public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n",
		"go":         "package main\n\nimport \"fmt\"\n\nfunc main() {\n    // Write your solution here\n}\n",
	}
}
