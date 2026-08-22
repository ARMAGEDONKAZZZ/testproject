// Package puzzle implements puzzle-solving (internal/puzzle) — FR-024–033:
// fetching a puzzle, starting/continuing a solve attempt, submitting moves,
// simplifying a stuck puzzle, hints, revealing the solution, mocked engine
// analysis, favoriting, and exporting a puzzle. See
// specs/001-neuratop-mvp/contracts/rest-api.md ("Puzzles & solving") and
// specs/001-neuratop-mvp/data-model.md (`solve_attempts`, `puzzle_hints`).
package puzzle

import (
	"time"

	"github.com/google/uuid"
)

// Outcome values for solve_attempts.outcome (data-model.md "State
// transitions"). "abandoned" is set by a scheduled job, not by any endpoint
// in this package, so it has no corresponding constructor here.
const (
	OutcomeInProgress       = "in_progress"
	OutcomeSolved           = "solved"
	OutcomeSolutionRevealed = "solution_revealed"
	OutcomeAbandoned        = "abandoned"
)

// Hint sources for puzzle_hints.source.
const (
	HintSourceFree      = "free"
	HintSourcePurchased = "purchased"
)

// FreeHintsPerPuzzle is the FR-027 cap: 3 free hints per puzzle before the
// 4th request must route to the credit paywall instead.
const FreeHintsPerPuzzle = 3

// SkillAxisDeltaSolved / SkillAxisDeltaRevealed are how much a solve moves
// the matching skill_profiles axis (see docs/design-audit/self-education.md
// "Реализация"): solving a puzzle unaided is real signal of improvement,
// giving up and revealing the solution is real signal the axis needs more
// work. These are the only two places skill_profiles.* ever changes.
const (
	SkillAxisDeltaSolved   = 4
	SkillAxisDeltaRevealed = -2
)

// skillAxisColumns maps a puzzle's tag to the skill_profiles column it
// should nudge. The first four entries are the original fixtures/puzzles.json
// tags; the rest are tactical-motif tags the external puzzle API
// (internal/generation/api_generator.go tagFor) assigns — every one of them
// is a combinational/tactical pattern, so they all map to "tactics" too.
// "strategy" has no tag of its own on either source, so it is deliberately
// absent — see BumpSkillAxis, which no-ops for any tag not in this map
// rather than moving a column with fabricated numbers.
var skillAxisColumns = map[string]string{
	"tactics":           "tactics",
	"mate-in-1":         "calculation",
	"opening-trap":      "openings",
	"endgame":           "endgames",
	"sacrifice":         "tactics",
	"fork":              "tactics",
	"pin":               "tactics",
	"skewer":            "tactics",
	"discovered_attack": "tactics",
	"double_attack":     "tactics",
	"deflection":        "tactics",
	"decoy":             "tactics",
	"clearance":         "tactics",
	"zugzwang":          "tactics",
	"back_rank":         "tactics",
	"hanging_piece":     "tactics",
	"trapped_piece":     "tactics",
}

// SimplifyLimit mirrors the `puzzles.simplify_depth <= 3` check constraint
// (data-model.md) — FR-026's "hard floor" on how many times a puzzle chain
// can be simplified.
const SimplifyLimit = 3

// MoveRecord is one entry of solve_attempts.moves (jsonb array of
// {move, correct}, data-model.md).
type MoveRecord struct {
	Move    string `json:"move"`
	Correct bool   `json:"correct"`
}

// SolveAttempt mirrors the solve_attempts table.
type SolveAttempt struct {
	ID       uuid.UUID
	PuzzleID uuid.UUID
	UserID   uuid.UUID
	Moves    []MoveRecord
	Outcome  string
	// SolutionIndex is how many plies into puzzle.SolutionLine this attempt
	// has correctly progressed — SubmitMove compares the next submitted move
	// against SolutionLine[SolutionIndex], not always index 0, so multi-ply
	// sequences (solver move, forced opponent reply, solver move, ...) work.
	SolutionIndex    int16
	HintsUsed        int16
	SolutionRevealed bool
	SimplifyCount    int16
	StartedAt        time.Time
	CompletedAt      *time.Time
}

// HintPackageView is the shape of one row read from the (billing-owned)
// hint_packages catalog table. This package reads that table directly with
// its own SQL query rather than importing internal/billing — see
// repository.go ListHintPackages and the task brief: separate domain
// packages in this architecture are allowed to read shared tables directly
// via SQL instead of importing each other's Go packages.
type HintPackageView struct {
	ID           uuid.UUID `json:"id"`
	Label        string    `json:"label"`
	HintCount    *int      `json:"hintCount"`
	PriceCredits int       `json:"priceCredits"`
	IsFeatured   bool      `json:"isFeatured"`
}
