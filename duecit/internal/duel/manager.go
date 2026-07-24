package duel

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/duecit/duecit/internal/elo"
	"github.com/duecit/duecit/internal/judge"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"github.com/duecit/duecit/internal/ws"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Manager struct {
	matches     *mongo.Collection
	submissions *mongo.Collection
	users       *mongo.Collection
	problems    *problems.Service
	judge       *judge.Service
	elo         *elo.Service
	hub         *ws.Hub
	rdb         *redis.Client
}

func NewManager(db *mongo.Database, prob *problems.Service, j *judge.Service, e *elo.Service, hub *ws.Hub, rdb *redis.Client) *Manager {
	return &Manager{
		matches:     db.Collection("matches"),
		submissions: db.Collection("submissions"),
		users:       db.Collection("users"),
		problems:    prob,
		judge:       j,
		elo:         e,
		hub:         hub,
		rdb:         rdb,
	}
}

type CreateMatchInput struct {
	PlayerA, PlayerB primitive.ObjectID
	Problem          *models.Problem
	Category         string
	Difficulty       string
	Mode             string
	Language         string
	ReadPhaseSec     int
	CodingPhaseSec   int
	PlayerAName      string
	PlayerARating    int
	PlayerBName      string
	PlayerBRating    int
}

type OpponentInfo struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Rating   int    `json:"rating"`
}

type MatchFoundPayload struct {
	MatchID        string               `json:"matchId"`
	YourRole       string               `json:"yourRole"`
	Problem        models.ProblemPublic `json:"problem"`
	Opponent       OpponentInfo         `json:"opponent"`
	Mode           string               `json:"mode"`
	Language       string               `json:"language"`
	ServerTime     int64                `json:"serverTime"`
	CodingStartsAt int64                `json:"codingStartsAt"`
	CodingEndsAt   int64                `json:"codingEndsAt"`
	ReadPhaseSec   int                  `json:"readPhaseSec"`
	CodingPhaseSec int                  `json:"codingPhaseSec"`
}

func (m *Manager) CreateMatch(ctx context.Context, in CreateMatchInput) (*models.Match, error) {
	now := time.Now()
	codingStarts := now.Add(time.Duration(in.ReadPhaseSec) * time.Second)
	codingEnds := codingStarts.Add(time.Duration(in.CodingPhaseSec) * time.Second)

	match := models.Match{
		PlayerA:        in.PlayerA,
		PlayerB:        in.PlayerB,
		ProblemID:      in.Problem.ProblemID,
		Category:       in.Category,
		Difficulty:     in.Difficulty,
		Mode:           in.Mode,
		Language:       in.Language,
		Status:         models.MatchStatusActive,
		Phase:          models.PhaseReading,
		StartTime:      now,
		CodingStartsAt: &codingStarts,
		CodingEndsAt:   &codingEnds,
		ReadPhaseSec:   in.ReadPhaseSec,
		CodingPhaseSec: in.CodingPhaseSec,
		Submissions:    []primitive.ObjectID{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	res, err := m.matches.InsertOne(ctx, match)
	if err != nil {
		return nil, err
	}
	match.ID = res.InsertedID.(primitive.ObjectID)
	matchID := match.ID.Hex()

	// Store in Redis
	state, _ := json.Marshal(map[string]interface{}{
		"matchId":        matchID,
		"phase":          models.PhaseReading,
		"codingStartsAt": codingStarts.UnixMilli(),
		"codingEndsAt":   codingEnds.UnixMilli(),
	})
	m.rdb.Set(ctx, "match:"+matchID, state, time.Duration(in.ReadPhaseSec+in.CodingPhaseSec+300)*time.Second)

	m.hub.JoinMatchRoom(in.PlayerA.Hex(), matchID)
	m.hub.JoinMatchRoom(in.PlayerB.Hex(), matchID)

	pub := m.problemPublicWithSamples(ctx, in.Problem)
	serverTime := now.UnixMilli()

	payloadA := MatchFoundPayload{
		MatchID: matchID, YourRole: "playerA", Problem: pub,
		Opponent: OpponentInfo{UserID: in.PlayerB.Hex(), Username: in.PlayerBName, Rating: in.PlayerBRating},
		Mode:     in.Mode, Language: in.Language,
		ServerTime: serverTime, CodingStartsAt: codingStarts.UnixMilli(), CodingEndsAt: codingEnds.UnixMilli(),
		ReadPhaseSec: in.ReadPhaseSec, CodingPhaseSec: in.CodingPhaseSec,
	}
	payloadB := MatchFoundPayload{
		MatchID: matchID, YourRole: "playerB", Problem: pub,
		Opponent: OpponentInfo{UserID: in.PlayerA.Hex(), Username: in.PlayerAName, Rating: in.PlayerARating},
		Mode:     in.Mode, Language: in.Language,
		ServerTime: serverTime, CodingStartsAt: codingStarts.UnixMilli(), CodingEndsAt: codingEnds.UnixMilli(),
		ReadPhaseSec: in.ReadPhaseSec, CodingPhaseSec: in.CodingPhaseSec,
	}

	m.storePendingMatch(ctx, in.PlayerA.Hex(), payloadA)
	m.storePendingMatch(ctx, in.PlayerB.Hex(), payloadB)
	m.hub.EmitToUser(in.PlayerA.Hex(), "match:found", payloadA)
	m.hub.EmitToUser(in.PlayerB.Hex(), "match:found", payloadB)

	// Schedule phase transitions
	go m.schedulePhases(match.ID, in.ReadPhaseSec, in.CodingPhaseSec)

	return &match, nil
}

func (m *Manager) schedulePhases(matchID primitive.ObjectID, readSec, codingSec int) {
	time.Sleep(time.Duration(readSec) * time.Second)
	ctx := context.Background()
	match, err := m.GetMatch(ctx, matchID)
	if err != nil || match.Status == models.MatchStatusFinished {
		return
	}

	mid := matchID.Hex()
	codingEndsAt := time.Now().Add(time.Duration(codingSec) * time.Second).UnixMilli()
	payload := map[string]interface{}{
		"matchId":      mid,
		"serverTime":   time.Now().UnixMilli(),
		"codingEndsAt": codingEndsAt,
	}
	m.emitToMatchPlayers(match, "match:coding_start", payload)

	m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{"$set": bson.M{
		"phase":        models.PhaseCoding,
		"codingEndsAt": time.UnixMilli(codingEndsAt),
		"updatedAt":    time.Now(),
	}})

	time.Sleep(time.Duration(codingSec) * time.Second)
	m.finalizeByTimeout(ctx, matchID)
}

func (m *Manager) emitToMatchPlayers(match *models.Match, eventType string, data interface{}) {
	mid := match.ID.Hex()
	m.hub.EmitToMatch(mid, eventType, data)
	m.hub.EmitToUser(match.PlayerA.Hex(), eventType, data)
	m.hub.EmitToUser(match.PlayerB.Hex(), eventType, data)
}

func (m *Manager) GetMatch(ctx context.Context, id primitive.ObjectID) (*models.Match, error) {
	var match models.Match
	err := m.matches.FindOne(ctx, bson.M{"_id": id}).Decode(&match)
	return &match, err
}

type RunRequest struct {
	Code     string
	Language string
}

func (m *Manager) RunCode(ctx context.Context, matchID, userID primitive.ObjectID, code, language string) (*judge.EvalResult, error) {
	match, err := m.GetMatch(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("match not found")
	}
	// Block run during reading phase only; allow coding + any other phase
	if match.Phase == models.PhaseReading {
		return nil, fmt.Errorf("coding phase not started yet")
	}
	if !m.isPlayer(match, userID) {
		return nil, fmt.Errorf("not in match")
	}

	problem, err := m.problems.GetProblem(ctx, match.ProblemID)
	if err != nil {
		return nil, err
	}

	// BuildExecutable owns the fallback chain now: hand-written driver code
	// first, then auto-generated signature wrapping, then raw passthrough.
	// Mode no longer decides raw-vs-wrapped at all; it only decides ELO
	// effect (finalizeMatch) and test-case scope (samples here vs all in
	// Submit).
	execCode := judge.BuildExecutable(code, language, problem.DriverCode, problem.InputSpec, problem.Signature)
	checker := judge.CheckerForProblem(problem)

	testCases := judge.SamplesToTestCases(problem.Samples)
	if len(testCases) == 0 {
		testCases = m.visibleTestCases(ctx, match.ProblemID)
	}
	if len(testCases) == 0 {
		return nil, fmt.Errorf("no sample test cases configured for this problem")
	}
	return m.judge.Evaluate(ctx, execCode, language, testCases, checker)
}

func (m *Manager) SubmitCode(ctx context.Context, matchID, userID primitive.ObjectID, code, language string, prevCodeLen int) (*models.Submission, bool, error) {
	if len(code)-prevCodeLen > 500 && prevCodeLen > 0 {
		return nil, false, fmt.Errorf("paste detected: code length jump too large")
	}

	match, err := m.GetMatch(ctx, matchID)
	if err != nil {
		return nil, false, fmt.Errorf("match not found")
	}
	if match.Status == models.MatchStatusFinished {
		return nil, false, fmt.Errorf("match already finished")
	}
	if match.Phase != models.PhaseCoding && match.Phase != models.PhaseReading {
		return nil, false, fmt.Errorf("cannot submit now")
	}
	if !m.isPlayer(match, userID) {
		return nil, false, fmt.Errorf("not in match")
	}

	if match.Mode == models.ModePractice {
		count, _ := m.submissions.CountDocuments(ctx, bson.M{"matchId": matchID, "userId": userID, "isFinal": true})
		if count > 0 {
			return nil, false, fmt.Errorf("already submitted")
		}
	}

	problem, err := m.problems.GetProblem(ctx, match.ProblemID)
	if err != nil || problem == nil {
		return nil, false, fmt.Errorf("problem not found")
	}

	testCases, err := m.problems.GetTestCases(ctx, match.ProblemID, true)
	if err != nil || len(testCases) == 0 {
		testCases = judge.SamplesToTestCases(problem.Samples)
	}

	// Same as RunCode - see comment there for the fallback chain.
	execCode := judge.BuildExecutable(code, language, problem.DriverCode, problem.InputSpec, problem.Signature)
	checker := judge.CheckerForProblem(problem)

	result, err := m.judge.Evaluate(ctx, execCode, language, testCases, checker)
	if err != nil {
		return nil, false, err
	}

	solveTimeMs := int64(0)
	if match.CodingStartsAt != nil {
		solveTimeMs = time.Since(*match.CodingStartsAt).Milliseconds()
	}

	penalty := 0
	if match.Mode == models.ModeCompetitive && !result.IsFullAC {
		if userID == match.PlayerA {
			penalty = match.PlayerAPenalty + 300
			m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{"$set": bson.M{"playerAPenalty": penalty}})
		} else {
			penalty = match.PlayerBPenalty + 300
			m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{"$set": bson.M{"playerBPenalty": penalty}})
		}
	}

	sub := models.Submission{
		MatchID:         matchID,
		UserID:          userID,
		Code:            code,
		Language:        language,
		ProblemID:       match.ProblemID,
		PassedCount:     result.PassedCount,
		TotalCount:      result.TotalCount,
		WeightedScore:   result.WeightedScore,
		ExecutionTimeMs: result.ExecutionTimeMs,
		SolveTimeMs:     solveTimeMs + int64(penalty*1000),
		PenaltySeconds:  penalty,
		TestResults:     result.TestResults,
		Verdict:         result.Verdict,
		IsFinal:         match.Mode == models.ModePractice,
		IsFullAC:        result.IsFullAC,
		SubmittedAt:     time.Now(),
	}

	res, err := m.submissions.InsertOne(ctx, sub)
	if err != nil {
		return nil, false, err
	}
	sub.ID = res.InsertedID.(primitive.ObjectID)

	m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{
		"$push": bson.M{"submissions": sub.ID},
		"$set":  bson.M{"updatedAt": time.Now()},
	})

	m.hub.EmitToMatch(matchID.Hex(), "submission:progress", map[string]interface{}{
		"userId":      userID.Hex(),
		"passedCount": result.PassedCount,
		"totalCount":  result.TotalCount,
		"isFullAC":    result.IsFullAC,
	})
	m.hub.EmitToUser(match.PlayerA.Hex(), "submission:progress", map[string]interface{}{
		"userId": userID.Hex(), "passedCount": result.PassedCount,
		"totalCount": result.TotalCount, "isFullAC": result.IsFullAC,
	})
	m.hub.EmitToUser(match.PlayerB.Hex(), "submission:progress", map[string]interface{}{
		"userId": userID.Hex(), "passedCount": result.PassedCount,
		"totalCount": result.TotalCount, "isFullAC": result.IsFullAC,
	})

	finished := m.checkBothSubmitted(ctx, matchID)

	return &sub, finished, nil
}

func (m *Manager) checkBothSubmitted(ctx context.Context, matchID primitive.ObjectID) bool {
	match, _ := m.GetMatch(ctx, matchID)
	if match == nil || match.Status == models.MatchStatusFinished {
		return false
	}

	cur, err := m.submissions.Find(ctx, bson.M{"matchId": matchID})
	if err != nil {
		return false
	}
	var subs []models.Submission
	_ = cur.All(ctx, &subs)
	cur.Close(ctx)

	submitters := map[string]bool{}
	for _, s := range subs {
		submitters[s.UserID.Hex()] = true
	}
	if len(submitters) >= 2 {
		return m.finalizeMatch(ctx, matchID)
	}
	return false
}

func (m *Manager) finalizeByTimeout(ctx context.Context, matchID primitive.ObjectID) {
	match, err := m.GetMatch(ctx, matchID)
	if err != nil || match.Status == models.MatchStatusFinished {
		return
	}
	m.finalizeMatch(ctx, matchID)
}

type PlayerResult struct {
	UserID       string  `json:"userId"`
	Username     string  `json:"username"`
	Code         string  `json:"code"`
	Language     string  `json:"language"`
	Score        float64 `json:"score"`
	SolveTimeMs  int64   `json:"solveTimeMs"`
	RatingChange int     `json:"ratingChange"`
	NewRating    int     `json:"newRating"`
}

type MatchResult struct {
	Draw   bool          `json:"draw"`
	Reason string        `json:"reason,omitempty"`
	Winner *PlayerResult `json:"winner,omitempty"`
	Loser  *PlayerResult `json:"loser,omitempty"`
}

func (m *Manager) finalizeMatch(ctx context.Context, matchID primitive.ObjectID) bool {
	match, err := m.GetMatch(ctx, matchID)
	if err != nil || match.Status == models.MatchStatusFinished {
		return false
	}

	cur, _ := m.submissions.Find(ctx, bson.M{"matchId": matchID})
	var subs []models.Submission
	_ = cur.All(ctx, &subs)
	cur.Close(ctx)

	if len(subs) == 0 {
		// Forfeit draw — no submissions
		match.Status = models.MatchStatusFinished
		now := time.Now()
		match.EndTime = &now
		match.Phase = models.PhaseFinished
		match.IsDraw = true
		m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{"$set": match})
		result := MatchResult{Draw: true, Reason: "timeout"}
		m.emitToMatchPlayers(match, "match:finished", result)
		m.clearUserQueueState(ctx, match.PlayerA.Hex())
		m.clearUserQueueState(ctx, match.PlayerB.Hex())
		return true
	}

	// Pick best submission per player
	best := map[string]models.Submission{}
	for _, s := range subs {
		key := s.UserID.Hex()
		if existing, ok := best[key]; !ok || s.WeightedScore > existing.WeightedScore ||
			(s.WeightedScore == existing.WeightedScore && s.SolveTimeMs < existing.SolveTimeMs) {
			best[key] = s
		}
	}

	paSub, paOk := best[match.PlayerA.Hex()]
	pbSub, pbOk := best[match.PlayerB.Hex()]

	var winnerID, loserID primitive.ObjectID
	isDraw := false

	if paOk && pbOk {
		if paSub.WeightedScore > pbSub.WeightedScore {
			winnerID, loserID = match.PlayerA, match.PlayerB
		} else if pbSub.WeightedScore > paSub.WeightedScore {
			winnerID, loserID = match.PlayerB, match.PlayerA
		} else if paSub.SolveTimeMs < pbSub.SolveTimeMs {
			winnerID, loserID = match.PlayerA, match.PlayerB
		} else if pbSub.SolveTimeMs < paSub.SolveTimeMs {
			winnerID, loserID = match.PlayerB, match.PlayerA
		} else {
			isDraw = true
			winnerID, loserID = match.PlayerA, match.PlayerB
		}
	} else if paOk {
		winnerID, loserID = match.PlayerA, match.PlayerB
	} else if pbOk {
		winnerID, loserID = match.PlayerB, match.PlayerA
	} else {
		isDraw = true
	}

	var wUpdate, lUpdate *elo.RatingUpdate
	if match.Mode == models.ModePractice {
		// Practice matches never affect rating. Fetch current username/rating
		// as-is so the result payload still has something to show, just with
		// a Change of 0 - don't call into the elo service at all, since that
		// would persist a rating mutation.
		var wUser, lUser models.User
		_ = m.users.FindOne(ctx, bson.M{"_id": winnerID}).Decode(&wUser)
		_ = m.users.FindOne(ctx, bson.M{"_id": loserID}).Decode(&lUser)
		wRating, lRating := wUser.RatingDSA, lUser.RatingDSA
		if match.Category == models.CategoryDB {
			wRating, lRating = wUser.RatingDB, lUser.RatingDB
		}
		wUpdate = &elo.RatingUpdate{Username: wUser.Username, Change: 0, NewRating: wRating}
		lUpdate = &elo.RatingUpdate{Username: lUser.Username, Change: 0, NewRating: lRating}
	} else if isDraw {
		wUpdate, lUpdate, _ = m.elo.UpdateDraw(ctx, match.PlayerA, match.PlayerB, match.Category, match.Difficulty)
	} else {
		wUpdate, lUpdate, _ = m.elo.UpdateRatings(ctx, winnerID, loserID, match.Category, match.Difficulty, false)
	}

	wSub := paSub
	lSub := pbSub
	wRes := wUpdate
	lRes := lUpdate
	if !paOk && pbOk {
		wSub, lSub = pbSub, models.Submission{}
		wRes, lRes = wUpdate, lUpdate
	} else if paOk && !pbOk {
		wSub, lSub = paSub, models.Submission{}
	} else if winnerID == match.PlayerB {
		wSub, lSub = pbSub, paSub
	}

	now := time.Now()
	ratingChanges := models.RatingChange{}
	if wUpdate != nil {
		if winnerID == match.PlayerA {
			ratingChanges.PlayerA = wUpdate.Change
			ratingChanges.PlayerB = lUpdate.Change
		} else {
			ratingChanges.PlayerB = wUpdate.Change
			ratingChanges.PlayerA = lUpdate.Change
		}
	}

	m.matches.UpdateOne(ctx, bson.M{"_id": matchID}, bson.M{"$set": bson.M{
		"status":        models.MatchStatusFinished,
		"phase":         models.PhaseFinished,
		"winner":        winnerID,
		"isDraw":        isDraw,
		"endTime":       now,
		"ratingChanges": ratingChanges,
		"updatedAt":     now,
	}})

	wUsername := wRes.Username
	lUsername := lRes.Username

	result := MatchResult{
		Draw: isDraw,
		Winner: &PlayerResult{
			UserID: winnerID.Hex(), Username: wUsername,
			Code: wSub.Code, Language: wSub.Language,
			Score: wSub.WeightedScore, SolveTimeMs: wSub.SolveTimeMs,
			RatingChange: wRes.Change, NewRating: wRes.NewRating,
		},
		Loser: &PlayerResult{
			UserID: loserID.Hex(), Username: lUsername,
			Code: lSub.Code, Language: lSub.Language,
			Score: lSub.WeightedScore, SolveTimeMs: lSub.SolveTimeMs,
			RatingChange: lRes.Change, NewRating: lRes.NewRating,
		},
	}
	m.emitToMatchPlayers(match, "match:finished", result)
	m.clearUserQueueState(ctx, match.PlayerA.Hex())
	m.clearUserQueueState(ctx, match.PlayerB.Hex())

	return true
}

func (m *Manager) clearUserQueueState(ctx context.Context, userID string) {
	memberKey := fmt.Sprintf("queue:member:%s", userID)
	data, err := m.rdb.Get(ctx, memberKey).Bytes()
	if err != nil {
		return
	}
	var entry struct {
		Category   string `json:"category"`
		Difficulty string `json:"difficulty"`
		Mode       string `json:"mode"`
	}
	if json.Unmarshal(data, &entry) != nil {
		m.rdb.Del(ctx, memberKey, fmt.Sprintf("queue:data:%s", userID))
		return
	}
	key := fmt.Sprintf("queue:%s:%s:%s", entry.Category, entry.Difficulty, entry.Mode)
	pipe := m.rdb.Pipeline()
	pipe.ZRem(ctx, key, userID)
	pipe.Del(ctx, memberKey)
	pipe.Del(ctx, fmt.Sprintf("queue:data:%s", userID))
	pipe.Exec(ctx)
}

func (m *Manager) isPlayer(match *models.Match, userID primitive.ObjectID) bool {
	return match.PlayerA == userID || match.PlayerB == userID
}

func (m *Manager) SetHub(hub *ws.Hub) {
	m.hub = hub
}

func (m *Manager) storePendingMatch(ctx context.Context, userID string, payload MatchFoundPayload) {
	data, _ := json.Marshal(payload)
	m.rdb.Set(ctx, "pending:match:"+userID, data, 15*time.Minute)
}

func (m *Manager) PeekPendingMatch(ctx context.Context, userID string) (*MatchFoundPayload, error) {
	data, err := m.rdb.Get(ctx, "pending:match:"+userID).Bytes()
	if err != nil {
		return nil, err
	}
	var payload MatchFoundPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

func (m *Manager) ClearPendingMatch(ctx context.Context, userID string) {
	m.rdb.Del(ctx, "pending:match:"+userID)
}

func (m *Manager) GetPendingMatch(ctx context.Context, userID string) (*MatchFoundPayload, error) {
	return m.PeekPendingMatch(ctx, userID)
}

type MatchDetails struct {
	MatchID        string               `json:"matchId"`
	YourRole       string               `json:"yourRole"`
	Problem        models.ProblemPublic `json:"problem"`
	Opponent       OpponentInfo         `json:"opponent"`
	Mode           string               `json:"mode"`
	Language       string               `json:"language"`
	Phase          string               `json:"phase"`
	Status         string               `json:"status"`
	HasSubmitted   bool                 `json:"hasSubmitted"`
	ServerTime     int64                `json:"serverTime"`
	CodingStartsAt int64                `json:"codingStartsAt"`
	CodingEndsAt   int64                `json:"codingEndsAt"`
	ReadPhaseSec   int                  `json:"readPhaseSec"`
	CodingPhaseSec int                  `json:"codingPhaseSec"`
}

func (m *Manager) GetMatchDetails(ctx context.Context, matchID, userID primitive.ObjectID) (*MatchDetails, error) {
	match, err := m.GetMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}
	if match.PlayerA != userID && match.PlayerB != userID {
		return nil, fmt.Errorf("not in match")
	}

	problem, err := m.problems.GetProblem(ctx, match.ProblemID)
	if err != nil {
		return nil, err
	}

	role := "playerB"
	opponentID := match.PlayerA
	if userID == match.PlayerA {
		role = "playerA"
		opponentID = match.PlayerB
	}

	var opponent models.User
	if err := m.users.FindOne(ctx, bson.M{"_id": opponentID}).Decode(&opponent); err != nil {
		return nil, err
	}

	rating := opponent.RatingDSA
	if match.Category == models.CategoryDB {
		rating = opponent.RatingDB
	}

	now := time.Now()
	phase := match.Phase
	if match.Status == models.MatchStatusFinished {
		phase = models.PhaseFinished
	} else if match.Status == models.MatchStatusActive {
		if match.CodingEndsAt != nil && now.After(*match.CodingEndsAt) {
			go m.finalizeByTimeout(context.Background(), matchID)
			phase = models.PhaseFinished
		} else if match.CodingStartsAt != nil && now.After(*match.CodingStartsAt) && phase == models.PhaseReading {
			phase = models.PhaseCoding
		}
	}

	codingStarts := int64(0)
	codingEnds := int64(0)
	if match.CodingStartsAt != nil {
		codingStarts = match.CodingStartsAt.UnixMilli()
	}
	if match.CodingEndsAt != nil {
		codingEnds = match.CodingEndsAt.UnixMilli()
	}

	subCount, _ := m.submissions.CountDocuments(ctx, bson.M{"matchId": matchID, "userId": userID})

	m.hub.JoinMatchRoom(userID.Hex(), match.ID.Hex())
	m.ClearPendingMatch(ctx, userID.Hex())

	return &MatchDetails{
		MatchID:        match.ID.Hex(),
		YourRole:       role,
		Problem:        m.problemPublicWithSamples(ctx, problem),
		Opponent:       OpponentInfo{UserID: opponent.ID.Hex(), Username: opponent.Username, Rating: rating},
		Mode:           match.Mode,
		Language:       match.Language,
		Phase:          phase,
		Status:         match.Status,
		HasSubmitted:   subCount > 0,
		ServerTime:     now.UnixMilli(),
		CodingStartsAt: codingStarts,
		CodingEndsAt:   codingEnds,
		ReadPhaseSec:   match.ReadPhaseSec,
		CodingPhaseSec: match.CodingPhaseSec,
	}, nil
}

func (m *Manager) GetActiveMatchForUser(ctx context.Context, userID primitive.ObjectID) (*MatchFoundPayload, error) {
	var match models.Match
	err := m.matches.FindOne(ctx, bson.M{
		"status": models.MatchStatusActive,
		"$or": []bson.M{
			{"playerA": userID},
			{"playerB": userID},
		},
	}, options.FindOne().SetSort(bson.D{{Key: "startTime", Value: -1}})).Decode(&match)
	if err != nil {
		return nil, err
	}

	details, err := m.buildMatchFoundPayload(ctx, &match, userID)
	if err != nil {
		return nil, err
	}
	return details, nil
}

func (m *Manager) buildMatchFoundPayload(ctx context.Context, match *models.Match, userID primitive.ObjectID) (*MatchFoundPayload, error) {
	problem, err := m.problems.GetProblem(ctx, match.ProblemID)
	if err != nil {
		return nil, err
	}

	role := "playerB"
	opponentID := match.PlayerA
	if userID == match.PlayerA {
		role = "playerA"
		opponentID = match.PlayerB
	}

	var opponent models.User
	if err := m.users.FindOne(ctx, bson.M{"_id": opponentID}).Decode(&opponent); err != nil {
		return nil, err
	}

	rating := opponent.RatingDSA
	if match.Category == models.CategoryDB {
		rating = opponent.RatingDB
	}

	codingStarts := int64(0)
	codingEnds := int64(0)
	if match.CodingStartsAt != nil {
		codingStarts = match.CodingStartsAt.UnixMilli()
	}
	if match.CodingEndsAt != nil {
		codingEnds = match.CodingEndsAt.UnixMilli()
	}

	return &MatchFoundPayload{
		MatchID:        match.ID.Hex(),
		YourRole:       role,
		Problem:        m.problemPublicWithSamples(ctx, problem),
		Opponent:       OpponentInfo{UserID: opponent.ID.Hex(), Username: opponent.Username, Rating: rating},
		Mode:           match.Mode,
		Language:       match.Language,
		ServerTime:     time.Now().UnixMilli(),
		CodingStartsAt: codingStarts,
		CodingEndsAt:   codingEnds,
		ReadPhaseSec:   match.ReadPhaseSec,
		CodingPhaseSec: match.CodingPhaseSec,
	}, nil
}

func (m *Manager) problemPublicWithSamples(ctx context.Context, problem *models.Problem) models.ProblemPublic {
	pub := problem.ToPublic()
	if len(pub.Samples) > 0 {
		return pub
	}
	for _, tc := range m.visibleTestCases(ctx, problem.ProblemID) {
		pub.Samples = append(pub.Samples, models.Sample{
			Input:  tc.Input,
			Output: tc.ExpectedOutput,
		})
	}
	return pub
}

func (m *Manager) visibleTestCases(ctx context.Context, problemID string) []models.TestCase {
	testCases, err := m.problems.GetTestCases(ctx, problemID, false)
	if err != nil {
		return nil
	}
	visible := make([]models.TestCase, 0, len(testCases))
	for _, tc := range testCases {
		if !tc.IsHidden {
			visible = append(visible, tc)
		}
	}
	return visible
}

func (m *Manager) OnUserConnected(userID primitive.ObjectID) {
	ctx := context.Background()
	match, err := m.GetActiveMatchForUser(ctx, userID)
	if err != nil || match == nil {
		return
	}
	m.hub.JoinMatchRoom(userID.Hex(), match.MatchID)
}

func (m *Manager) StartRecoveryPoller(ctx context.Context) {
	go func() {
		m.recoverActiveMatches(context.Background())
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.recoverActiveMatches(context.Background())
			}
		}
	}()
}

func (m *Manager) recoverActiveMatches(ctx context.Context) {
	cur, err := m.matches.Find(ctx, bson.M{"status": models.MatchStatusActive})
	if err != nil {
		return
	}
	defer cur.Close(ctx)

	for cur.Next(ctx) {
		var match models.Match
		if err := cur.Decode(&match); err != nil {
			continue
		}
		now := time.Now()
		if match.CodingEndsAt != nil && now.After(*match.CodingEndsAt) {
			m.finalizeByTimeout(ctx, match.ID)
			continue
		}
		if match.CodingStartsAt != nil && now.After(*match.CodingStartsAt) && match.Phase == models.PhaseReading {
			m.matches.UpdateOne(ctx, bson.M{"_id": match.ID}, bson.M{"$set": bson.M{
				"phase":     models.PhaseCoding,
				"updatedAt": now,
			}})
			payload := map[string]interface{}{
				"matchId":      match.ID.Hex(),
				"serverTime":   now.UnixMilli(),
				"codingEndsAt": match.CodingEndsAt.UnixMilli(),
			}
			m.emitToMatchPlayers(&match, "match:coding_start", payload)
		}
	}
}

func (m *Manager) GetMatchResult(ctx context.Context, matchID, userID primitive.ObjectID) (*MatchResult, error) {
	match, err := m.GetMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}
	if match.PlayerA != userID && match.PlayerB != userID {
		return nil, fmt.Errorf("not in match")
	}
	if match.Status != models.MatchStatusFinished {
		return nil, fmt.Errorf("match not finished")
	}
	if match.IsDraw && match.Winner == nil {
		return &MatchResult{Draw: true, Reason: "timeout"}, nil
	}

	cur, err := m.submissions.Find(ctx, bson.M{"matchId": matchID})
	if err != nil {
		return nil, err
	}
	var subs []models.Submission
	_ = cur.All(ctx, &subs)
	cur.Close(ctx)

	best := map[string]models.Submission{}
	for _, s := range subs {
		key := s.UserID.Hex()
		if existing, ok := best[key]; !ok || s.WeightedScore > existing.WeightedScore ||
			(s.WeightedScore == existing.WeightedScore && s.SolveTimeMs < existing.SolveTimeMs) {
			best[key] = s
		}
	}

	playerA, err := m.getUser(ctx, match.PlayerA)
	if err != nil {
		return nil, err
	}
	playerB, err := m.getUser(ctx, match.PlayerB)
	if err != nil {
		return nil, err
	}

	winnerID := match.PlayerA
	loserID := match.PlayerB
	if match.Winner != nil {
		winnerID = *match.Winner
		if winnerID == match.PlayerA {
			loserID = match.PlayerB
		} else {
			loserID = match.PlayerA
		}
	}

	winner := playerA
	loser := playerB
	if winnerID == match.PlayerB {
		winner = playerB
		loser = playerA
	}

	wSub := best[winnerID.Hex()]
	lSub := best[loserID.Hex()]
	wRating, lRating := winner.RatingDSA, loser.RatingDSA
	if match.Category == models.CategoryDB {
		wRating, lRating = winner.RatingDB, loser.RatingDB
	}

	wChange, lChange := match.RatingChanges.PlayerA, match.RatingChanges.PlayerB
	if winnerID == match.PlayerB {
		wChange, lChange = match.RatingChanges.PlayerB, match.RatingChanges.PlayerA
	}

	return &MatchResult{
		Draw: match.IsDraw,
		Winner: &PlayerResult{
			UserID: winnerID.Hex(), Username: winner.Username,
			Code: wSub.Code, Language: wSub.Language,
			Score: wSub.WeightedScore, SolveTimeMs: wSub.SolveTimeMs,
			RatingChange: wChange, NewRating: wRating,
		},
		Loser: &PlayerResult{
			UserID: loserID.Hex(), Username: loser.Username,
			Code: lSub.Code, Language: lSub.Language,
			Score: lSub.WeightedScore, SolveTimeMs: lSub.SolveTimeMs,
			RatingChange: lChange, NewRating: lRating,
		},
	}, nil
}

func (m *Manager) getUser(ctx context.Context, userID primitive.ObjectID) (*models.User, error) {
	var user models.User
	if err := m.users.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

type MatchHistoryEntry struct {
	MatchID    string     `json:"matchId"`
	ProblemID  string     `json:"problemId"`
	Category   string     `json:"category"`
	Difficulty string     `json:"difficulty"`
	Mode       string     `json:"mode"`
	Status     string     `json:"status"`
	Phase      string     `json:"phase"`
	Won        *bool      `json:"won,omitempty"`
	IsDraw     bool       `json:"isDraw"`
	StartTime  time.Time  `json:"startTime"`
	EndTime    *time.Time `json:"endTime,omitempty"`
}

func (m *Manager) GetUserMatchHistory(ctx context.Context, userID primitive.ObjectID, limit int64) ([]MatchHistoryEntry, error) {
	if limit <= 0 {
		limit = 20
	}
	filter := bson.M{
		"$or": []bson.M{
			{"playerA": userID},
			{"playerB": userID},
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "startTime", Value: -1}}).SetLimit(limit)
	cur, err := m.matches.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	entries := make([]MatchHistoryEntry, 0)
	for cur.Next(ctx) {
		var match models.Match
		if err := cur.Decode(&match); err != nil {
			continue
		}
		entry := MatchHistoryEntry{
			MatchID:    match.ID.Hex(),
			ProblemID:  match.ProblemID,
			Category:   match.Category,
			Difficulty: match.Difficulty,
			Mode:       match.Mode,
			Status:     match.Status,
			Phase:      match.Phase,
			StartTime:  match.StartTime,
			EndTime:    match.EndTime,
		}
		if match.Status == models.MatchStatusFinished {
			entry.IsDraw = match.IsDraw
			if match.IsDraw {
				entry.Won = nil
			} else if match.Winner != nil {
				won := *match.Winner == userID
				entry.Won = &won
			}
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

type AdminStats struct {
	TotalUsers    int64 `json:"totalUsers"`
	ActiveMatches int64 `json:"activeMatches"`
	TotalProblems int64 `json:"totalProblems"`
}

type ActiveMatchSummary struct {
	MatchID    string    `json:"matchId"`
	ProblemID  string    `json:"problemId"`
	Category   string    `json:"category"`
	Difficulty string    `json:"difficulty"`
	Mode       string    `json:"mode"`
	Phase      string    `json:"phase"`
	StartTime  time.Time `json:"startTime"`
}

func (m *Manager) GetAdminStats(ctx context.Context) (*AdminStats, error) {
	active, _ := m.matches.CountDocuments(ctx, bson.M{"status": models.MatchStatusActive})
	problems, _ := m.problems.CountProblems(ctx)
	users, _ := m.users.CountDocuments(ctx, bson.M{})
	return &AdminStats{
		TotalUsers:    users,
		ActiveMatches: active,
		TotalProblems: problems,
	}, nil
}

func (m *Manager) ListActiveMatches(ctx context.Context) ([]ActiveMatchSummary, error) {
	cur, err := m.matches.Find(ctx, bson.M{"status": models.MatchStatusActive})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var list []ActiveMatchSummary
	for cur.Next(ctx) {
		var match models.Match
		if err := cur.Decode(&match); err != nil {
			continue
		}
		list = append(list, ActiveMatchSummary{
			MatchID:    match.ID.Hex(),
			ProblemID:  match.ProblemID,
			Category:   match.Category,
			Difficulty: match.Difficulty,
			Mode:       match.Mode,
			Phase:      match.Phase,
			StartTime:  match.StartTime,
		})
	}
	return list, nil
}
