package puzzle

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/neuratop/backend/internal/fixtures"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

var (
	ErrSimplifyLimitReached = errors.New("simplify limit reached")
	ErrHintsExhausted       = errors.New("hints exhausted")
	ErrExportNotImplemented = errors.New("export format not implemented")
	ErrInvalidExportFormat  = errors.New("invalid export format")
)

// fixtureScanLimit is a generous upper bound passed to fixtures.Store.Sample
// when we need to enumerate the *entire* fixture set (there are only ~12
// fixtures today, see fixtures/puzzles.json) rather than a random subset —
// Sample caps the result at the pool size, so any limit >= the true count
// works. See findSimplifiedFixture.
const fixtureScanLimit = 10000

type Service struct {
	repo     *Repository
	fixtures *fixtures.Store
}

func NewService(repo *Repository, fixtureStore *fixtures.Store) *Service {
	return &Service{repo: repo, fixtures: fixtureStore}
}

func (s *Service) GetPuzzle(ctx context.Context, id uuid.UUID) (puzzlemodel.Puzzle, error) {
	return s.repo.GetPuzzleByID(ctx, id)
}

func (s *Service) GetAttempt(ctx context.Context, id uuid.UUID) (SolveAttempt, error) {
	return s.repo.GetAttemptByID(ctx, id)
}

// StartAttempt is idempotent (rest-api.md: "returns existing in_progress
// attempt if one exists"): it first looks for an in_progress attempt on
// (userID, puzzleID) and only inserts a new one if none exists. The
// unique partial index idx_solve_attempts_one_in_progress
// (migrations/0001_init.sql) is the actual source of truth that prevents
// duplicates; if two requests race, the loser's INSERT hits a unique
// violation (23505) and we simply re-select the winner's row instead of
// surfacing an error to the caller.
func (s *Service) StartAttempt(ctx context.Context, userID, puzzleID uuid.UUID) (SolveAttempt, error) {
	if _, err := s.repo.GetPuzzleByID(ctx, puzzleID); err != nil {
		return SolveAttempt{}, err
	}

	existing, err := s.repo.FindInProgressAttempt(ctx, userID, puzzleID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return SolveAttempt{}, err
	}

	created, err := s.repo.CreateAttempt(ctx, userID, puzzleID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return s.repo.FindInProgressAttempt(ctx, userID, puzzleID)
		}
		return SolveAttempt{}, err
	}
	return created, nil
}

// MoveResult is the outcome of one submitted move.
type MoveResult struct {
	Correct bool
	Outcome string
	// OpponentMove is the forced reply (UCI, e.g. "h6h5") the caller should
	// auto-play before accepting the player's next move — set only when
	// Correct is true and solution_line has more plies after it. Empty when
	// the move was wrong, or when it was the last ply (Outcome == "solved").
	OpponentMove string
}

// SubmitMove compares move against the next expected ply of the puzzle's
// solution_line, solutionLine[attempt.SolutionIndex] — not always index 0,
// since solution_line can now hold a multi-ply sequence (solver move,
// forced opponent reply, solver move, ...; see
// internal/generation/api_generator.go). A correct move that isn't the last
// ply advances past the following forced opponent reply too and hands it
// back as OpponentMove for the caller to auto-play; the puzzle is "solved"
// (FR-024) only once the player has correctly played the final ply.
func (s *Service) SubmitMove(ctx context.Context, attemptID uuid.UUID, move string) (MoveResult, error) {
	attempt, err := s.repo.GetAttemptByID(ctx, attemptID)
	if err != nil {
		return MoveResult{}, err
	}
	solutionLine, err := s.repo.getSolutionLine(ctx, attempt.PuzzleID)
	if err != nil {
		return MoveResult{}, err
	}

	idx := int(attempt.SolutionIndex)
	correct := idx < len(solutionLine) &&
		strings.EqualFold(strings.TrimSpace(move), strings.TrimSpace(solutionLine[idx]))

	if err := s.repo.AppendMove(ctx, attemptID, MoveRecord{Move: move, Correct: correct}); err != nil {
		return MoveResult{}, err
	}

	result := MoveResult{Correct: correct, Outcome: attempt.Outcome}
	if !correct || attempt.Outcome != OutcomeInProgress {
		return result, nil
	}

	nextIdx := idx + 1
	if nextIdx >= len(solutionLine) {
		// That was the final ply.
		if err := s.repo.MarkSolved(ctx, attemptID); err != nil {
			return MoveResult{}, err
		}
		result.Outcome = OutcomeSolved

		// Real skill-progress signal (docs/design-audit/self-education.md
		// "Реализация"): solving unaided nudges the matching skill_profiles
		// axis up. Best-effort — a failure here must not fail the move the
		// player just correctly made.
		if tag, err := s.repo.getPuzzleTag(ctx, attempt.PuzzleID); err == nil {
			_ = s.repo.BumpSkillAxis(ctx, attempt.UserID, tag, SkillAxisDeltaSolved)
		}
		return result, nil
	}

	// There's a forced opponent reply at nextIdx; the player's next move
	// (if any) is the ply after that.
	advanceTo := nextIdx + 1
	if err := s.repo.AdvanceSolutionIndex(ctx, attemptID, int16(advanceTo)); err != nil {
		return MoveResult{}, err
	}
	result.OpponentMove = solutionLine[nextIdx]
	return result, nil
}

// Simplify implements FR-026's "Упростить задачу": bounded by SimplifyLimit,
// it produces a strictly easier puzzle row linked back to the current one.
func (s *Service) Simplify(ctx context.Context, attemptID uuid.UUID) (puzzlemodel.Puzzle, error) {
	attempt, err := s.repo.GetAttemptByID(ctx, attemptID)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	if attempt.SimplifyCount >= SimplifyLimit {
		return puzzlemodel.Puzzle{}, ErrSimplifyLimitReached
	}

	current, err := s.repo.GetPuzzleByID(ctx, attempt.PuzzleID)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}

	simpler, ok := s.findSimplifiedFixture(current.FEN)
	if !ok {
		// Fallback (documented mock-generator stand-in, not real AI
		// simplification): no fixture is configured with `simplifiesTo`
		// pointing away from a fixture matching this exact FEN — e.g. the
		// current puzzle is itself already a previously-simplified copy,
		// or its origin fixture has no simpler variant defined. Rather
		// than dead-end the "Упростить задачу" flow, hand back a random
		// fixture with the same tag so the user always gets *something*
		// playable.
		sample := s.fixtures.Sample(current.Tag, 1)
		if len(sample) == 0 {
			return puzzlemodel.Puzzle{}, fmt.Errorf("не удалось подобрать упрощённый вариант для этой задачи")
		}
		simpler = sample[0]
	}

	var mockEval *puzzlemodel.MockEval
	if simpler.MockEval != (fixtures.Eval{}) {
		mockEval = &puzzlemodel.MockEval{
			Evaluation: simpler.MockEval.Evaluation,
			BestMove:   simpler.MockEval.BestMove,
			Depth:      simpler.MockEval.Depth,
		}
	}

	newPuzzle := puzzlemodel.Puzzle{
		OwnerUserID:      current.OwnerUserID,
		GenerationID:     current.GenerationID,
		FEN:              simpler.FEN,
		SideToMove:       simpler.SideToMove,
		Objective:        simpler.Objective,
		SolutionLine:     simpler.SolutionLine,
		Tag:              simpler.Tag,
		Description:      simpler.Description,
		Difficulty:       int16(simpler.Difficulty),
		SimplifiedFromID: &current.ID,
		SimplifyDepth:    attempt.SimplifyCount + 1,
		IsVerifiedLegal:  true,
		MockEval:         mockEval,
	}

	created, err := s.repo.InsertSimplifiedPuzzle(ctx, newPuzzle)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	if _, err := s.repo.IncrementSimplifyCount(ctx, attemptID); err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	return created, nil
}

// findSimplifiedFixture locates the fixture whose FEN matches fen and
// returns *its* configured simpler variant (fixtures.Store.Simplified).
// puzzlemodel.Puzzle (the `puzzles` table) has no column tracking which
// fixture a row originated from, so FEN is the only stable join key
// available to this package — a documented limitation of the mock
// generator, not a real content-addressing scheme.
func (s *Service) findSimplifiedFixture(fen string) (fixtures.Puzzle, bool) {
	for _, f := range s.fixtures.Sample("", fixtureScanLimit) {
		if f.FEN == fen {
			return s.fixtures.Simplified(f.ID)
		}
	}
	return fixtures.Puzzle{}, false
}

// RequestHint implements FR-027: 3 free hints per puzzle, the 4th routes to
// the paywall (ErrHintsExhausted; the handler attaches the hint_packages
// catalog to that response). The hint text is a partial nudge — only the
// destination square of the first solution move — not the move itself.
func (s *Service) RequestHint(ctx context.Context, attemptID uuid.UUID) (hint string, hintsUsed int16, err error) {
	attempt, err := s.repo.GetAttemptByID(ctx, attemptID)
	if err != nil {
		return "", 0, err
	}
	if attempt.HintsUsed >= FreeHintsPerPuzzle {
		return "", attempt.HintsUsed, ErrHintsExhausted
	}

	solutionLine, err := s.repo.getSolutionLine(ctx, attempt.PuzzleID)
	if err != nil {
		return "", 0, err
	}
	hintText := buildPartialHint(solutionLine, int(attempt.SolutionIndex))

	newCount, err := s.repo.IncrementHintsUsed(ctx, attemptID)
	if err != nil {
		return "", 0, err
	}
	if err := s.repo.InsertPuzzleHint(ctx, attemptID, HintSourceFree); err != nil {
		return "", 0, err
	}
	return hintText, newCount, nil
}

// buildPartialHint gives a nudge — the destination square of the next
// expected solution move (solutionLine[idx], the player's current ply, not
// necessarily the first) — without revealing the move (piece, capture,
// check/mate markers) outright, per FR-027's intent that a hint should
// help, not solve, the puzzle.
func buildPartialHint(solutionLine []string, idx int) string {
	if idx < 0 || idx >= len(solutionLine) {
		return "Присмотритесь внимательнее к позиции — решающий ход где-то рядом."
	}
	dest := destinationSquare(solutionLine[idx])
	if dest == "" {
		return "Обратите внимание на самую активную фигуру в этой позиции."
	}
	return fmt.Sprintf("Обратите внимание на клетку %s — рядом с ней разворачивается решающее событие.", dest)
}

// destinationSquare pulls the destination square out of a move written in
// (simplified) algebraic notation, stripping check/mate/promotion markers.
// This is not a full SAN parser — fixtures only ever contain simple,
// unambiguous single moves like "Re8#", "Qb7#", "Rxa5" — just enough to
// take the trailing file+rank pair off shapes like these.
func destinationSquare(move string) string {
	move = strings.TrimSuffix(move, "+")
	move = strings.TrimSuffix(move, "#")
	if idx := strings.IndexByte(move, '='); idx != -1 {
		move = move[:idx]
	}
	if len(move) < 2 {
		return ""
	}
	return move[len(move)-2:]
}

// RevealSolution implements FR-028: the full solution line is returned and
// the attempt is marked solution_revealed (distinct from an independently
// solved puzzle, per FR-028/FR-033).
func (s *Service) RevealSolution(ctx context.Context, attemptID uuid.UUID) ([]string, error) {
	attempt, err := s.repo.GetAttemptByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}
	solutionLine, err := s.repo.getSolutionLine(ctx, attempt.PuzzleID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.MarkSolutionRevealed(ctx, attemptID); err != nil {
		return nil, err
	}

	// Giving up is real signal the axis needs more work — see SubmitMove's
	// symmetric bump on an unaided solve.
	if tag, err := s.repo.getPuzzleTag(ctx, attempt.PuzzleID); err == nil {
		_ = s.repo.BumpSkillAxis(ctx, attempt.UserID, tag, SkillAxisDeltaRevealed)
	}
	return solutionLine, nil
}

// GetAnalysis is a MOCKED engine-analysis read (rest-api.md: "Mocked
// per-fixture static values") — it returns the puzzle's stored mock_eval
// as-is, with no live engine involved.
func (s *Service) GetAnalysis(ctx context.Context, puzzleID uuid.UUID) (puzzlemodel.MockEval, error) {
	p, err := s.repo.GetPuzzleByID(ctx, puzzleID)
	if err != nil {
		return puzzlemodel.MockEval{}, err
	}
	if p.MockEval == nil {
		// No mock_eval stored for this row — return a clearly-labeled
		// placeholder instead of a zero-valued struct that could be
		// misread as a real "0.0" evaluation.
		return puzzlemodel.MockEval{Evaluation: "н/д", BestMove: "-", Depth: 0}, nil
	}
	return *p.MockEval, nil
}

func (s *Service) ToggleFavorite(ctx context.Context, userID, puzzleID uuid.UUID, add bool) error {
	if add {
		return s.repo.AddFavorite(ctx, userID, puzzleID)
	}
	return s.repo.RemoveFavorite(ctx, userID, puzzleID)
}

// Export formats supported by GET /puzzles/:id/export (FR-031).
const (
	ExportFormatFEN   = "fen"
	ExportFormatPGN   = "pgn"
	ExportFormatImage = "image"
)

type ExportResult struct {
	ContentType string
	Filename    string
	Body        []byte
}

// Export implements FR-031. "pgn" is a documented simplification — not a
// full PGN move-list converter, just a minimal, correctly-tagged PGN-shaped
// text file carrying the position via the standard FEN/SetUp tag pair.
// "image" is out of scope for the mock generator (no board-rendering
// service exists in this environment) and reports 501 via
// ErrExportNotImplemented.
func (s *Service) Export(ctx context.Context, puzzleID uuid.UUID, format string) (ExportResult, error) {
	switch format {
	case ExportFormatFEN, ExportFormatPGN, ExportFormatImage:
	default:
		return ExportResult{}, ErrInvalidExportFormat
	}

	p, err := s.repo.GetPuzzleByID(ctx, puzzleID)
	if err != nil {
		return ExportResult{}, err
	}

	switch format {
	case ExportFormatFEN:
		return ExportResult{
			ContentType: "text/plain; charset=utf-8",
			Filename:    "puzzle.fen",
			Body:        []byte(p.FEN),
		}, nil
	case ExportFormatPGN:
		pgn := fmt.Sprintf("[Event \"Neuratop\"]\n[SetUp \"1\"]\n[FEN \"%s\"]\n\n*\n", p.FEN)
		return ExportResult{
			ContentType: "application/x-chess-pgn; charset=utf-8",
			Filename:    "puzzle.pgn",
			Body:        []byte(pgn),
		}, nil
	default: // ExportFormatImage
		return ExportResult{}, ErrExportNotImplemented
	}
}
