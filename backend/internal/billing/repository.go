package billing

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("not found")

	// ErrInsufficientCredits is returned by DebitAndRecord when the user's
	// current balance is lower than the requested debit amount — the
	// handler layer maps this to 402 INSUFFICIENT_CREDITS per
	// specs/001-neuratop-mvp/contracts/rest-api.md.
	ErrInsufficientCredits = errors.New("insufficient credits")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ListHintPackages returns the fixed hint-package catalog in display order.
func (r *Repository) ListHintPackages(ctx context.Context) ([]HintPackage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, label, hint_count, price_credits, is_featured, sort_order
		FROM hint_packages
		ORDER BY sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	packages := make([]HintPackage, 0)
	for rows.Next() {
		var p HintPackage
		if err := rows.Scan(&p.ID, &p.Label, &p.HintCount, &p.PriceCredits, &p.IsFeatured, &p.SortOrder); err != nil {
			return nil, err
		}
		packages = append(packages, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return packages, nil
}

func (r *Repository) GetHintPackage(ctx context.Context, id uuid.UUID) (HintPackage, error) {
	var p HintPackage
	err := r.pool.QueryRow(ctx, `
		SELECT id, label, hint_count, price_credits, is_featured, sort_order
		FROM hint_packages WHERE id = $1`, id,
	).Scan(&p.ID, &p.Label, &p.HintCount, &p.PriceCredits, &p.IsFeatured, &p.SortOrder)
	if errors.Is(err, pgx.ErrNoRows) {
		return HintPackage{}, ErrNotFound
	}
	if err != nil {
		return HintPackage{}, err
	}
	return p, nil
}

// GetBalance returns the user's current credit balance (FR-052).
func (r *Repository) GetBalance(ctx context.Context, userID uuid.UUID) (int, error) {
	var balance int
	err := r.pool.QueryRow(ctx, `SELECT credit_balance FROM users WHERE id = $1`, userID).Scan(&balance)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	return balance, nil
}

// DebitAndRecord is the single enforcement point for FR-054 and the
// Constitution's Data Integrity requirement that credit_balance can never go
// negative. It runs entirely inside one DB transaction:
//
//  1. UPDATE ... WHERE credit_balance >= amount — the WHERE clause is the
//     actual guard: if the balance is too low the UPDATE matches zero rows
//     (not an error by itself), which RETURNING then surfaces as
//     pgx.ErrNoRows on Scan.
//  2. On pgx.ErrNoRows we roll back and return ErrInsufficientCredits —
//     nothing is written, the balance is untouched.
//  3. On success we INSERT the matching credit_transactions row with a
//     NEGATIVE amount (spend) in the same transaction, then commit.
//
// Because both the balance mutation and the ledger insert happen in one
// transaction, a crash or error between them can never leave the balance
// and the transaction log inconsistent, and two concurrent debits can never
// both succeed past a balance that only covers one of them (the UPDATE's
// WHERE guard is evaluated under the row lock Postgres takes for the
// UPDATE, so concurrent debits serialize against each other).
//
// amount MUST be a positive number of credits to subtract.
func (r *Repository) DebitAndRecord(ctx context.Context, userID uuid.UUID, amount int, reason string, relatedPuzzleID, relatedHintPackageID *uuid.UUID) (newBalance int, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `
		UPDATE users SET credit_balance = credit_balance - $1, updated_at = now()
		WHERE id = $2 AND credit_balance >= $1
		RETURNING credit_balance`, amount, userID,
	).Scan(&newBalance)
	if errors.Is(err, pgx.ErrNoRows) {
		// The UPDATE touched zero rows: either the balance was too low
		// (the expected/common case this guards against) or the user id
		// doesn't exist. In this API the caller is always the
		// authenticated JWT subject, so a missing user is not a realistic
		// path in practice; we report the balance-guard error either way
		// since that's what FR-054/402 INSUFFICIENT_CREDITS is about.
		return 0, ErrInsufficientCredits
	}
	if err != nil {
		return 0, err
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO credit_transactions (user_id, amount, reason, related_puzzle_id, related_hint_package_id)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, -amount, reason, relatedPuzzleID, relatedHintPackageID,
	); err != nil {
		return 0, err
	}

	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return newBalance, nil
}

// CreditAndRecord is the top-up/adjustment mirror of DebitAndRecord: it adds
// amount credits to the user's balance and records a POSITIVE-amount
// credit_transactions row, both inside one DB transaction.
func (r *Repository) CreditAndRecord(ctx context.Context, userID uuid.UUID, amount int, reason string) (newBalance int, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `
		UPDATE users SET credit_balance = credit_balance + $1, updated_at = now()
		WHERE id = $2
		RETURNING credit_balance`, amount, userID,
	).Scan(&newBalance)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO credit_transactions (user_id, amount, reason)
		VALUES ($1, $2, $3)`,
		userID, amount, reason,
	); err != nil {
		return 0, err
	}

	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return newBalance, nil
}

// LatestTransactionID returns the id of the most recently recorded
// credit_transactions row for userID. PurchaseHintPackage uses it right
// after DebitAndRecord to link the puzzle_hints rows it inserts back to the
// transaction that paid for them (data-model.md:
// puzzle_hints.credit_transaction_id).
func (r *Repository) LatestTransactionID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM credit_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1`, userID,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrNotFound
	}
	return id, err
}

// ListTransactions returns userID's credit_transactions, newest first
// (FR-055 audit trail), paginated.
func (r *Repository) ListTransactions(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]CreditTransaction, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, amount, reason, related_puzzle_id, related_hint_package_id, created_at
		FROM credit_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, userID, pageSize, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txns := make([]CreditTransaction, 0)
	for rows.Next() {
		var t CreditTransaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Amount, &t.Reason, &t.RelatedPuzzleID, &t.RelatedHintPackageID, &t.CreatedAt); err != nil {
			return nil, err
		}
		txns = append(txns, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return txns, nil
}
