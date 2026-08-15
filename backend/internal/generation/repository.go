package generation

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/fixtures"
	"github.com/neuratop/backend/internal/puzzlemodel"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// --- generations ---

// CreateGeneration inserts a new generation row (always starting at
// g.Status, expected to be StatusPending by callers). InputPayload is
// stored in the jsonb `input_payload` column as a JSON-encoded string
// scalar (json.Marshal of a Go string produces a quoted JSON string, which
// is itself valid jsonb content) — kept deliberately simple since the mock
// generator never needs a structured payload (see mock_generator.go).
func (r *Repository) CreateGeneration(ctx context.Context, g Generation) (Generation, error) {
	payloadJSON, err := json.Marshal(g.InputPayload)
	if err != nil {
		return Generation{}, err
	}
	err = r.pool.QueryRow(ctx, `
		INSERT INTO generations (owner_user_id, input_mode, input_payload, requested_count, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`,
		g.OwnerUserID, g.InputMode, payloadJSON, g.RequestedCount, g.Status,
	).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return Generation{}, err
	}
	return g, nil
}

// UpdateStatus transitions a generation to a terminal (or still-pending)
// status and optionally records an error message. Callers never mutate a
// failed generation back to pending (data-model.md state transitions).
func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, errMsg *string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE generations SET status = $1, error_message = $2, updated_at = now() WHERE id = $3`,
		status, errMsg, id)
	return err
}

func (r *Repository) GetGeneration(ctx context.Context, id uuid.UUID) (Generation, error) {
	var g Generation
	var payloadJSON []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, owner_user_id, input_mode, input_payload, requested_count, status, error_message, created_at, updated_at
		FROM generations WHERE id = $1`, id,
	).Scan(&g.ID, &g.OwnerUserID, &g.InputMode, &payloadJSON, &g.RequestedCount, &g.Status, &g.ErrorMessage, &g.CreatedAt, &g.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Generation{}, ErrNotFound
	}
	if err != nil {
		return Generation{}, err
	}
	if err := json.Unmarshal(payloadJSON, &g.InputPayload); err != nil {
		return Generation{}, err
	}
	return g, nil
}

// ListGenerationsByOwner returns one page of a user's generation history
// (FR-023, "История генераций"), newest first, plus the total row count for
// pagination metadata.
func (r *Repository) ListGenerationsByOwner(ctx context.Context, ownerID uuid.UUID, page, pageSize int) ([]Generation, int, error) {
	offset := (page - 1) * pageSize
	rows, err := r.pool.Query(ctx, `
		SELECT id, owner_user_id, input_mode, input_payload, requested_count, status, error_message, created_at, updated_at
		FROM generations WHERE owner_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, ownerID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]Generation, 0)
	for rows.Next() {
		var g Generation
		var payloadJSON []byte
		if err := rows.Scan(&g.ID, &g.OwnerUserID, &g.InputMode, &payloadJSON, &g.RequestedCount, &g.Status, &g.ErrorMessage, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, 0, err
		}
		if err := json.Unmarshal(payloadJSON, &g.InputPayload); err != nil {
			return nil, 0, err
		}
		list = append(list, g)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM generations WHERE owner_user_id = $1`, ownerID).Scan(&total); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

// --- puzzles ---

// rowScanner is satisfied by both pgx.Row and pgx.Rows, letting scanPuzzle
// serve GetPuzzleByID (single row) and the list queries below.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanPuzzle(row rowScanner) (puzzlemodel.Puzzle, error) {
	var p puzzlemodel.Puzzle
	var evalJSON []byte
	err := row.Scan(
		&p.ID, &p.OwnerUserID, &p.GenerationID, &p.FEN, &p.SideToMove, &p.Objective,
		&p.SolutionLine, &p.Tag, &p.Description, &p.Difficulty, &p.SimplifiedFromID,
		&p.SimplifyDepth, &p.IsVerifiedLegal, &evalJSON, &p.CreatedAt,
	)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	if len(evalJSON) > 0 {
		var e puzzlemodel.MockEval
		if err := json.Unmarshal(evalJSON, &e); err != nil {
			return puzzlemodel.Puzzle{}, err
		}
		p.MockEval = &e
	}
	return p, nil
}

const puzzleColumns = `id, owner_user_id, generation_id, fen, side_to_move, objective, solution_line, tag,
	                    description, difficulty, simplified_from_id, simplify_depth, is_verified_legal, mock_eval, created_at`

// CreatePuzzleFromFixture inserts one `puzzles` row sourced from a
// hand-verified fixtures.Puzzle (FR-017: every mock-generated puzzle is a
// real, legal, manually verified position by construction). simplifiedFromID
// and simplifyDepth are non-nil/non-zero only when this row is the result of
// a "Упростить задачу" chain — the mock generator itself always passes
// (nil, 0) since it only ever creates fresh top-level puzzles.
func (r *Repository) CreatePuzzleFromFixture(ctx context.Context, ownerUserID uuid.UUID, generationID *uuid.UUID, fx fixtures.Puzzle, simplifiedFromID *uuid.UUID, simplifyDepth int16) (puzzlemodel.Puzzle, error) {
	evalJSON, err := json.Marshal(fx.MockEval)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	p := puzzlemodel.Puzzle{
		OwnerUserID:      ownerUserID,
		GenerationID:     generationID,
		FEN:              fx.FEN,
		SideToMove:       fx.SideToMove,
		Objective:        fx.Objective,
		SolutionLine:     fx.SolutionLine,
		Tag:              fx.Tag,
		Description:      fx.Description,
		Difficulty:       int16(fx.Difficulty),
		SimplifiedFromID: simplifiedFromID,
		SimplifyDepth:    simplifyDepth,
		IsVerifiedLegal:  true,
	}
	err = r.pool.QueryRow(ctx, `
		INSERT INTO puzzles (owner_user_id, generation_id, fen, side_to_move, objective, solution_line, tag,
		                      description, difficulty, simplified_from_id, simplify_depth, is_verified_legal, mock_eval)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at`,
		p.OwnerUserID, p.GenerationID, p.FEN, p.SideToMove, p.Objective, p.SolutionLine, p.Tag,
		p.Description, p.Difficulty, p.SimplifiedFromID, p.SimplifyDepth, p.IsVerifiedLegal, evalJSON,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	p.MockEval = &puzzlemodel.MockEval{
		Evaluation: fx.MockEval.Evaluation,
		BestMove:   fx.MockEval.BestMove,
		Depth:      fx.MockEval.Depth,
	}
	return p, nil
}

// ListPuzzlesByGeneration returns every puzzle produced by a generation, in
// the order they were created.
func (r *Repository) ListPuzzlesByGeneration(ctx context.Context, generationID uuid.UUID) ([]puzzlemodel.Puzzle, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+puzzleColumns+` FROM puzzles WHERE generation_id = $1 ORDER BY created_at ASC`, generationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]puzzlemodel.Puzzle, 0)
	for rows.Next() {
		p, err := scanPuzzle(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

func (r *Repository) GetPuzzleByID(ctx context.Context, id uuid.UUID) (puzzlemodel.Puzzle, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+puzzleColumns+` FROM puzzles WHERE id = $1`, id)
	p, err := scanPuzzle(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return puzzlemodel.Puzzle{}, ErrNotFound
	}
	if err != nil {
		return puzzlemodel.Puzzle{}, err
	}
	return p, nil
}
