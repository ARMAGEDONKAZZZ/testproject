// Package puzzleapi is a thin client for the external Neuratrap trainer
// puzzle-recommendation API (POST /users/auth, GET
// /api/v2/trainer/puzzles/recommend). It owns login + access-token caching
// so callers just ask for a puzzle.
package puzzleapi

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Client is safe for concurrent use — token refresh is serialized internally.
type Client struct {
	baseURL    string
	email      string
	password   string
	httpClient *http.Client

	mu          sync.Mutex
	accessToken string
	expiresAt   time.Time
}

func New(baseURL, email, password string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		email:      email,
		password:   password,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// RecommendedPuzzle mirrors GET /api/v2/trainer/puzzles/recommend's body.
// Fields with no consumer yet (Branches, Area, Mobility, ...) are kept for
// forward-compatibility even though this client doesn't use them today.
type RecommendedPuzzle struct {
	ID             int64   `json:"id"`
	FEN            string  `json:"fen"`
	Moves          string  `json:"moves"` // space-separated UCI plies, solver-first: "g4g5 h6h5 h8h7"
	IsMate         bool    `json:"isMate"`
	MateIn         int     `json:"mateIn"`
	Phase          string  `json:"phase"`
	Tactic         string  `json:"tactic"`
	RecommendedFor string  `json:"recommendedFor"`
	SolvingPiece   string  `json:"solvingPiece"`
	PuzzleLevel    int     `json:"puzzleLevel"`
	UserLevel      int     `json:"userLevel"`
	Pieces         int     `json:"pieces"`
	PiecesWhite    int     `json:"piecesWhite"`
	PiecesBlack    int     `json:"piecesBlack"`
	Area           float64 `json:"area"`
	Mobility       int     `json:"mobility"`
	SourceTable    string  `json:"sourceTable"`
	Branches       []any   `json:"branches"`
}

// Recommend fetches one personalized puzzle recommendation. The endpoint
// takes no filtering query params — confirmed by probing it with several
// guessed params (tactic/phase/tag), all silently ignored — so there is no
// way to request a specific category from this API today.
func (c *Client) Recommend(ctx context.Context) (*RecommendedPuzzle, error) {
	token, err := c.ensureToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("puzzleapi: authenticate: %w", err)
	}

	puzzle, status, err := c.doRecommend(ctx, token)
	if err != nil {
		return nil, err
	}
	if status == http.StatusUnauthorized {
		// Token might have been invalidated server-side despite a locally
		// unexpired exp claim — force one re-login and retry once.
		token, err = c.forceReauth(ctx)
		if err != nil {
			return nil, fmt.Errorf("puzzleapi: re-authenticate after 401: %w", err)
		}
		puzzle, status, err = c.doRecommend(ctx, token)
		if err != nil {
			return nil, err
		}
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("puzzleapi: recommend: unexpected status %d", status)
	}
	return puzzle, nil
}

func (c *Client) doRecommend(ctx context.Context, token string) (*RecommendedPuzzle, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v2/trainer/puzzles/recommend", nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("puzzleapi: recommend request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	var puzzle RecommendedPuzzle
	if err := json.NewDecoder(resp.Body).Decode(&puzzle); err != nil {
		return nil, 0, fmt.Errorf("puzzleapi: decode recommend response: %w", err)
	}
	return &puzzle, resp.StatusCode, nil
}

func (c *Client) ensureToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	// 60s safety margin so a token doesn't expire mid-flight.
	if c.accessToken != "" && time.Now().Add(60*time.Second).Before(c.expiresAt) {
		token := c.accessToken
		c.mu.Unlock()
		return token, nil
	}
	c.mu.Unlock()
	return c.forceReauth(ctx)
}

func (c *Client) forceReauth(ctx context.Context) (string, error) {
	token, exp, err := c.authenticate(ctx)
	if err != nil {
		return "", err
	}
	c.mu.Lock()
	c.accessToken = token
	c.expiresAt = exp
	c.mu.Unlock()
	return token, nil
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken string `json:"accessToken"`
}

func (c *Client) authenticate(ctx context.Context) (token string, expiresAt time.Time, err error) {
	body, err := json.Marshal(authRequest{Email: c.email, Password: c.password})
	if err != nil {
		return "", time.Time{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/users/auth", bytes.NewReader(body))
	if err != nil {
		return "", time.Time{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("auth request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", time.Time{}, fmt.Errorf("auth: unexpected status %d: %s", resp.StatusCode, respBody)
	}

	var auth authResponse
	if err := json.NewDecoder(resp.Body).Decode(&auth); err != nil {
		return "", time.Time{}, fmt.Errorf("decode auth response: %w", err)
	}
	if auth.AccessToken == "" {
		return "", time.Time{}, fmt.Errorf("auth response had no accessToken")
	}

	exp, err := jwtExpiry(auth.AccessToken)
	if err != nil {
		// Trust the token but don't cache blindly forever — fall back to a
		// conservative 5-minute TTL if the exp claim can't be read.
		return auth.AccessToken, time.Now().Add(5 * time.Minute), nil
	}
	return auth.AccessToken, exp, nil
}

// jwtExpiry reads the "exp" claim out of a JWT's payload segment without
// verifying the signature — we trust it because we just received it directly
// from the auth endpoint over TLS; this is purely to know when to re-login.
func jwtExpiry(token string) (time.Time, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}, fmt.Errorf("not a JWT (expected 3 segments, got %d)", len(parts))
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, fmt.Errorf("decode JWT payload: %w", err)
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return time.Time{}, fmt.Errorf("parse JWT claims: %w", err)
	}
	if claims.Exp == 0 {
		return time.Time{}, fmt.Errorf("JWT has no exp claim")
	}
	return time.Unix(claims.Exp, 0), nil
}
