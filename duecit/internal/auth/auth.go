package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/pkg/response"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	cfg   *config.Config
	users *mongo.Collection
}

func NewService(cfg *config.Config, db *mongo.Database) *Service {
	return &Service{cfg: cfg, users: db.Collection("users")}
}

func (s *Service) Config() *config.Config {
	return s.cfg
}

func (s *Service) FrontendURL() string {
	return s.cfg.FrontendURL
}

func (s *Service) CountUsers(ctx context.Context) (int64, error) {
	return s.users.CountDocuments(ctx, bson.M{})
}

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func newPasswordResetToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	return token, hashPasswordResetToken(token), nil
}

func hashPasswordResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) GenerateAccessToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:   user.ID.Hex(),
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.cfg.AccessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.AccessTokenSecret))
}

func (s *Service) GenerateRefreshToken(user *models.User) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   user.ID.Hex(),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.cfg.RefreshTokenExpiry)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.RefreshTokenSecret))
}

func (s *Service) ParseAccessToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.AccessTokenSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *Service) ParseRefreshToken(tokenStr string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwt.RegisteredClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.RefreshTokenSecret), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid refresh token")
	}
	return claims.Subject, nil
}

func (s *Service) Register(ctx context.Context, username, email, password string) (*models.User, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	email = strings.ToLower(strings.TrimSpace(email))

	count, err := s.users.CountDocuments(ctx, bson.M{"$or": []bson.M{
		{"username": username},
		{"email": email},
	}})
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("user already exists")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := models.User{
		Username:      username,
		Email:         email,
		PasswordHash:  hash,
		RatingDSA:     1000,
		RatingDB:      1000,
		MatchesPlayed: 0,
		Role:          models.RoleUser,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	res, err := s.users.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}
	user.ID = res.InsertedID.(primitive.ObjectID)
	return &user, nil
}

func (s *Service) Login(ctx context.Context, login, password string) (*models.User, string, string, error) {
	login = strings.ToLower(strings.TrimSpace(login))
	var user models.User
	err := s.users.FindOne(ctx, bson.M{"$or": []bson.M{
		{"email": login},
		{"username": login},
	}}).Decode(&user)
	if err != nil {
		return nil, "", "", errors.New("invalid credentials")
	}
	if user.PasswordHash == "" {
		return nil, "", "", errors.New("use social login for this account")
	}
	if !CheckPassword(user.PasswordHash, password) {
		return nil, "", "", errors.New("invalid credentials")
	}

	access, err := s.GenerateAccessToken(&user)
	if err != nil {
		return nil, "", "", err
	}
	refresh, err := s.GenerateRefreshToken(&user)
	if err != nil {
		return nil, "", "", err
	}

	_, _ = s.users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
		"refreshToken": refresh,
		"updatedAt":    time.Now(),
	}})

	return &user, access, refresh, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (string, string, error) {
	userID, err := s.ParseRefreshToken(refreshToken)
	if err != nil {
		return "", "", errors.New("invalid refresh token")
	}
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return "", "", errors.New("invalid refresh token")
	}

	var user models.User
	err = s.users.FindOne(ctx, bson.M{"_id": oid}).Decode(&user)
	if err != nil {
		return "", "", errors.New("user not found")
	}
	if user.RefreshToken != refreshToken {
		return "", "", errors.New("invalid refresh token")
	}

	access, err := s.GenerateAccessToken(&user)
	if err != nil {
		return "", "", err
	}
	newRefresh, err := s.GenerateRefreshToken(&user)
	if err != nil {
		return "", "", err
	}

	_, _ = s.users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
		"refreshToken": newRefresh,
		"updatedAt":    time.Now(),
	}})

	return access, newRefresh, nil
}

func (s *Service) Logout(ctx context.Context, userID primitive.ObjectID) error {
	_, err := s.users.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$unset": bson.M{"refreshToken": ""}})
	return err
}

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil
	}

	var user models.User
	err := s.users.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil
		}
		return err
	}
	if user.PasswordHash == "" {
		return nil
	}

	token, tokenHash, err := newPasswordResetToken()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(s.cfg.PasswordResetExpiry)

	_, err = s.users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
		"passwordResetTokenHash": tokenHash,
		"passwordResetExpiresAt": expiresAt,
		"updatedAt":              time.Now(),
	}})
	if err != nil {
		return err
	}

	resetURL := s.cfg.FrontendURL + "/reset-password?token=" + url.QueryEscape(token)
	return s.SendPasswordResetEmail(ctx, &user, resetURL)
}

func (s *Service) ResetPassword(ctx context.Context, token, password string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("invalid or expired reset token")
	}

	passwordHash, err := HashPassword(password)
	if err != nil {
		return err
	}

	filter := bson.M{
		"passwordResetTokenHash": hashPasswordResetToken(token),
		"passwordResetExpiresAt": bson.M{"$gt": time.Now()},
	}
	update := bson.M{
		"$set": bson.M{
			"passwordHash": passwordHash,
			"updatedAt":    time.Now(),
		},
		"$unset": bson.M{
			"passwordResetTokenHash": "",
			"passwordResetExpiresAt": "",
			"refreshToken":           "",
		},
	}

	res, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("invalid or expired reset token")
	}
	return nil
}

func (s *Service) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	err := s.users.FindOne(ctx, bson.M{"username": strings.ToLower(strings.TrimSpace(username))}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) GetUser(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	var user models.User
	err := s.users.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(s *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Error(w, http.StatusUnauthorized, "Unauthorized")
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				response.Error(w, http.StatusUnauthorized, "Unauthorized")
				return
			}
			claims, err := s.ParseAccessToken(parts[1])
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "Invalid token")
				return
			}
			oid, err := primitive.ObjectIDFromHex(claims.UserID)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "Invalid token")
				return
			}
			user, err := s.GetUser(r.Context(), oid)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "User not found")
				return
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil || user.Role != models.RoleAdmin {
			response.Error(w, http.StatusForbidden, "Admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func UserFromContext(ctx context.Context) *models.User {
	user, _ := ctx.Value(UserContextKey).(*models.User)
	return user
}

func ParseWSToken(s *Service, token string) (*models.User, error) {
	claims, err := s.ParseAccessToken(token)
	if err != nil {
		return nil, err
	}
	oid, err := primitive.ObjectIDFromHex(claims.UserID)
	if err != nil {
		return nil, err
	}
	return s.GetUser(context.Background(), oid)
}
