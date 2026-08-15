package generation

import (
	"context"

	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/fixtures"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

// MockGenerator is the only "AI" generator implementation shipped for this
// iteration (research.md, "AI generation / chat / engine analysis": a real
// model/engine is deliberately deferred — the user will supply a custom
// engine later). It samples from the hand-verified fixtures.Store instead of
// calling any real AI/chess-engine provider, which keeps FR-017 satisfied by
// construction: every fixture is a real, legal, manually verified position.
type MockGenerator struct {
	store *fixtures.Store
	repo  *Repository
}

func NewMockGenerator(store *fixtures.Store, repo *Repository) *MockGenerator {
	return &MockGenerator{store: store, repo: repo}
}

// Generate samples `count` fixtures for the given generation request and
// persists them as `puzzles` rows tied to generationID.
//
// Documented mock-behavior decision: for input_mode = "tag" the payload is
// used directly as the fixture tag filter (fixtures.Store.Sample). For the
// other three modes (text/image/fen_pgn) there is no real NLP/vision/FEN
// parser behind the mock, so it simply samples from the whole fixture set
// without a tag filter — this keeps the mock indistinguishable from a real
// backend at the API-contract level; a real implementation would replace
// only this function's body.
func (g *MockGenerator) Generate(ctx context.Context, ownerUserID, generationID uuid.UUID, inputMode, payload string, count int) ([]puzzlemodel.Puzzle, error) {
	tag := ""
	if inputMode == InputModeTag {
		tag = payload
	}
	if count < 1 {
		count = 1
	}

	sampled := g.store.Sample(tag, count)
	puzzles := make([]puzzlemodel.Puzzle, 0, len(sampled))
	for _, fx := range sampled {
		p, err := g.repo.CreatePuzzleFromFixture(ctx, ownerUserID, &generationID, fx, nil, 0)
		if err != nil {
			return nil, err
		}
		puzzles = append(puzzles, p)
	}
	return puzzles, nil
}
