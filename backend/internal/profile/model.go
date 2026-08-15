package profile

import (
	"time"

	"github.com/google/uuid"
)

// User is the subset of the `users` table (created and owned by
// internal/auth — see specs/001-neuratop-mvp/data-model.md) that the
// profile domain reads and writes through its own independent SQL queries
// in repository.go. That's the intended architecture here: each domain
// package talks to shared tables via its own queries instead of importing
// another domain's repository/model types.
//
// PasswordHash and the OAuth fields are deliberately NOT modeled here —
// they are auth's concern. The one exception is password_hash for the
// POST /me/password endpoint, which contractually lives in this package
// (contracts/rest-api.md); repository.go writes it with a narrow,
// dedicated query instead of exposing it on this struct.
type User struct {
	ID            uuid.UUID
	Nickname      string
	Email         *string
	Age           int16
	AgeTier       string
	Language      string
	AvatarURL     *string
	CreditBalance int
	CreatedAt     time.Time
}

// ParentLink links a minor User to a verified guardian identity (FR-051).
type ParentLink struct {
	ID            uuid.UUID
	ChildUserID   uuid.UUID
	GuardianName  string
	GuardianEmail string
	VerifiedAt    *time.Time
}

// SkillProfile is the per-user 5-axis skills breakdown plus the user's
// manually chosen training-focus axes (FR-046/FR-047).
type SkillProfile struct {
	UserID      uuid.UUID
	Tactics     int16
	Strategy    int16
	Openings    int16
	Endgames    int16
	Calculation int16
	Overall     int16
	FocusAxes   []string
	UpdatedAt   time.Time
}

// TrainingSummary backs the Self Education dashboard
// (docs/design-audit/self-education.md "Статистика" + hero CTA subtitle).
// Every field is computed on read from solve_attempts/puzzles — there is no
// dedicated table for it, so there is nothing to keep in sync and no risk
// of stale/fabricated numbers.
type TrainingSummary struct {
	SessionsCount   int
	StreakDays      int
	AccuracyPercent int
	Rating          int
	RatingDelta     int
	NextTopic       *NextTopic
}

// NextTopic is the puzzle-generator tag to send the user into next
// ("Начать/Продолжить обучение"), derived from their weakest (or
// deliberately focused) skill axis — see Service.GetTrainingSummary.
type NextTopic struct {
	Axis  string
	Tag   string
	Label string
}

// BoardPreferences is the per-user Board Design setting (FR-048).
type BoardPreferences struct {
	UserID            uuid.UUID
	Theme             string
	PieceSet          string
	ShowCoordinates   bool
	AnimationSpeedPct int16
	UpdatedAt         time.Time
}

// DeriveAgeTier / RequiresGuardianConsent — DELIBERATE DUPLICATION.
//
// internal/auth owns the canonical implementation of these two pure,
// branchless, side-effect-free functions (see internal/auth/model.go,
// which documents the corrected age-gate logic: the audited Figma
// connector had its ДА/НЕТ branches reversed — spec.md Assumptions).
// internal/profile needs the exact same logic for FR-045 (re-running the
// tier/consent check whenever a profile age edit crosses into a tier that
// requires guardian consent).
//
// internal/auth is a leaf domain package, not a shared library other
// domains are meant to import — importing it here purely to reuse two tiny
// helpers would create an unwanted internal/profile -> internal/auth
// dependency edge. Given how small and stable this logic is, and that both
// copies are covered by near-identical boundary tests (see model_test.go
// here and internal/auth/model_test.go), duplicating it is a deliberate
// trade favoring package decoupling over DRY for this one case — not an
// oversight. If this logic ever grows more complex, it should be pulled
// out into a shared package (e.g. internal/ageband) that both domains
// import instead of copying further.
func DeriveAgeTier(age int16) string {
	switch {
	case age < 12:
		return "child"
	case age < 18:
		return "teen"
	default:
		return "adult"
	}
}

// RequiresGuardianConsent reports whether tier needs a verified
// parent/guardian link before an account may be created or an age edit may
// take effect (FR-002/FR-003/FR-045). "Подростки" (teen) is deliberately
// treated the same as "Дети" (child) — see spec.md Assumptions.
func RequiresGuardianConsent(tier string) bool {
	return tier == "child" || tier == "teen"
}
