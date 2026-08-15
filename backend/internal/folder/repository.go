package folder

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuratop/backend/internal/puzzlemodel"
)

// ErrNotFound is returned by every repository lookup that finds no row.
var ErrNotFound = errors.New("not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const folderColumns = `id, owner_user_id, name, visibility, share_slug, share_password_hash, created_at, updated_at`

func scanFolder(row pgx.Row) (Folder, error) {
	var f Folder
	err := row.Scan(&f.ID, &f.OwnerUserID, &f.Name, &f.Visibility, &f.ShareSlug, &f.SharePasswordHash, &f.CreatedAt, &f.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Folder{}, ErrNotFound
	}
	if err != nil {
		return Folder{}, err
	}
	return f, nil
}

// --- folders ---

func (r *Repository) CreateFolder(ctx context.Context, ownerID uuid.UUID, name, visibility string) (Folder, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO folders (owner_user_id, name, visibility)
		VALUES ($1, $2, $3)
		RETURNING `+folderColumns,
		ownerID, name, visibility,
	)
	return scanFolder(row)
}

func (r *Repository) GetFolderByID(ctx context.Context, id uuid.UUID) (Folder, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+folderColumns+` FROM folders WHERE id = $1`, id)
	return scanFolder(row)
}

func (r *Repository) GetFolderBySlug(ctx context.Context, slug string) (Folder, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+folderColumns+` FROM folders WHERE share_slug = $1`, slug)
	return scanFolder(row)
}

// UpdateFolder patches name and/or visibility; a nil pointer leaves the
// existing column value untouched (COALESCE).
func (r *Repository) UpdateFolder(ctx context.Context, id uuid.UUID, name, visibility *string) (Folder, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE folders
		SET name = COALESCE($1, name),
		    visibility = COALESCE($2, visibility),
		    updated_at = now()
		WHERE id = $3
		RETURNING `+folderColumns,
		name, visibility, id,
	)
	return scanFolder(row)
}

// SetShare stores a freshly generated share slug and (optional) password
// hash for a folder (FR-058/059).
func (r *Repository) SetShare(ctx context.Context, id uuid.UUID, slug string, passwordHash *string) (Folder, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE folders
		SET share_slug = $1, share_password_hash = $2, updated_at = now()
		WHERE id = $3
		RETURNING `+folderColumns,
		slug, passwordHash, id,
	)
	return scanFolder(row)
}

// DeleteFolder removes only the folders row. folder_items rows cascade via
// the FK's ON DELETE CASCADE; the puzzles themselves are untouched (FR-038).
func (r *Repository) DeleteFolder(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM folders WHERE id = $1`, id)
	return err
}

// ListFoldersByOwner returns every folder owned by ownerID with its live
// folder_items count, oldest first.
func (r *Repository) ListFoldersByOwner(ctx context.Context, ownerID uuid.UUID) ([]FolderSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT f.id, f.owner_user_id, f.name, f.visibility, f.share_slug, f.share_password_hash,
		       f.created_at, f.updated_at, COUNT(fi.puzzle_id)
		FROM folders f
		LEFT JOIN folder_items fi ON fi.folder_id = f.id
		WHERE f.owner_user_id = $1
		GROUP BY f.id
		ORDER BY f.created_at ASC`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []FolderSummary
	for rows.Next() {
		var s FolderSummary
		if err := rows.Scan(&s.ID, &s.OwnerUserID, &s.Name, &s.Visibility, &s.ShareSlug,
			&s.SharePasswordHash, &s.CreatedAt, &s.UpdatedAt, &s.ItemCount); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// --- folder items ---

// AddFolderItems inserts (folder_id, puzzle_id) pairs, ignoring rows already
// present (FR-036: all three add-to-folder UX paths converge on this one
// idempotent operation).
func (r *Repository) AddFolderItems(ctx context.Context, folderID uuid.UUID, puzzleIDs []uuid.UUID) error {
	if len(puzzleIDs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, pid := range puzzleIDs {
		batch.Queue(`INSERT INTO folder_items (folder_id, puzzle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, folderID, pid)
	}
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range puzzleIDs {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) RemoveFolderItem(ctx context.Context, folderID, puzzleID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM folder_items WHERE folder_id = $1 AND puzzle_id = $2`, folderID, puzzleID)
	return err
}

const puzzleColumns = `p.id, p.fen, p.side_to_move, p.objective, p.tag, p.description, p.difficulty, p.created_at`

func scanPuzzles(rows pgx.Rows) ([]puzzlemodel.Puzzle, error) {
	defer rows.Close()
	var out []puzzlemodel.Puzzle
	for rows.Next() {
		var p puzzlemodel.Puzzle
		if err := rows.Scan(&p.ID, &p.FEN, &p.SideToMove, &p.Objective, &p.Tag, &p.Description, &p.Difficulty, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListFolderItems returns every puzzle currently in folderID, newest-added first.
func (r *Repository) ListFolderItems(ctx context.Context, folderID uuid.UUID) ([]puzzlemodel.Puzzle, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+puzzleColumns+`
		FROM folder_items fi
		JOIN puzzles p ON p.id = fi.puzzle_id
		WHERE fi.folder_id = $1
		ORDER BY fi.added_at DESC`, folderID)
	if err != nil {
		return nil, err
	}
	return scanPuzzles(rows)
}

// --- favorites ---

// ListFavorites returns userID's favorited puzzles, optionally filtered by
// tactical tag and/or side-to-move (FR-040). It reads favorite_items and
// puzzles directly via SQL rather than importing the puzzle package — each
// package that needs the shared tables reads them independently by design
// (see internal/puzzlemodel doc comment).
func (r *Repository) ListFavorites(ctx context.Context, userID uuid.UUID, tag, sideToMove *string) ([]puzzlemodel.Puzzle, error) {
	query := `
		SELECT ` + puzzleColumns + `
		FROM favorite_items fav
		JOIN puzzles p ON p.id = fav.puzzle_id
		WHERE fav.user_id = $1`
	args := []any{userID}

	if tag != nil && *tag != "" {
		args = append(args, *tag)
		query += fmt.Sprintf(" AND p.tag = $%d", len(args))
	}
	if sideToMove != nil && *sideToMove != "" {
		args = append(args, *sideToMove)
		query += fmt.Sprintf(" AND p.side_to_move = $%d", len(args))
	}
	query += " ORDER BY fav.added_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return scanPuzzles(rows)
}

// --- history ---

// ListHistory returns a page of ownerID's generated puzzles, newest first
// (FR-034), plus the total count for pagination metadata.
func (r *Repository) ListHistory(ctx context.Context, ownerID uuid.UUID, page, pageSize int) ([]puzzlemodel.Puzzle, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM puzzles WHERE owner_user_id = $1`, ownerID).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	rows, err := r.pool.Query(ctx, `
		SELECT id, fen, side_to_move, objective, tag, description, difficulty, created_at
		FROM puzzles
		WHERE owner_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, ownerID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	items, err := scanPuzzles(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
