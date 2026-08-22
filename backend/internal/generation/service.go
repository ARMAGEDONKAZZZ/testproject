package generation

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/neuratop/backend/internal/puzzlemodel"
)

var (
	// ErrMissingInput is FR-014: a generation request with no text/tag/image/
	// FEN-PGN payload must be rejected with a specific validation message.
	ErrMissingInput = errors.New("missing input")
	ErrInvalidMode  = errors.New("invalid input mode")
	ErrInvalidCount = errors.New("invalid count")
)

type Service struct {
	repo      *Repository
	generator Generator
}

func NewService(repo *Repository, generator Generator) *Service {
	return &Service{repo: repo, generator: generator}
}

type CreateGenerationInput struct {
	OwnerUserID uuid.UUID
	InputMode   string
	Payload     string
	Count       int16
}

// CreateGeneration validates the request (FR-014), inserts a `pending`
// generation row, and immediately returns it so the handler can respond
// 202 right away — the actual mock generation runs in a detached goroutine
// (runAsync) so the frontend has a real "pending" state to poll while a
// 3-step progress indicator is shown (FR-016), the same shape a real async
// AI-provider call would have.
func (s *Service) CreateGeneration(ctx context.Context, in CreateGenerationInput) (Generation, error) {
	if strings.TrimSpace(in.Payload) == "" {
		return Generation{}, ErrMissingInput
	}
	switch in.InputMode {
	case InputModeText, InputModeTag, InputModeImage, InputModeFENPGN:
	default:
		return Generation{}, ErrInvalidMode
	}
	if in.Count < 1 || in.Count > 4 {
		return Generation{}, ErrInvalidCount
	}

	g, err := s.repo.CreateGeneration(ctx, Generation{
		OwnerUserID:    in.OwnerUserID,
		InputMode:      in.InputMode,
		InputPayload:   in.Payload,
		RequestedCount: in.Count,
		Status:         StatusPending,
	})
	if err != nil {
		return Generation{}, err
	}

	s.runAsync(g.ID, in.OwnerUserID, in.InputMode, in.Payload, int(in.Count))

	return g, nil
}

// runAsync performs the generation in the background, using a detached
// context (the originating HTTP request has already returned by the time
// this runs). The short artificial delay gives the frontend's multi-step
// progress UI (FR-016: fetching patterns -> calibrating difficulty ->
// generating boards) something real to poll instead of resolving instantly.
func (s *Service) runAsync(generationID, ownerUserID uuid.UUID, inputMode, payload string, count int) {
	go func() {
		time.Sleep(1500 * time.Millisecond)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_, err := s.generator.Generate(ctx, ownerUserID, generationID, inputMode, payload, count)
		if err != nil {
			slog.Error("generation: puzzle generation failed", "error", err, "generationId", generationID)
			msg := "Не удалось сгенерировать задачи. Попробуйте ещё раз."
			if updErr := s.repo.UpdateStatus(ctx, generationID, StatusFailed, &msg); updErr != nil {
				slog.Error("generation: failed to mark generation failed", "error", updErr, "generationId", generationID)
			}
			return
		}
		if err := s.repo.UpdateStatus(ctx, generationID, StatusSucceeded, nil); err != nil {
			slog.Error("generation: failed to mark generation succeeded", "error", err, "generationId", generationID)
		}
	}()
}

// GetGeneration returns a generation and its resulting puzzles, scoped to
// the caller — a generation owned by another user is reported as not found
// rather than forbidden, so existence isn't leaked across accounts
// (Constitution III, same pattern as auth's no-enumeration login errors).
func (s *Service) GetGeneration(ctx context.Context, ownerUserID, id uuid.UUID) (Generation, []puzzlemodel.Puzzle, error) {
	g, err := s.repo.GetGeneration(ctx, id)
	if err != nil {
		return Generation{}, nil, err
	}
	if g.OwnerUserID != ownerUserID {
		return Generation{}, nil, ErrNotFound
	}
	puzzles, err := s.repo.ListPuzzlesByGeneration(ctx, id)
	if err != nil {
		return Generation{}, nil, err
	}
	return g, puzzles, nil
}

// CancelGeneration marks a still-pending generation as failed (FR-016).
// Cancelling a generation that has already reached a terminal state is a
// harmless no-op, since the state the caller wants (not pending) already
// holds.
//
// Decision: the task description that seeded this package suggested storing
// the literal English string "cancelled" in error_message. That value can
// flow straight back to the UI via GET /generations/:id, and the top-level
// project rule (and FR-063) requires user-facing text to be Russian — so a
// Russian message is used here instead; the semantic meaning (user-cancelled,
// not a generation failure) is unchanged.
func (s *Service) CancelGeneration(ctx context.Context, ownerUserID, id uuid.UUID) error {
	g, err := s.repo.GetGeneration(ctx, id)
	if err != nil {
		return err
	}
	if g.OwnerUserID != ownerUserID {
		return ErrNotFound
	}
	if g.Status != StatusPending {
		return nil
	}
	msg := "Генерация отменена пользователем"
	return s.repo.UpdateStatus(ctx, id, StatusFailed, &msg)
}

// ListGenerations returns one page of the caller's generation history
// (FR-023).
func (s *Service) ListGenerations(ctx context.Context, ownerUserID uuid.UUID, page, pageSize int) ([]Generation, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListGenerationsByOwner(ctx, ownerUserID, page, pageSize)
}

// RegeneratePuzzle creates a new one-puzzle generation using the same tag as
// an existing puzzle (FR-021: "regenerate/retry an individual puzzle from a
// result set without discarding the others" — the original puzzle row is
// left untouched; this simply starts a fresh generation).
func (s *Service) RegeneratePuzzle(ctx context.Context, ownerUserID, puzzleID uuid.UUID) (Generation, error) {
	p, err := s.repo.GetPuzzleByID(ctx, puzzleID)
	if err != nil {
		return Generation{}, err
	}
	if p.OwnerUserID != ownerUserID {
		return Generation{}, ErrNotFound
	}
	return s.CreateGeneration(ctx, CreateGenerationInput{
		OwnerUserID: ownerUserID,
		InputMode:   InputModeTag,
		Payload:     p.Tag,
		Count:       1,
	})
}

// GetPuzzleFEN returns the FEN of a puzzle the caller owns, for the "copy
// FEN" dialog (FR-020).
func (s *Service) GetPuzzleFEN(ctx context.Context, ownerUserID, puzzleID uuid.UUID) (string, error) {
	p, err := s.repo.GetPuzzleByID(ctx, puzzleID)
	if err != nil {
		return "", err
	}
	if p.OwnerUserID != ownerUserID {
		return "", ErrNotFound
	}
	return p.FEN, nil
}

// FromFEN starts a generation from a user-pasted FEN (FR-013, FR-020). Count
// defaults to 1 per the contract ("count defaults to 1 per Assumptions").
func (s *Service) FromFEN(ctx context.Context, ownerUserID uuid.UUID, fen string, count int16) (Generation, error) {
	if count < 1 {
		count = 1
	}
	return s.CreateGeneration(ctx, CreateGenerationInput{
		OwnerUserID: ownerUserID,
		InputMode:   InputModeFENPGN,
		Payload:     fen,
		Count:       count,
	})
}
