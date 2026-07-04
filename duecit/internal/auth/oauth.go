package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

type OAuthUserInfo struct {
	ID        string
	Email     string
	Username  string
	AvatarURL string
}

func (s *Service) apiBaseURL() string {
	if s.cfg.APIBaseURL != "" {
		return strings.TrimRight(s.cfg.APIBaseURL, "/")
	}
	port := s.cfg.Port
	if port == "" {
		port = "8080"
	}
	return fmt.Sprintf("http://localhost:%s", port)
}

func (s *Service) GoogleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.GoogleClientID,
		ClientSecret: s.cfg.GoogleClientSecret,
		RedirectURL:  s.apiBaseURL() + "/api/auth/oauth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

func (s *Service) GitHubOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.GitHubClientID,
		ClientSecret: s.cfg.GitHubClientSecret,
		RedirectURL:  s.apiBaseURL() + "/api/auth/oauth/github/callback",
		Scopes:       []string{"read:user", "user:email"},
		Endpoint:     github.Endpoint,
	}
}

func (s *Service) OAuthRedirectURL(provider string) (string, error) {
	var cfg *oauth2.Config
	switch provider {
	case "google":
		if s.cfg.GoogleClientID == "" {
			return "", errors.New("Google OAuth not configured")
		}
		cfg = s.GoogleOAuthConfig()
	case "github":
		if s.cfg.GitHubClientID == "" {
			return "", errors.New("GitHub OAuth not configured")
		}
		cfg = s.GitHubOAuthConfig()
	default:
		return "", errors.New("unsupported provider")
	}
	return cfg.AuthCodeURL(provider + "-state"), nil
}

func (s *Service) HandleOAuthCallback(ctx context.Context, provider, code string) (*models.User, string, string, error) {
	var cfg *oauth2.Config
	var fetchInfo func(context.Context, *oauth2.Config, string) (*OAuthUserInfo, error)

	switch provider {
	case "google":
		if s.cfg.GoogleClientID == "" {
			return nil, "", "", errors.New("Google OAuth not configured")
		}
		cfg = s.GoogleOAuthConfig()
		fetchInfo = fetchGoogleUser
	case "github":
		if s.cfg.GitHubClientID == "" {
			return nil, "", "", errors.New("GitHub OAuth not configured")
		}
		cfg = s.GitHubOAuthConfig()
		fetchInfo = fetchGitHubUser
	default:
		return nil, "", "", errors.New("unsupported provider")
	}

	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, "", "", fmt.Errorf("oauth exchange failed: %w", err)
	}

	info, err := fetchInfo(ctx, cfg, token.AccessToken)
	if err != nil {
		return nil, "", "", err
	}

	user, err := s.FindOrCreateOAuthUser(ctx, provider, info)
	if err != nil {
		return nil, "", "", err
	}

	access, err := s.GenerateAccessToken(user)
	if err != nil {
		return nil, "", "", err
	}
	refresh, err := s.GenerateRefreshToken(user)
	if err != nil {
		return nil, "", "", err
	}

	_, _ = s.users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
		"refreshToken": refresh,
		"updatedAt":    time.Now(),
	}})

	return user, access, refresh, nil
}

func (s *Service) FindOrCreateOAuthUser(ctx context.Context, provider string, info *OAuthUserInfo) (*models.User, error) {
	var existing models.User
	err := s.users.FindOne(ctx, bson.M{
		"oauthProvider": provider,
		"oauthId":       info.ID,
	}).Decode(&existing)
	if err == nil {
		if info.AvatarURL != "" && existing.AvatarURL != info.AvatarURL {
			_, _ = s.users.UpdateOne(ctx, bson.M{"_id": existing.ID}, bson.M{"$set": bson.M{
				"avatarUrl": info.AvatarURL,
				"updatedAt": time.Now(),
			}})
			existing.AvatarURL = info.AvatarURL
		}
		return &existing, nil
	}

	username := sanitizeUsername(info.Username)
	if username == "" {
		username = strings.Split(info.Email, "@")[0]
	}
	username = sanitizeUsername(username)
	base := username
	for i := 0; ; i++ {
		candidate := username
		if i > 0 {
			candidate = fmt.Sprintf("%s%d", base, i)
		}
		count, _ := s.users.CountDocuments(ctx, bson.M{"username": candidate})
		if count == 0 {
			username = candidate
			break
		}
	}

	email := strings.ToLower(strings.TrimSpace(info.Email))
	if email == "" {
		email = fmt.Sprintf("%s@%s.oauth", info.ID, provider)
	}

	now := time.Now()
	user := models.User{
		Username:      username,
		Email:         email,
		RatingDSA:     1000,
		RatingDB:      1000,
		MatchesPlayed: 0,
		Role:          models.RoleUser,
		OAuthProvider: provider,
		OAuthID:       info.ID,
		AvatarURL:     info.AvatarURL,
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

func sanitizeUsername(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 20 {
		out = out[:20]
	}
	return out
}

func fetchGoogleUser(ctx context.Context, _ *oauth2.Config, accessToken string) (*OAuthUserInfo, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var data struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	username := sanitizeUsername(strings.ReplaceAll(data.Name, " ", "_"))
	return &OAuthUserInfo{
		ID: data.ID, Email: data.Email, Username: username, AvatarURL: data.Picture,
	}, nil
}

func fetchGitHubUser(ctx context.Context, _ *oauth2.Config, accessToken string) (*OAuthUserInfo, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var data struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	email := data.Email
	if email == "" {
		req2, _ := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user/emails", nil)
		req2.Header.Set("Authorization", "Bearer "+accessToken)
		req2.Header.Set("Accept", "application/json")
		resp2, err := http.DefaultClient.Do(req2)
		if err == nil {
			defer resp2.Body.Close()
			var emails []struct {
				Email   string `json:"email"`
				Primary bool   `json:"primary"`
			}
			_ = json.NewDecoder(resp2.Body).Decode(&emails)
			for _, e := range emails {
				if e.Primary {
					email = e.Email
					break
				}
			}
			if email == "" && len(emails) > 0 {
				email = emails[0].Email
			}
		}
	}

	return &OAuthUserInfo{
		ID: fmt.Sprintf("%d", data.ID), Email: email, Username: data.Login, AvatarURL: data.AvatarURL,
	}, nil
}

func OAuthConfigured(cfg *config.Config, provider string) bool {
	switch provider {
	case "google":
		return cfg.GoogleClientID != "" && cfg.GoogleClientSecret != ""
	case "github":
		return cfg.GitHubClientID != "" && cfg.GitHubClientSecret != ""
	default:
		return false
	}
}
