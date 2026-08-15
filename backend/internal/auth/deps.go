package auth

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/platform/config"
	"github.com/neuratop/backend/internal/platform/httpserver"
)

type Handlers struct {
	service      *Service
	loginLimiter *httpserver.RateLimiter
	codeLimiter  *httpserver.RateLimiter
}

type Deps struct {
	Handlers *Handlers
}

// NewDeps wires the auth package's repository/service/handlers together.
// Called once from cmd/api/main.go.
func NewDeps(pool *pgxpool.Pool, cfg config.Config, access httpserver.TokenIssuer) Deps {
	repo := NewRepository(pool)
	mailer := NewMailer(cfg)
	service := NewService(repo, mailer, cfg, access)

	return Deps{
		Handlers: &Handlers{
			service: service,
			// FR-007: 5 failed attempts / 15 minutes per key (IP+email).
			loginLimiter: httpserver.NewRateLimiter(5, 15*time.Minute),
			// FR-009: resend cooldown for registration/reset codes.
			codeLimiter: httpserver.NewRateLimiter(1, 45*time.Second),
		},
	}
}
