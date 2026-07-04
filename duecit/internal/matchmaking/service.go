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
	"go.mongodb.org/mongo-driver/bson/primitive"
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
	Queue    *QueueEntry             `json:"queue,omitempty"`
	Match    *duel.MatchFoundPayload `json:"match,omitempty"`
	InQueue  bool                    `json:"inQueue"`
}

type Service struct {
	cfg      *config.Config
	rdb      *redis.Client
	problems *problems.Service
	duel     *duel.Manager
	hub      HubEmitter
}

type HubEmitter interface {
	EmitToUser(userID string, eventType string, data interface{})
}

func NewService(cfg *config.Config, rdb *redis.Client, prob *problems.Service, dm *duel.Manager, hub HubEmitter) *Service {
	return &Service{cfg: cfg, rdb: rdb, problems: prob, duel: dm, hub: hub}
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

	key := queueKey(category, difficulty, mode)
	memberKey := fmt.Sprintf("queue:member:%s", user.ID.Hex())

	exists, _ := s.rdb.Exists(ctx, memberKey).Result()
	if exists > 0 {
		return nil, fmt.Errorf("already in queue")
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
	if match, err := s.duel.GetPendingMatch(ctx, user.ID.Hex()); err == nil && match != nil {
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
	if err != nil || len(members) < 2 {
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
		PlayerBName:    p2.Username,
		PlayerBRating:  p2.Rating,
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
