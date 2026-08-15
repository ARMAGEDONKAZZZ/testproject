package puzzle

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/fixtures"
)

type Deps struct {
	Handlers *Handlers
}

// NewDeps wires the puzzle package's repository/service/handlers together.
// Called once from cmd/api/main.go, which hands in the same *fixtures.Store
// the generation package uses (both packages read the same read-only mock
// fixture set — see internal/fixtures).
func NewDeps(pool *pgxpool.Pool, fixtureStore *fixtures.Store) Deps {
	repo := NewRepository(pool)
	service := NewService(repo, fixtureStore)

	return Deps{
		Handlers: &Handlers{
			service: service,
			repo:    repo,
		},
	}
}
