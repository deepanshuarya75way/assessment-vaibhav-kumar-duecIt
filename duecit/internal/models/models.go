package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username      string             `bson:"username" json:"username"`
	Email         string             `bson:"email" json:"email"`
	PasswordHash  string             `bson:"passwordHash,omitempty" json:"-"`
	RatingDSA     int                `bson:"ratingDSA" json:"ratingDSA"`
	RatingDB      int                `bson:"ratingDB" json:"ratingDB"`
	MatchesPlayed int                `bson:"matchesPlayed" json:"matchesPlayed"`
	Wins          int                `bson:"wins" json:"wins"`
	Role          string             `bson:"role" json:"role"`
	OAuthProvider string             `bson:"oauthProvider,omitempty" json:"oauthProvider,omitempty"`
	OAuthID       string             `bson:"oauthId,omitempty" json:"-"`
	AvatarURL     string             `bson:"avatarUrl,omitempty" json:"avatarUrl,omitempty"`
	RefreshToken  string             `bson:"refreshToken,omitempty" json:"-"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Sample struct {
	Input  string `bson:"input" json:"input"`
	Output string `bson:"output" json:"output"`
}

type Problem struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ProblemID    string             `bson:"problemId" json:"problemId"`
	Title        string             `bson:"title" json:"title"`
	Statement    string             `bson:"statement" json:"statement"`
	InputFormat  string             `bson:"inputFormat" json:"inputFormat"`
	OutputFormat string             `bson:"outputFormat" json:"outputFormat"`
	Constraints  string             `bson:"constraints" json:"constraints"`
	Samples      []Sample           `bson:"samples" json:"samples"`
	Category     string             `bson:"category" json:"category"`
	Difficulty   string             `bson:"difficulty" json:"difficulty"`
	Tags         []string           `bson:"tags" json:"tags"`
	StarterCode  map[string]string  `bson:"starterCode,omitempty" json:"starterCode,omitempty"`
	Version      int                `bson:"version" json:"version"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type TestCase struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ProblemID      string             `bson:"problemId" json:"problemId"`
	Input          string             `bson:"input" json:"input"`
	ExpectedOutput string             `bson:"expectedOutput" json:"expectedOutput"`
	SizeBucket     string             `bson:"sizeBucket" json:"sizeBucket"`
	Weight         int                `bson:"weight" json:"weight"`
	IsHidden       bool               `bson:"isHidden" json:"isHidden"`
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
}

type TestResult struct {
	Passed         bool   `bson:"passed" json:"passed"`
	Input          string `bson:"input,omitempty" json:"input,omitempty"`
	ExpectedOutput string `bson:"expectedOutput,omitempty" json:"expectedOutput,omitempty"`
	ActualOutput   string `bson:"actualOutput,omitempty" json:"actualOutput,omitempty"`
	ExecutionTime  int64  `bson:"executionTime" json:"executionTime"`
	Memory         int64  `bson:"memory" json:"memory"`
	Error          string `bson:"error,omitempty" json:"error,omitempty"`
}

type Submission struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MatchID         primitive.ObjectID `bson:"matchId" json:"matchId"`
	UserID          primitive.ObjectID `bson:"userId" json:"userId"`
	Code            string             `bson:"code" json:"code"`
	Language        string             `bson:"language" json:"language"`
	ProblemID       string             `bson:"problemId" json:"problemId"`
	PassedCount     int                `bson:"passedCount" json:"passedCount"`
	TotalCount      int                `bson:"totalCount" json:"totalCount"`
	WeightedScore   float64            `bson:"weightedScore" json:"weightedScore"`
	ExecutionTimeMs int64              `bson:"executionTimeMs" json:"executionTimeMs"`
	SolveTimeMs     int64              `bson:"solveTimeMs" json:"solveTimeMs"`
	PenaltySeconds  int                `bson:"penaltySeconds" json:"penaltySeconds"`
	TestResults     []TestResult       `bson:"testResults" json:"testResults"`
	IsFinal         bool               `bson:"isFinal" json:"isFinal"`
	IsFullAC        bool               `bson:"isFullAC" json:"isFullAC"`
	SubmittedAt     time.Time          `bson:"submittedAt" json:"submittedAt"`
}

type RatingChange struct {
	PlayerA int `bson:"playerA" json:"playerA"`
	PlayerB int `bson:"playerB" json:"playerB"`
}

type Match struct {
	ID              primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	PlayerA         primitive.ObjectID   `bson:"playerA" json:"playerA"`
	PlayerB         primitive.ObjectID   `bson:"playerB" json:"playerB"`
	ProblemID       string               `bson:"problemId" json:"problemId"`
	Category        string               `bson:"category" json:"category"`
	Difficulty      string               `bson:"difficulty" json:"difficulty"`
	Mode            string               `bson:"mode" json:"mode"`
	Language        string               `bson:"language" json:"language"`
	Status          string               `bson:"status" json:"status"`
	Phase           string               `bson:"phase" json:"phase"`
	Winner          *primitive.ObjectID  `bson:"winner,omitempty" json:"winner,omitempty"`
	IsDraw          bool                 `bson:"isDraw" json:"isDraw"`
	StartTime       time.Time            `bson:"startTime" json:"startTime"`
	CodingStartsAt  *time.Time           `bson:"codingStartsAt,omitempty" json:"codingStartsAt,omitempty"`
	CodingEndsAt    *time.Time           `bson:"codingEndsAt,omitempty" json:"codingEndsAt,omitempty"`
	EndTime         *time.Time           `bson:"endTime,omitempty" json:"endTime,omitempty"`
	ReadPhaseSec    int                  `bson:"readPhaseSec" json:"readPhaseSec"`
	CodingPhaseSec  int                  `bson:"codingPhaseSec" json:"codingPhaseSec"`
	Submissions     []primitive.ObjectID `bson:"submissions" json:"submissions"`
	RatingChanges   RatingChange         `bson:"ratingChanges" json:"ratingChanges"`
	PlayerAPenalty  int                  `bson:"playerAPenalty" json:"playerAPenalty"`
	PlayerBPenalty  int                  `bson:"playerBPenalty" json:"playerBPenalty"`
	CreatedAt       time.Time            `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time            `bson:"updatedAt" json:"updatedAt"`
}

// Public problem view (no hidden test data)
type ProblemPublic struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Statement    string            `json:"statement"`
	InputFormat  string            `json:"inputFormat"`
	OutputFormat string            `json:"outputFormat"`
	Constraints  string            `json:"constraints"`
	Samples      []Sample          `json:"samples"`
	Category     string            `json:"category"`
	Difficulty   string            `json:"difficulty"`
	Tags         []string          `json:"tags"`
	StarterCode  map[string]string `json:"starterCode,omitempty"`
}

func (p *Problem) ToPublic() ProblemPublic {
	return ProblemPublic{
		ID:           p.ProblemID,
		Title:        p.Title,
		Statement:    p.Statement,
		InputFormat:  p.InputFormat,
		OutputFormat: p.OutputFormat,
		Constraints:  p.Constraints,
		Samples:      p.Samples,
		Category:     p.Category,
		Difficulty:   p.Difficulty,
		Tags:         p.Tags,
		StarterCode:  p.StarterCode,
	}
}

const (
	RoleUser  = "user"
	RoleAdmin = "admin"

	CategoryDSA = "dsa"
	CategoryDB  = "db"

	ModeCompetitive = "competitive"
	ModePractice    = "practice"

	MatchStatusWaiting   = "waiting"
	MatchStatusActive    = "active"
	MatchStatusFinished  = "finished"
	MatchStatusCancelled = "cancelled"

	PhaseReading = "reading"
	PhaseCoding  = "coding"
	PhaseFinished = "finished"
)
