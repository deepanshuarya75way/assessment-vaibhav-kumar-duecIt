package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                  string
	NodeEnv               string
	MongoURI              string
	MongoDB               string
	RedisURL              string
	CORSOrigins           []string
	AccessTokenSecret     string
	AccessTokenExpiry     time.Duration
	RefreshTokenSecret    string
	RefreshTokenExpiry    time.Duration
	PistonURL             string
	ReadPhaseSeconds       int
	CodingPhaseSeconds     int
	EloRange               int
	DisconnectGraceSeconds int
	FrontendURL            string
	APIBaseURL             string
	GoogleClientID         string
	GoogleClientSecret     string
	GitHubClientID         string
	GitHubClientSecret     string
}

func Load() *Config {
	return &Config{
		Port:                   getEnv("PORT", "8080"),
		NodeEnv:                getEnv("NODE_ENV", "development"),
		MongoURI:               getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:                getEnv("MONGO_DB", "duel_db"),
		RedisURL:               getEnv("REDIS_URL", "redis://localhost:6379"),
		CORSOrigins:            strings.Split(getEnv("CORS_ORIGIN", "http://localhost:3000"), ","),
		AccessTokenSecret:      mustEnv("ACCESS_TOKEN_SECRET"),
		AccessTokenExpiry:      parseDuration(getEnv("ACCESS_TOKEN_EXPIRY", "24h"), 24*time.Hour),
		RefreshTokenSecret:     mustEnv("REFRESH_TOKEN_SECRET"),
		RefreshTokenExpiry:     parseDuration(getEnv("REFRESH_TOKEN_EXPIRY", "168h"), 168*time.Hour),
		PistonURL:              getEnv("PISTON_URL", "https://emkc.org/api/v2/piston"),
		ReadPhaseSeconds:       getEnvInt("READ_PHASE_SECONDS", 45),
		CodingPhaseSeconds:     getEnvInt("CODING_PHASE_SECONDS", 600),
		EloRange:               getEnvInt("ELO_RANGE", 200),
		DisconnectGraceSeconds: getEnvInt("DISCONNECT_GRACE_SECONDS", 60),
		FrontendURL:            getEnv("FRONTEND_URL", "http://localhost:3000"),
		APIBaseURL:             getEnv("API_BASE_URL", "http://localhost:8080"),
		GoogleClientID:         getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:     getEnv("GOOGLE_CLIENT_SECRET", ""),
		GitHubClientID:         getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret:     getEnv("GITHUB_CLIENT_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		// Dev defaults — override in production
		switch key {
		case "ACCESS_TOKEN_SECRET":
			return "dev-access-token-secret-change-in-prod!!"
		case "REFRESH_TOKEN_SECRET":
			return "dev-refresh-token-secret-change-in-prod!!"
		}
	}
	return v
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
