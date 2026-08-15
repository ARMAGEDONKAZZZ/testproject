package profile

import "github.com/jackc/pgx/v5/pgxpool"

// Deps bundles the wired handlers for RegisterRoutes.
type Deps struct {
	Handlers *Handlers
}

// NewDeps wires the profile package's repository/service/handlers
// together. Called once from cmd/api/main.go.
func NewDeps(pool *pgxpool.Pool) Deps {
	repo := NewRepository(pool)
	service := NewService(repo)

	return Deps{
		Handlers: &Handlers{service: service},
	}
}
