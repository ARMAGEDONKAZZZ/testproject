package generation

import (
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/fixtures"
	"github.com/neuratop/backend/internal/puzzleapi"
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
// load fixtures is a fatal startup error — even when APIGenerator is active
// for new puzzles, the fixture store still backs the "Simplify" fallback
// (internal/puzzle/service.go findSimplifiedFixture) via Fixtures().
//
// Generator selection is config-driven, the same self-gating pattern as
// SMTP_HOST: when PUZZLE_API_EMAIL/PUZZLE_API_PASSWORD are set, puzzles come
// from the real external API (APIGenerator); otherwise generation falls back
// to the fixture-backed MockGenerator, so local/offline dev keeps working
// without those credentials configured.
func NewDeps(pool *pgxpool.Pool, puzzleAPIBaseURL, puzzleAPIEmail, puzzleAPIPassword string) Deps {
	store, err := fixtures.Load(fixturesPath)
	if err != nil {
		log.Fatalf("generation: failed to load fixtures: %v", err)
	}

	repo := NewRepository(pool)

	var generator Generator
	if puzzleAPIEmail != "" && puzzleAPIPassword != "" {
		client := puzzleapi.New(puzzleAPIBaseURL, puzzleAPIEmail, puzzleAPIPassword)
		generator = NewAPIGenerator(client, repo)
		log.Println("generation: sourcing puzzles from the external puzzle API")
	} else {
		generator = NewMockGenerator(store, repo)
		log.Println("generation: PUZZLE_API_EMAIL/PASSWORD not set — sourcing puzzles from local fixtures")
	}

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
