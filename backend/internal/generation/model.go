// Package generation implements the "AI Chess Puzzle Generation" domain
// (spec.md User Story 2, FR-013–023). Per research.md ("AI generation /
// chat / engine analysis") a real AI/chess-engine provider is deliberately
// deferred — the user will supply a custom engine later — so this package
// only ships a fixture-backed mock generator for now. The mock is built
// behind the same request/response contract a real provider would use, so
// swapping in a real implementation later touches only mock_generator.go.
package generation

import (
	"time"

	"github.com/google/uuid"
)

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
