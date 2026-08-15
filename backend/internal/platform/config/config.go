// Package config loads typed application configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	AppEnv            string
	HTTPPort          string
	DatabaseURL       string
	JWTAccessSecret   []byte
	JWTRefreshSecret  []byte
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	CORSAllowedOrigin string
	SMTPHost          string
	SMTPPort          string
	SMTPUser          string
	SMTPPassword      string
	SMTPFrom          string
}

// Load reads configuration from the environment. Required variables missing at
// startup fail fast rather than letting the server run with an invalid config.
func Load() (Config, error) {
	cfg := Config{
		AppEnv:            getEnvDefault("APP_ENV", "development"),
		HTTPPort:          getEnvDefault("HTTP_PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		CORSAllowedOrigin: getEnvDefault("CORS_ALLOWED_ORIGIN", "http://localhost:5173"),
		SMTPHost:          os.Getenv("SMTP_HOST"),
		SMTPPort:          getEnvDefault("SMTP_PORT", "1025"),
		SMTPUser:          os.Getenv("SMTP_USER"),
		SMTPPassword:      os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:          getEnvDefault("SMTP_FROM", "no-reply@neuratop.com"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	accessSecret := os.Getenv("JWT_ACCESS_SECRET")
	refreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if accessSecret == "" || refreshSecret == "" {
		return Config{}, fmt.Errorf("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required")
	}
	cfg.JWTAccessSecret = []byte(accessSecret)
	cfg.JWTRefreshSecret = []byte(refreshSecret)

	accessTTLMin, err := strconv.Atoi(getEnvDefault("ACCESS_TOKEN_TTL_MINUTES", "15"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid ACCESS_TOKEN_TTL_MINUTES: %w", err)
	}
	cfg.AccessTokenTTL = time.Duration(accessTTLMin) * time.Minute

	refreshTTLDays, err := strconv.Atoi(getEnvDefault("REFRESH_TOKEN_TTL_DAYS", "30"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid REFRESH_TOKEN_TTL_DAYS: %w", err)
	}
	cfg.RefreshTokenTTL = time.Duration(refreshTTLDays) * 24 * time.Hour

	return cfg, nil
}

func getEnvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
