// Package billing implements the credit ledger and hint-package paywall
// described in specs/001-neuratop-mvp/spec.md User Story 6 (FR-052–057).
// There is no real payment gateway in this environment — see
// specs/001-neuratop-mvp/research.md "Payments / credit top-up" — so credit
// top-up is fully simulated: it instantly credits the account and records a
// clearly-tagged `topup_simulated` transaction. Everything else (the credit
// ledger, balances, transaction history, hint-package purchases) is real,
// persisted, and enforced server-side.
package billing

import (
	"time"

	"github.com/google/uuid"
)

// HintPackage is a purchasable hint offer from the small, fixed catalog
// seeded by migrations/0002_seed_hint_packages.sql (data-model.md
// `hint_packages`; docs/design-audit/toolboard.md paywall: 5/10/unlimited
// hints for 49/129/299 credits).
type HintPackage struct {
	ID           uuid.UUID
	Label        string
	HintCount    *int // nil = unlimited hints for the puzzle
	PriceCredits int
	IsFeatured   bool
	SortOrder    int16
}

// Valid credit_transactions.reason values — mirrors the CHECK constraint in
// migrations/0001_init.sql. Keeping these as named constants (rather than
// bare string literals scattered across the package) avoids ever writing a
// reason the database will reject.
const (
	ReasonTopupSimulated      = "topup_simulated"
	ReasonHintPackagePurchase = "hint_package_purchase"
	ReasonAdjustment          = "adjustment"
)

// CreditTransaction is one auditable, credit-affecting event tied to a user
// (FR-055): a positive Amount is a credit/top-up, a negative Amount is a
// debit/spend. users.credit_balance is always the running sum of this
// table, maintained transactionally alongside each insert (data-model.md).
type CreditTransaction struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	Amount               int
	Reason               string
	RelatedPuzzleID      *uuid.UUID
	RelatedHintPackageID *uuid.UUID
	CreatedAt            time.Time
}
