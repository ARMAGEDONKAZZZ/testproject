package billing

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

type Deps struct {
	Handlers *Handlers
}

// NewDeps wires the billing package's repository/service/handlers together.
// Called once from cmd/api/main.go.
func NewDeps(pool *pgxpool.Pool) Deps {
	repo := NewRepository(pool)
	service := NewService(repo, pool)

	return Deps{
		Handlers: &Handlers{service: service},
	}
}
