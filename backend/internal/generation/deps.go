package generation

import (
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/fixtures"
)

// fixturesPath is where the shared mock puzzle fixture set lives, relative
// to the process's working directory. cmd/api is run from the `backend/`
// directory, so this matches fixtures/puzzles.json there.
const fixturesPath = "fixtures/puzzles.json"

// Deps wires the generation package's repository/service/handlers together.
// The loaded fixture Store is kept unexported and exposed only via
// Fixtures(), so cmd/api can hand it to internal/puzzle without that package
// loading fixtures/puzzles.json a second time.
type Deps struct {
	Handlers *Handlers
	store    *fixtures.Store
}

// NewDeps loads the shared fixture set and builds the generation package's
// repository/service/handlers. Called once from cmd/api/main.go. Failing to
// load fixtures is a fatal startup error — the entire generation feature is
// unusable without them (research.md: the mock generator is the only
// "AI generation" implementation shipped for this iteration).
func NewDeps(pool *pgxpool.Pool) Deps {
	store, err := fixtures.Load(fixturesPath)
	if err != nil {
		log.Fatalf("generation: failed to load fixtures: %v", err)
	}

	repo := NewRepository(pool)
	generator := NewMockGenerator(store, repo)
	service := NewService(repo, generator)

	return Deps{
		Handlers: &Handlers{service: service},
		store:    store,
	}
}

// Fixtures returns the fixture store loaded by this package. Used by
// cmd/api/main.go to pass the already-loaded store into puzzle.NewDeps.
func (d Deps) Fixtures() *fixtures.Store {
	return d.store
}
