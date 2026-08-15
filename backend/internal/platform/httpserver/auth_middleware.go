package httpserver

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type ctxKey int

const (
	ctxKeyUserID ctxKey = iota
	ctxKeyAgeTier
)

// RequireAuth verifies the Bearer access token and injects the caller's user
// id / age tier into the request context. Every domain handler that needs an
// authenticated caller is wrapped with this middleware in router.go — no
// handler re-implements token verification itself (Constitution III/IV).
func RequireAuth(issuer TokenIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				WriteUnauthenticated(w, "Требуется авторизация")
				return
			}
			token := strings.TrimPrefix(header, "Bearer ")
			claims, err := issuer.Verify(token)
			if err != nil {
				WriteUnauthenticated(w, "Недействительный или истёкший токен")
				return
			}
			ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ctxKeyAgeTier, claims.AgeTier)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext returns the authenticated caller's id. It MUST only be
// called on routes mounted behind RequireAuth.
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(ctxKeyUserID).(uuid.UUID)
	return id, ok
}

// AgeTierFromContext returns the authenticated caller's age tier as recorded
// in their access token at issuance time. Handlers that need the *current*
// (possibly since-changed) tier MUST re-read it from the database instead —
// this is only a fast UX hint, never the authorization source of truth.
func AgeTierFromContext(ctx context.Context) (string, bool) {
	tier, ok := ctx.Value(ctxKeyAgeTier).(string)
	return tier, ok
}
