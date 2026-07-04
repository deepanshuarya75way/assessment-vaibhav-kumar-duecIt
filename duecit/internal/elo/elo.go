package elo

import (
	"context"
	"math"

	"github.com/duecit/duecit/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var difficultyMultiplier = map[string]float64{
	"easy":   0.8,
	"medium": 1.0,
	"hard":   1.3,
}

func baseK(matchesPlayed int) float64 {
	if matchesPlayed < 20 {
		return 40
	}
	return 32
}

func expectedScore(playerRating, opponentRating float64) float64 {
	return 1.0 / (1.0 + math.Pow(10, (opponentRating-playerRating)/400))
}

func CalculateChange(playerRating, opponentRating int, didWin bool, isDraw bool, difficulty string, matchesPlayed int) int {
	k := baseK(matchesPlayed)
	if m, ok := difficultyMultiplier[difficulty]; ok {
		k *= m
	}
	exp := expectedScore(float64(playerRating), float64(opponentRating))
	var actual float64
	switch {
	case isDraw:
		actual = 0.5
	case didWin:
		actual = 1
	default:
		actual = 0
	}
	return int(math.Round(k * (actual - exp)))
}

type RatingUpdate struct {
	UserID    primitive.ObjectID
	Username  string
	OldRating int
	NewRating int
	Change    int
}

type Service struct {
	users *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{users: db.Collection("users")}
}

func (s *Service) GetRating(user *models.User, category string) int {
	if category == models.CategoryDB {
		return user.RatingDB
	}
	return user.RatingDSA
}

func ratingField(category string) string {
	if category == models.CategoryDB {
		return "ratingDB"
	}
	return "ratingDSA"
}

func (s *Service) UpdateRatings(ctx context.Context, winnerID, loserID primitive.ObjectID, category, difficulty string, isDraw bool) (*RatingUpdate, *RatingUpdate, error) {
	var winner, loser models.User
	if err := s.users.FindOne(ctx, bson.M{"_id": winnerID}).Decode(&winner); err != nil {
		return nil, nil, err
	}
	if err := s.users.FindOne(ctx, bson.M{"_id": loserID}).Decode(&loser); err != nil {
		return nil, nil, err
	}

	wRating := s.GetRating(&winner, category)
	lRating := s.GetRating(&loser, category)

	wChange := CalculateChange(wRating, lRating, !isDraw, isDraw, difficulty, winner.MatchesPlayed)
	lChange := CalculateChange(lRating, wRating, false, isDraw, difficulty, loser.MatchesPlayed)

	newWRating := wRating + wChange
	newLRating := lRating + lChange
	if newWRating < 100 {
		newWRating = 100
	}
	if newLRating < 100 {
		newLRating = 100
	}

	field := ratingField(category)
	_, _ = s.users.UpdateOne(ctx, bson.M{"_id": winnerID}, bson.M{"$set": bson.M{
		field:           newWRating,
		"matchesPlayed": winner.MatchesPlayed + 1,
	}})
	_, _ = s.users.UpdateOne(ctx, bson.M{"_id": loserID}, bson.M{"$set": bson.M{
		field:           newLRating,
		"matchesPlayed": loser.MatchesPlayed + 1,
	}})

	return &RatingUpdate{
			UserID: winnerID, Username: winner.Username,
			OldRating: wRating, NewRating: newWRating, Change: wChange,
		}, &RatingUpdate{
			UserID: loserID, Username: loser.Username,
			OldRating: lRating, NewRating: newLRating, Change: lChange,
		}, nil
}

func (s *Service) UpdateDraw(ctx context.Context, playerAID, playerBID primitive.ObjectID, category, difficulty string) (*RatingUpdate, *RatingUpdate, error) {
	return s.UpdateRatings(ctx, playerAID, playerBID, category, difficulty, true)
}
