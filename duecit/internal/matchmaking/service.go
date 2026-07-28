package matchmaking

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/duel"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type QueueEntry struct {
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	Rating     int    `json:"rating"`
	Category   string `json:"category"`
	Difficulty string `json:"difficulty"`
	Mode       string `json:"mode"`
	Language   string `json:"language"`
	JoinedAt   int64  `json:"joinedAt"`
}

type JoinResult struct {
	Queue   *QueueEntry             `json:"queue,omitempty"`
	Match   *duel.MatchFoundPayload `json:"match,omitempty"`
	InQueue bool                    `json:"inQueue"`
}

type DifficultyStats struct {
	Difficulty         string `json:"difficulty"`
	TotalQueued        int64  `json:"totalQueued"`
	CompetitiveQueued  int64  `json:"competitiveQueued"`
	PracticeQueued     int64  `json:"practiceQueued"`
	EstimatedWaitSec   int64  `json:"estimatedWaitSec"`
	PracticeBotTimeout int    `json:"practiceBotTimeoutSec"`
}

type QueueStats struct {
	Category     string            `json:"category"`
	TotalQueued  int64             `json:"totalQueued"`
	ByDifficulty []DifficultyStats `json:"byDifficulty"`
}

type Service struct {
	cfg      *config.Config
	rdb      *redis.Client
	users    *mongo.Collection
	problems *problems.Service
	duel     *duel.Manager
	hub      HubEmitter
}

type HubEmitter interface {
	EmitToUser(userID string, eventType string, data interface{})
}

func NewService(cfg *config.Config, rdb *redis.Client, users *mongo.Collection, prob *problems.Service, dm *duel.Manager, hub HubEmitter) *Service {
	return &Service{cfg: cfg, rdb: rdb, users: users, problems: prob, duel: dm, hub: hub}
}

func (s *Service) StartPoller(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.pollAllQueues(context.Background())
			}
		}
	}()
	log.Println("Matchmaking poller started")
}

func (s *Service) pollAllQueues(ctx context.Context) {
	keys, err := s.rdb.Keys(ctx, "queue:*:*:*").Result()
	if err != nil {
		return
	}
	for _, key := range keys {
		parts := strings.Split(key, ":")
		if len(parts) != 4 {
			continue
		}
		s.tryMatch(ctx, parts[1], parts[2], parts[3])
	}
}

func queueKey(category, difficulty, mode string) string {
	return fmt.Sprintf("queue:%s:%s:%s", category, difficulty, mode)
}

func (s *Service) JoinQueue(ctx context.Context, user *models.User, category, difficulty, mode, language string) (*JoinResult, error) {
	if category != models.CategoryDSA && category != models.CategoryDB {
		return nil, fmt.Errorf("invalid category")
	}
	if difficulty != "easy" && difficulty != "medium" && difficulty != "hard" {
		return nil, fmt.Errorf("invalid difficulty")
	}
	if mode != models.ModeCompetitive && mode != models.ModePractice {
		return nil, fmt.Errorf("invalid mode")
	}

	if active, err := s.duel.GetActiveMatchForUser(ctx, user.ID); err == nil && active != nil {
		return &JoinResult{Match: active, InQueue: false}, nil
	}

	key := queueKey(category, difficulty, mode)
	memberKey := fmt.Sprintf("queue:member:%s", user.ID.Hex())

	exists, _ := s.rdb.Exists(ctx, memberKey).Result()
	if exists > 0 {
		if active, err := s.duel.GetActiveMatchForUser(ctx, user.ID); err == nil && active != nil {
			return &JoinResult{Match: active, InQueue: false}, nil
		}
		_ = s.LeaveQueue(ctx, user.ID.Hex())
	}

	rating := user.RatingDSA
	if category == models.CategoryDB {
		rating = user.RatingDB
	}

	entry := QueueEntry{
		UserID:     user.ID.Hex(),
		Username:   user.Username,
		Rating:     rating,
		Category:   category,
		Difficulty: difficulty,
		Mode:       mode,
		Language:   language,
		JoinedAt:   time.Now().UnixMilli(),
	}

	data, _ := json.Marshal(entry)
	pipe := s.rdb.Pipeline()
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(entry.JoinedAt), Member: user.ID.Hex()})
	pipe.Set(ctx, memberKey, data, 30*time.Minute)
	pipe.Set(ctx, fmt.Sprintf("queue:data:%s", user.ID.Hex()), data, 30*time.Minute)
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}

	// Try matching immediately (sync) then async retry
	s.tryMatch(ctx, category, difficulty, mode)
	go s.tryMatch(context.Background(), category, difficulty, mode)

	if s.hub != nil {
		pos, _ := s.rdb.ZRank(ctx, key, user.ID.Hex()).Result()
		s.hub.EmitToUser(user.ID.Hex(), "queue:joined", map[string]interface{}{
			"position":   pos + 1,
			"category":   category,
			"difficulty": difficulty,
			"mode":       mode,
		})
	}

	result := &JoinResult{Queue: &entry, InQueue: true}
	if match, err := s.duel.PeekPendingMatch(ctx, user.ID.Hex()); err == nil && match != nil {
		result.Match = match
		result.InQueue = false
	}
	return result, nil
}

func (s *Service) GetPendingMatch(ctx context.Context, userID string) (*duel.MatchFoundPayload, error) {
	return s.duel.GetPendingMatch(ctx, userID)
}

func (s *Service) LeaveQueue(ctx context.Context, userID string) error {
	memberKey := fmt.Sprintf("queue:member:%s", userID)
	data, err := s.rdb.Get(ctx, memberKey).Bytes()
	if err != nil {
		return fmt.Errorf("not in queue")
	}
	var entry QueueEntry
	_ = json.Unmarshal(data, &entry)

	key := queueKey(entry.Category, entry.Difficulty, entry.Mode)
	pipe := s.rdb.Pipeline()
	pipe.ZRem(ctx, key, userID)
	pipe.Del(ctx, memberKey)
	pipe.Del(ctx, fmt.Sprintf("queue:data:%s", userID))
	_, err = pipe.Exec(ctx)
	return err
}

func (s *Service) GetQueueStatus(ctx context.Context, userID string) (*QueueEntry, int64, error) {
	data, err := s.rdb.Get(ctx, fmt.Sprintf("queue:data:%s", userID)).Bytes()
	if err != nil {
		return nil, 0, fmt.Errorf("not in queue")
	}
	var entry QueueEntry
	_ = json.Unmarshal(data, &entry)
	key := queueKey(entry.Category, entry.Difficulty, entry.Mode)
	pos, _ := s.rdb.ZRank(ctx, key, userID).Result()
	return &entry, pos + 1, nil
}

func (s *Service) tryMatch(ctx context.Context, category, difficulty, mode string) {
	key := queueKey(category, difficulty, mode)
	members, err := s.rdb.ZRange(ctx, key, 0, -1).Result()
	if err != nil {
		return
	}
	if len(members) < 2 {
		if mode == models.ModePractice {
			s.tryPracticeBotFallback(ctx, key, members, category, difficulty, mode)
		}
		return
	}

	var entries []QueueEntry
	for _, m := range members {
		data, err := s.rdb.Get(ctx, fmt.Sprintf("queue:data:%s", m)).Bytes()
		if err != nil {
			continue
		}
		var e QueueEntry
		if json.Unmarshal(data, &e) == nil {
			entries = append(entries, e)
		}
	}

	for i := 0; i < len(entries); i++ {
		p1 := entries[i]
		p2 := s.findOpponent(p1, entries[i+1:])
		if p2 == nil {
			continue
		}
		if err := s.createMatch(ctx, p1, *p2, category, difficulty, mode); err == nil {
			return
		}
	}
}

func (s *Service) tryPracticeBotFallback(ctx context.Context, key string, members []string, category, difficulty, mode string) {
	if len(members) == 0 || s.cfg.PracticeBotTimeoutSec <= 0 {
		return
	}
	playerID := members[0]
	data, err := s.rdb.Get(ctx, fmt.Sprintf("queue:data:%s", playerID)).Bytes()
	if err != nil {
		return
	}
	var player QueueEntry
	if json.Unmarshal(data, &player) != nil {
		return
	}
	waited := time.Since(time.UnixMilli(player.JoinedAt))
	if waited < time.Duration(s.cfg.PracticeBotTimeoutSec)*time.Second {
		return
	}

	lockKey := fmt.Sprintf("botmatch:lock:%s", playerID)
	ok, _ := s.rdb.SetNX(ctx, lockKey, "1", 10*time.Second).Result()
	if !ok {
		return
	}
	defer s.rdb.Del(ctx, lockKey)

	if _, err := s.rdb.ZRank(ctx, key, playerID).Result(); err == redis.Nil {
		return
	}

	bot, err := s.ensureBotUser(ctx, category, difficulty, player.Rating)
	if err != nil {
		log.Printf("matchmaking: bot user unavailable: %v", err)
		return
	}
	botRating := bot.RatingDSA
	if category == models.CategoryDB {
		botRating = bot.RatingDB
	}
	botEntry := QueueEntry{
		UserID:     bot.ID.Hex(),
		Username:   bot.Username,
		Rating:     botRating,
		Category:   category,
		Difficulty: difficulty,
		Mode:       mode,
		Language:   player.Language,
		JoinedAt:   time.Now().UnixMilli(),
	}
	botData, _ := json.Marshal(botEntry)
	pipe := s.rdb.Pipeline()
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(botEntry.JoinedAt), Member: botEntry.UserID})
	pipe.Set(ctx, fmt.Sprintf("queue:member:%s", botEntry.UserID), botData, time.Minute)
	pipe.Set(ctx, fmt.Sprintf("queue:data:%s", botEntry.UserID), botData, time.Minute)
	if _, err := pipe.Exec(ctx); err != nil {
		return
	}
	if err := s.createMatch(ctx, player, botEntry, category, difficulty, mode); err != nil {
		log.Printf("matchmaking: bot match failed: %v", err)
		_ = s.rdb.ZRem(ctx, key, botEntry.UserID).Err()
	}
}

func (s *Service) ensureBotUser(ctx context.Context, category, difficulty string, playerRating int) (*models.User, error) {
	username := fmt.Sprintf("duecit-bot-%s", difficulty)
	var existing models.User
	if err := s.users.FindOne(ctx, bson.M{"username": username}).Decode(&existing); err == nil {
		return &existing, nil
	}

	rating := playerRating
	if rating <= 0 {
		rating = 1000
	}
	switch difficulty {
	case "easy":
		if rating > 1050 {
			rating = 1050
		}
	case "medium":
		if rating < 950 {
			rating = 950
		}
		if rating > 1300 {
			rating = 1300
		}
	case "hard":
		if rating < 1150 {
			rating = 1150
		}
	}

	now := time.Now()
	user := models.User{
		Username:      username,
		Email:         fmt.Sprintf("%s@bots.duecit.local", username),
		RatingDSA:     rating,
		RatingDB:      rating,
		MatchesPlayed: 0,
		Wins:          0,
		Role:          models.RoleUser,
		OAuthProvider: "bot",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	res, err := s.users.InsertOne(ctx, user)
	if err != nil {
		if err := s.users.FindOne(ctx, bson.M{"username": username}).Decode(&existing); err == nil {
			return &existing, nil
		}
		return nil, err
	}
	user.ID = res.InsertedID.(primitive.ObjectID)
	return &user, nil
}

func (s *Service) QueueStats(ctx context.Context, category string) (*QueueStats, error) {
	if category == "" {
		category = models.CategoryDSA
	}
	if category != models.CategoryDSA && category != models.CategoryDB {
		return nil, fmt.Errorf("invalid category")
	}

	stats := &QueueStats{Category: category, ByDifficulty: make([]DifficultyStats, 0, 3)}
	for _, difficulty := range []string{"easy", "medium", "hard"} {
		competitive, _ := s.rdb.ZCard(ctx, queueKey(category, difficulty, models.ModeCompetitive)).Result()
		practice, _ := s.rdb.ZCard(ctx, queueKey(category, difficulty, models.ModePractice)).Result()
		total := competitive + practice
		stats.TotalQueued += total

		waitSec := int64(12)
		if total == 0 {
			waitSec = int64(s.cfg.PracticeBotTimeoutSec)
		} else if total == 1 {
			waitSec = int64(s.cfg.PracticeBotTimeoutSec / 2)
		}
		stats.ByDifficulty = append(stats.ByDifficulty, DifficultyStats{
			Difficulty:         difficulty,
			TotalQueued:        total,
			CompetitiveQueued:  competitive,
			PracticeQueued:     practice,
			EstimatedWaitSec:   waitSec,
			PracticeBotTimeout: s.cfg.PracticeBotTimeoutSec,
		})
	}
	return stats, nil
}

func (s *Service) findOpponent(player QueueEntry, candidates []QueueEntry) *QueueEntry {
	for _, c := range candidates {
		diff := player.Rating - c.Rating
		if diff < 0 {
			diff = -diff
		}
		if diff <= s.cfg.EloRange {
			return &c
		}
	}
	if len(candidates) > 0 {
		return &candidates[0]
	}
	return nil
}

func (s *Service) createMatch(ctx context.Context, p1, p2 QueueEntry, category, difficulty, mode string) error {
	uids := []string{p1.UserID, p2.UserID}
	sort.Strings(uids)
	lockKey := fmt.Sprintf("match:lock:%s:%s", uids[0], uids[1])
	ok, _ := s.rdb.SetNX(ctx, lockKey, "1", 10*time.Second).Result()
	if !ok {
		return fmt.Errorf("match lock failed")
	}
	defer s.rdb.Del(ctx, lockKey)

	key := queueKey(category, difficulty, mode)
	for _, uid := range []string{p1.UserID, p2.UserID} {
		if _, err := s.rdb.ZRank(ctx, key, uid).Result(); err == redis.Nil {
			return fmt.Errorf("player left queue")
		}
	}

	problem, err := s.problems.GetRandomProblem(ctx, category, difficulty)
	if err != nil {
		log.Printf("matchmaking: no problem for %s/%s: %v", category, difficulty, err)
		return err
	}

	playerAID, _ := primitive.ObjectIDFromHex(p1.UserID)
	playerBID, _ := primitive.ObjectIDFromHex(p2.UserID)

	_, err = s.duel.CreateMatch(ctx, duel.CreateMatchInput{
		PlayerA:        playerAID,
		PlayerB:        playerBID,
		Problem:        problem,
		Category:       category,
		Difficulty:     difficulty,
		Mode:           mode,
		Language:       p1.Language,
		ReadPhaseSec:   s.cfg.ReadPhaseSeconds,
		CodingPhaseSec: s.cfg.CodingPhaseSeconds,
		PlayerAName:    p1.Username,
		PlayerARating:  p1.Rating,
		PlayerAIsBot:   strings.HasPrefix(p1.Username, "duecit-bot-"),
		PlayerBName:    p2.Username,
		PlayerBRating:  p2.Rating,
		PlayerBIsBot:   strings.HasPrefix(p2.Username, "duecit-bot-"),
	})
	if err != nil {
		return err
	}

	pipe := s.rdb.Pipeline()
	pipe.ZRem(ctx, key, p1.UserID, p2.UserID)
	for _, uid := range []string{p1.UserID, p2.UserID} {
		pipe.Del(ctx, fmt.Sprintf("queue:member:%s", uid))
		pipe.Del(ctx, fmt.Sprintf("queue:data:%s", uid))
	}
	_, _ = pipe.Exec(ctx)

	log.Printf("Match created: %s vs %s (%s %s)", p1.Username, p2.Username, category, difficulty)
	return nil
}

func (s *Service) GetMatchByID(ctx context.Context, matchID primitive.ObjectID) (*models.Match, error) {
	return s.duel.GetMatch(ctx, matchID)
}
