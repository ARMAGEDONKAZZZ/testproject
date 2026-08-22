package puzzle

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/puzzlemodel"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// --- puzzles ---

// GetPuzzleByID reads a row from the `puzzles` table (owned/written by
// internal/generation, and by this package only for simplify-inserts — see
// InsertSimplifiedPuzzle). It deliberately does NOT select solution_line:
// that column is only ever read through the private getSolutionLine query
// below, so the answer never rides along on a puzzlemodel.Puzzle value that
// other packages/handlers also pass around (see task brief: solution_line
// must not leak into shared structures).
func (r *Repository) GetPuzzleByID(ctx context.Context, id uuid.UUID) (puzzlemodel.Puzzle, error) {
	var p puzzlemodel.Puzzle
	var mockEvalRaw []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, owner_user_id, generation_id, fen, side_to_move, objective, tag,
		       description, difficulty, simplified_from_id, simplify_depth,
		       is_verified_legal, mock_eval, created_at
		FROM puzzles WHERE id = $1`, id,
	).Scan(&p.ID, &p.OwnerUserID, &p.GenerationID, &p.FEN, &p.SideToMove, &p.Objective,
		&p.Tag, &p.Description, &p.Difficulty, &p.SimplifiedFromID, &p.SimplifyDepth,
		&p.IsVerifiedLegal, &mockEvalRaw, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return puzzlemodel.Puzzle{}, ErrNotFound
	}
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	if len(mockEvalRaw) > 0 {
		var eval puzzlemodel.MockEval
		if err := json.Unmarshal(mockEvalRaw, &eval); err != nil {
			return puzzlemodel.Puzzle{}, fmt.Errorf("decode mock_eval: %w", err)
		}
		p.MockEval = &eval
	}
	return p, nil
}

// getSolutionLine reads solution_line directly, bypassing
// puzzlemodel.Puzzle entirely (see GetPuzzleByID comment above) — an
// intentional, narrow access point used only by SubmitMove, RequestHint and
// RevealSolution.
func (r *Repository) getSolutionLine(ctx context.Context, puzzleID uuid.UUID) ([]string, error) {
	var line []string
	err := r.pool.QueryRow(ctx, `SELECT solution_line FROM puzzles WHERE id = $1`, puzzleID).Scan(&line)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return line, err
}

// InsertSimplifiedPuzzle creates the new, easier puzzle row produced by a
// "Упростить задачу" request (FR-026). This is the one case where this
// package writes to `puzzles` even though internal/generation owns that
// table otherwise — see task brief.
func (r *Repository) InsertSimplifiedPuzzle(ctx context.Context, p puzzlemodel.Puzzle) (puzzlemodel.Puzzle, error) {
	var mockEvalParam any
	if p.MockEval != nil {
		b, err := json.Marshal(p.MockEval)
		if err != nil {
			return puzzlemodel.Puzzle{}, err
		}
		mockEvalParam = string(b)
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO puzzles (owner_user_id, generation_id, fen, side_to_move, objective,
		                      solution_line, tag, description, difficulty,
		                      simplified_from_id, simplify_depth, is_verified_legal, mock_eval)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at`,
		p.OwnerUserID, p.GenerationID, p.FEN, p.SideToMove, p.Objective, p.SolutionLine,
		p.Tag, p.Description, p.Difficulty, p.SimplifiedFromID, p.SimplifyDepth,
		p.IsVerifiedLegal, mockEvalParam,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	return p, nil
}

// --- solve_attempts ---

func scanAttempt(row pgx.Row) (SolveAttempt, error) {
	var sa SolveAttempt
	var movesRaw []byte
	err := row.Scan(&sa.ID, &sa.PuzzleID, &sa.UserID, &movesRaw, &sa.Outcome, &sa.SolutionIndex,
		&sa.HintsUsed, &sa.SolutionRevealed, &sa.SimplifyCount, &sa.StartedAt, &sa.CompletedAt)
	if err != nil {
		return SolveAttempt{}, err
	}
	sa.Moves = []MoveRecord{}
	if len(movesRaw) > 0 {
		if err := json.Unmarshal(movesRaw, &sa.Moves); err != nil {
			return SolveAttempt{}, fmt.Errorf("decode moves: %w", err)
		}
	}
	return sa, nil
}

const attemptColumns = `id, puzzle_id, user_id, moves, outcome, solution_index, hints_used, solution_revealed,
	                     simplify_count, started_at, completed_at`

// FindInProgressAttempt returns the caller's in_progress attempt on this
// puzzle, if any — used by StartAttempt to make POST /puzzles/:id/attempts
// idempotent per the unique partial index idx_solve_attempts_one_in_progress
// (migrations/0001_init.sql).
func (r *Repository) FindInProgressAttempt(ctx context.Context, userID, puzzleID uuid.UUID) (SolveAttempt, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+attemptColumns+`
		FROM solve_attempts
		WHERE user_id = $1 AND puzzle_id = $2 AND outcome = 'in_progress'
		LIMIT 1`, userID, puzzleID)
	sa, err := scanAttempt(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return SolveAttempt{}, ErrNotFound
	}
	return sa, err
}

// CreateAttempt inserts a new solve_attempts row. It can fail with a unique
// violation (code 23505) if a concurrent request won the race to create the
// in_progress attempt first — the service layer handles that by re-selecting
// via FindInProgressAttempt.
func (r *Repository) CreateAttempt(ctx context.Context, userID, puzzleID uuid.UUID) (SolveAttempt, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO solve_attempts (puzzle_id, user_id)
		VALUES ($1, $2)
		RETURNING `+attemptColumns, puzzleID, userID)
	return scanAttempt(row)
}

func (r *Repository) GetAttemptByID(ctx context.Context, id uuid.UUID) (SolveAttempt, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+attemptColumns+` FROM solve_attempts WHERE id = $1`, id)
	sa, err := scanAttempt(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return SolveAttempt{}, ErrNotFound
	}
	return sa, err
}

// AppendMove appends one {move, correct} entry to solve_attempts.moves.
func (r *Repository) AppendMove(ctx context.Context, attemptID uuid.UUID, rec MoveRecord) error {
	payload, err := json.Marshal([]MoveRecord{rec})
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE solve_attempts SET moves = moves || $2::jsonb WHERE id = $1`,
		attemptID, string(payload))
	return err
}

// AdvanceSolutionIndex moves an in-progress attempt's solution_index forward
// past a correctly-played ply (and, when there's a forced opponent reply
// next, past that too) — see Service.SubmitMove.
func (r *Repository) AdvanceSolutionIndex(ctx context.Context, attemptID uuid.UUID, newIndex int16) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE solve_attempts SET solution_index = $2 WHERE id = $1`, attemptID, newIndex)
	return err
}

func (r *Repository) MarkSolved(ctx context.Context, attemptID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE solve_attempts SET outcome = 'solved', completed_at = now() WHERE id = $1`, attemptID)
	return err
}

func (r *Repository) MarkSolutionRevealed(ctx context.Context, attemptID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE solve_attempts
		SET outcome = 'solution_revealed', solution_revealed = true, completed_at = now()
		WHERE id = $1`, attemptID)
	return err
}

func (r *Repository) IncrementSimplifyCount(ctx context.Context, attemptID uuid.UUID) (int16, error) {
	var count int16
	err := r.pool.QueryRow(ctx, `
		UPDATE solve_attempts SET simplify_count = simplify_count + 1
		WHERE id = $1 RETURNING simplify_count`, attemptID).Scan(&count)
	return count, err
}

func (r *Repository) IncrementHintsUsed(ctx context.Context, attemptID uuid.UUID) (int16, error) {
	var count int16
	err := r.pool.QueryRow(ctx, `
		UPDATE solve_attempts SET hints_used = hints_used + 1
		WHERE id = $1 RETURNING hints_used`, attemptID).Scan(&count)
	return count, err
}

// getPuzzleTag reads just the tag column — used by BumpSkillAxis's caller
// so SubmitMove/RevealSolution don't need a full GetPuzzleByID round trip.
func (r *Repository) getPuzzleTag(ctx context.Context, puzzleID uuid.UUID) (string, error) {
	var tag string
	err := r.pool.QueryRow(ctx, `SELECT tag FROM puzzles WHERE id = $1`, puzzleID).Scan(&tag)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return tag, err
}

// BumpSkillAxis nudges the skill_profiles axis matching a puzzle's tag
// (owned/created by internal/profile — this package writes into it with its
// own narrow query, same cross-domain pattern as internal/puzzle reading
// billing's hint_packages table). Delta is clamped to [0, 100]; `overall`
// is recomputed as the mean of the five axes in the same statement so it
// never drifts out of sync. The row is upserted first since a user can
// solve a puzzle before ever visiting their profile page (which is what
// otherwise lazily creates this row). No-ops silently for a tag with no
// mapped axis (see skillAxisColumns).
func (r *Repository) BumpSkillAxis(ctx context.Context, userID uuid.UUID, tag string, delta int) error {
	// column is always one of skillAxisColumns' own fixed values, never
	// user input, so interpolating it into the column position is safe.
	column, ok := skillAxisColumns[tag]
	if !ok {
		return nil
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO skill_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
	); err != nil {
		return err
	}
	if _, err := r.pool.Exec(ctx, fmt.Sprintf(`
		UPDATE skill_profiles SET %s = LEAST(100, GREATEST(0, %s + $1)), updated_at = now()
		WHERE user_id = $2`, column, column),
		delta, userID,
	); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE skill_profiles
		SET overall = ROUND((tactics + strategy + openings + endgames + calculation) / 5.0)
		WHERE user_id = $1`, userID)
	return err
}

// --- puzzle_hints ---

func (r *Repository) InsertPuzzleHint(ctx context.Context, attemptID uuid.UUID, source string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO puzzle_hints (solve_attempt_id, source) VALUES ($1, $2)`, attemptID, source)
	return err
}

// --- favorite_items ---

func (r *Repository) AddFavorite(ctx context.Context, userID, puzzleID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO favorite_items (user_id, puzzle_id) VALUES ($1, $2)
		ON CONFLICT (user_id, puzzle_id) DO NOTHING`, userID, puzzleID)
	return err
}

func (r *Repository) RemoveFavorite(ctx context.Context, userID, puzzleID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM favorite_items WHERE user_id = $1 AND puzzle_id = $2`, userID, puzzleID)
	return err
}

// --- hint_packages (read-only; table is owned/seeded by internal/billing
// via migrations 0001/0002, see model.go HintPackageView doc) ---

func (r *Repository) ListHintPackages(ctx context.Context) ([]HintPackageView, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, label, hint_count, price_credits, is_featured
		FROM hint_packages ORDER BY sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	packages := make([]HintPackageView, 0, 3)
	for rows.Next() {
		var p HintPackageView
		if err := rows.Scan(&p.ID, &p.Label, &p.HintCount, &p.PriceCredits, &p.IsFeatured); err != nil {
			return nil, err
		}
		packages = append(packages, p)
	}
	return packages, rows.Err()
}
