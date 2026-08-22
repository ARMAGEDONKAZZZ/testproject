// Package generation implements the "AI Chess Puzzle Generation" domain
// (spec.md User Story 2, FR-013–023). Puzzles are sourced through the
// Generator interface — APIGenerator (api_generator.go) calls the real
// Neuratrap trainer recommendation API when PUZZLE_API_EMAIL/PASSWORD are
// configured; otherwise Deps falls back to the original fixture-backed
// MockGenerator (mock_generator.go), same self-gating pattern as SMTP_HOST.
package generation

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/puzzlemodel"
)

// Generator produces `count` puzzles for a generation request and persists
// them as `puzzles` rows tied to generationID. Implemented by MockGenerator
// (samples fixtures/puzzles.json) and APIGenerator (calls the external
// puzzle-recommendation API) — see deps.go for which one gets wired up.
type Generator interface {
	Generate(ctx context.Context, ownerUserID, generationID uuid.UUID, inputMode, payload string, count int) ([]puzzlemodel.Puzzle, error)
}

// Input modes accepted for a generation request (FR-013).
const (
	InputModeText   = "text"
	InputModeTag    = "tag"
	InputModeImage  = "image"
	InputModeFENPGN = "fen_pgn"
)

// Generation statuses (data-model.md state machine: pending -> succeeded |
// pending -> failed, terminal; a retry always creates a new row).
const (
	StatusPending   = "pending"
	StatusSucceeded = "succeeded"
	StatusFailed    = "failed"
)

// Generation mirrors the `generations` table (data-model.md). It represents
// one AI generation request: owner, input mode/payload, requested count,
// status, and (via the `puzzles.generation_id` FK) the resulting Puzzle rows.
type Generation struct {
	ID             uuid.UUID
	OwnerUserID    uuid.UUID
	InputMode      string
	InputPayload   string // raw text / tag id / image ref / FEN-PGN string — see repository.go for how this maps to the jsonb column.
	RequestedCount int16
	Status         string
	ErrorMessage   *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// APIView is the JSON shape returned to clients for a Generation.
type APIView struct {
	ID             uuid.UUID `json:"id"`
	InputMode      string    `json:"inputMode"`
	InputPayload   string    `json:"inputPayload"`
	RequestedCount int16     `json:"requestedCount"`
	Status         string    `json:"status"`
	ErrorMessage   *string   `json:"errorMessage,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (g Generation) ToAPIView() APIView {
	return APIView{
		ID:             g.ID,
		InputMode:      g.InputMode,
		InputPayload:   g.InputPayload,
		RequestedCount: g.RequestedCount,
		Status:         g.Status,
		ErrorMessage:   g.ErrorMessage,
		CreatedAt:      g.CreatedAt,
		UpdatedAt:      g.UpdatedAt,
	}
}
