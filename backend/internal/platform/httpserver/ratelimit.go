package httpserver

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter is a simple in-memory fixed-window limiter keyed by an
// arbitrary string (caller decides: IP, email, "email:purpose", etc.).
//
// This is process-local, which is a deliberate, documented limitation for
// the MVP's single-instance deployment (Constraints in plan.md); a
// multi-instance deployment would need a shared store (e.g. Redis) instead —
// tracked as a follow-up, not silently glossed over.
type RateLimiter struct {
	mu       sync.Mutex
	window   time.Duration
	limit    int
	attempts map[string][]time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		window:   window,
		limit:    limit,
		attempts: make(map[string][]time.Time),
	}
}

// Allow records one attempt for key and reports whether it is within the
// configured limit for the current window.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	var kept []time.Time
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}

	if len(kept) >= rl.limit {
		rl.attempts[key] = kept
		return false
	}

	kept = append(kept, now)
	rl.attempts[key] = kept
	return true
}

// Middleware wraps a handler, rejecting requests with 429 once keyFunc's
// return value has exceeded the limiter's budget. keyFunc typically combines
// remote IP with a route-specific value (e.g. the submitted email).
func (rl *RateLimiter) Middleware(keyFunc func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFunc(r)
			if !rl.Allow(key) {
				WriteError(w, http.StatusTooManyRequests, CodeRateLimited,
					"Слишком много попыток. Попробуйте позже.", nil)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
