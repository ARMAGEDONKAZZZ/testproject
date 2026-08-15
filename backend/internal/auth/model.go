package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID
	Nickname      string
	Email         *string
	PasswordHash  *string
	Age           int16
	AgeTier       string
	Language      string
	AvatarURL     *string
	CreditBalance int
	OAuthProvider *string
	OAuthSubject  *string
	CreatedAt     time.Time
}

type ParentLink struct {
	ID            uuid.UUID
	ChildUserID   uuid.UUID
	GuardianName  string
	GuardianEmail string
	VerifiedAt    *time.Time
}

type Session struct {
	ID               uuid.UUID
	UserID           uuid.UUID
	RefreshTokenHash string
	ExpiresAt        time.Time
	RevokedAt        *time.Time
}

// DeriveAgeTier maps a declared age to the product's three account tiers.
// This is the single source of truth for the age-gate — the spec's
// corrected logic (spec.md Assumptions: the audited Figma connector had the
// ДА/НЕТ branches reversed): under 18 always requires guardian consent,
// 18+ never does. It is recomputed here from `age` on every write and is
// NEVER accepted as a raw client-supplied value (Constitution III).
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

// RequiresGuardianConsent reports whether tier needs a parent/guardian link
// before the account may be created or an age edit may take effect
// (FR-002/FR-003/FR-045). "Подростки" (teen) is deliberately treated the
// same as "Дети" (child) here — see spec.md Assumptions for why.
func RequiresGuardianConsent(tier string) bool {
	return tier == "child" || tier == "teen"
}
