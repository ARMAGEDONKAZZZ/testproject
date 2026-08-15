package billing

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrInvalidAmount is returned by SimulatedTopup for a non-positive or
// unreasonably large requested amount.
var ErrInvalidAmount = errors.New("invalid amount")

// maxSimulatedTopupCredits guards the dev-mode simulated top-up against
// absurd values (there is no real payment gateway validating an amount
// against a real charge — see research.md "Payments / credit top-up").
const maxSimulatedTopupCredits = 100000

type Service struct {
	repo *Repository
	// pool is used directly (bypassing Repository) only for the
	// puzzle_hints insert in PurchaseHintPackage: puzzle_hints belongs
	// conceptually to the solving/hint flow, not to the credit ledger that
	// the rest of repository.go owns, so it is written here as its own
	// small SQL statement rather than growing repository.go's surface for
	// a single call site.
	pool *pgxpool.Pool
}

func NewService(repo *Repository, pool *pgxpool.Pool) *Service {
	return &Service{repo: repo, pool: pool}
}

func (s *Service) ListHintPackages(ctx context.Context) ([]HintPackage, error) {
	return s.repo.ListHintPackages(ctx)
}

func (s *Service) GetBalance(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.repo.GetBalance(ctx, userID)
}

func (s *Service) ListTransactions(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]CreditTransaction, error) {
	return s.repo.ListTransactions(ctx, userID, page, pageSize)
}

// PurchaseResult is the outcome of a completed hint-package purchase
// (contracts/rest-api.md: `200 { data: { balance, hintsRemaining } }`).
type PurchaseResult struct {
	Balance        int
	HintsRemaining *int // nil = unlimited hints for this puzzle
}

// PurchaseHintPackage implements FR-054: find the package, atomically debit
// its price from the caller's credit balance (DebitAndRecord — see
// repository.go for why the balance can never go negative), then grant the
// purchased hints against the given solve attempt by writing directly to
// puzzle_hints (source = 'purchased', linked to the credit_transactions row
// that paid for them).
//
// If HintCount is nil (the "unlimited" package) a single puzzle_hints row is
// inserted as a marker and HintsRemaining is reported as nil, meaning
// unlimited for that puzzle — callers must treat a nil HintsRemaining as
// "no further limit," not as zero.
//
// Simplification (documented, not a hidden shortcut): HintsRemaining is
// reported as the purchased package's own hint_count, not a precise
// "hints left after accounting for every prior purchase on this attempt."
// Computing that exactly would mean counting existing puzzle_hints rows for
// the attempt and reconciling against however many have already been used
// by the solving flow — real logic that belongs to a future iteration once
// the puzzle-solving package's hint-consumption bookkeeping exists. For
// this mock, each purchase simply reports "you now have (at least) this
// many purchased hints available."
func (s *Service) PurchaseHintPackage(ctx context.Context, userID, packageID, attemptID uuid.UUID) (PurchaseResult, error) {
	pkg, err := s.repo.GetHintPackage(ctx, packageID)
	if err != nil {
		return PurchaseResult{}, err
	}

	newBalance, err := s.repo.DebitAndRecord(ctx, userID, pkg.PriceCredits, ReasonHintPackagePurchase, nil, &packageID)
	if err != nil {
		// ErrInsufficientCredits propagates to the handler, which maps it
		// to 402 (contracts/rest-api.md).
		return PurchaseResult{}, err
	}

	txnID, err := s.repo.LatestTransactionID(ctx, userID)
	if err != nil {
		return PurchaseResult{}, err
	}

	grantCount := 1 // "unlimited" package: one marker row, no per-hint count
	if pkg.HintCount != nil {
		grantCount = *pkg.HintCount
	}
	for i := 0; i < grantCount; i++ {
		if _, err := s.pool.Exec(ctx, `
			INSERT INTO puzzle_hints (solve_attempt_id, source, credit_transaction_id)
			VALUES ($1, 'purchased', $2)`, attemptID, txnID,
		); err != nil {
			return PurchaseResult{}, err
		}
	}

	return PurchaseResult{Balance: newBalance, HintsRemaining: pkg.HintCount}, nil
}

// SimulatedTopup implements FR-057 / research.md "Payments / credit
// top-up": no real payment gateway exists in this environment, so this
// instantly credits the user's balance and records a topup_simulated
// transaction (kept behind this one method so a real PaymentProvider can
// later replace just this call site).
func (s *Service) SimulatedTopup(ctx context.Context, userID uuid.UUID, amount int) (int, error) {
	if amount <= 0 || amount > maxSimulatedTopupCredits {
		return 0, fmt.Errorf("%w: сумма пополнения должна быть от 1 до %d кредитов", ErrInvalidAmount, maxSimulatedTopupCredits)
	}
	return s.repo.CreditAndRecord(ctx, userID, amount, ReasonTopupSimulated)
}
