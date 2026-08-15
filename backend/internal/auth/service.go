package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/neuratop/backend/internal/platform/config"
	"github.com/neuratop/backend/internal/platform/httpserver"
)

var (
	ErrValidation   = errors.New("validation")
	ErrWrongCode    = errors.New("wrong or expired code")
	ErrWrongPass    = errors.New("wrong password")
	ErrEmailInUse   = errors.New("email already in use")
	ErrNicknameUsed = errors.New("nickname already in use")
)

type Service struct {
	repo   *Repository
	mailer Mailer
	cfg    config.Config
	access httpserver.TokenIssuer
}

func NewService(repo *Repository, mailer Mailer, cfg config.Config, access httpserver.TokenIssuer) *Service {
	return &Service{repo: repo, mailer: mailer, cfg: cfg, access: access}
}

type StartRegistrationInput struct {
	Age    int16
	Email  string
	Parent *struct {
		Name  string
		Email string
	}
}

// StartRegistration derives the age tier server-side (FR-001), enforces the
// guardian-consent requirement for minors (FR-002/FR-003), and creates the
// user row with a temporary nickname (finalized in CompleteNickname).
func (s *Service) StartRegistration(ctx context.Context, in StartRegistrationInput) (User, error) {
	tier := DeriveAgeTier(in.Age)

	if RequiresGuardianConsent(tier) {
		if in.Parent == nil || in.Parent.Name == "" || in.Parent.Email == "" {
			return User{}, fmt.Errorf("%w: guardian name and email are required for age tier %q", ErrValidation, tier)
		}
	} else if in.Email == "" {
		return User{}, fmt.Errorf("%w: email is required for adult registration", ErrValidation)
	}

	var emailPtr *string
	if tier == "adult" {
		if _, err := s.repo.GetUserByEmail(ctx, in.Email); err == nil {
			return User{}, ErrEmailInUse
		} else if !errors.Is(err, ErrNotFound) {
			return User{}, err
		}
		emailPtr = &in.Email
	}

	user := User{
		Nickname: temporaryNickname(),
		Email:    emailPtr,
		Age:      in.Age,
		AgeTier:  tier,
		Language: "ru",
	}
	user, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return User{}, err
	}

	if RequiresGuardianConsent(tier) {
		if _, err := s.repo.CreateParentLink(ctx, ParentLink{
			ChildUserID:   user.ID,
			GuardianName:  in.Parent.Name,
			GuardianEmail: in.Parent.Email,
		}); err != nil {
			return User{}, err
		}
	}

	return user, nil
}

// registrationContactEmail is the email OTPs are sent to for this user: the
// user's own email for adults, or the guardian's email for minors — minors
// have no email of their own (data-model.md / spec.md FR-044).
func (s *Service) registrationContactEmail(ctx context.Context, userID uuid.UUID) (string, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if user.Email != nil {
		return *user.Email, nil
	}
	link, err := s.repo.GetParentLinkByChild(ctx, userID)
	if err != nil {
		return "", err
	}
	return link.GuardianEmail, nil
}

// SendCode issues and emails a one-time code for the given purpose,
// enforcing a resend cooldown (FR-009) via the caller-supplied rate limiter
// at the HTTP layer; this method only creates and sends the code.
func (s *Service) SendCode(ctx context.Context, userID *uuid.UUID, email, purpose string) error {
	code := generateNumericCode()
	hash := hashCode(code)
	if err := s.repo.CreateVerificationCode(ctx, userID, email, purpose, hash, 10*time.Minute); err != nil {
		return err
	}
	return s.mailer.SendCode(email, purpose, code)
}

func (s *Service) SendRegistrationCode(ctx context.Context, userID uuid.UUID) error {
	email, err := s.registrationContactEmail(ctx, userID)
	if err != nil {
		return err
	}
	return s.SendCode(ctx, &userID, email, "registration")
}

type VerifyRegistrationInput struct {
	UserID   uuid.UUID
	Code     string
	Password string
}

// VerifyRegistration checks the OTP and, if provided, sets the account
// password (the email/password path from auth.md screens 5–8). It also
// issues a first token pair: the account exists from here on (even though
// its nickname is still a temporary placeholder), and the next step
// (CompleteNickname) is itself an authenticated endpoint — without a token
// here, the client would have no way to call it. This is a deliberate fix
// over the naive design, caught by end-to-end testing.
func (s *Service) VerifyRegistration(ctx context.Context, in VerifyRegistrationInput) (User, string, string, error) {
	email, err := s.registrationContactEmail(ctx, in.UserID)
	if err != nil {
		return User{}, "", "", err
	}
	if err := s.consumeCode(ctx, email, "registration", in.Code); err != nil {
		return User{}, "", "", err
	}
	if in.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		if err != nil {
			return User{}, "", "", err
		}
		if err := s.repo.SetPasswordHash(ctx, in.UserID, string(hash)); err != nil {
			return User{}, "", "", err
		}
	}
	user, err := s.repo.GetUserByID(ctx, in.UserID)
	if err != nil {
		return User{}, "", "", err
	}
	access, refresh, err := s.issueTokens(ctx, user)
	return user, access, refresh, err
}

func (s *Service) consumeCode(ctx context.Context, email, purpose, submitted string) error {
	id, hash, expiresAt, _, err := s.repo.LatestUnconsumedCode(ctx, email, purpose)
	if err != nil {
		return ErrWrongCode
	}
	if time.Now().After(expiresAt) {
		return ErrWrongCode
	}
	if hash != hashCode(submitted) {
		return ErrWrongCode
	}
	return s.repo.ConsumeCode(ctx, id)
}

// CompleteNickname finalizes registration (FR-005) and issues the first
// session tokens.
func (s *Service) CompleteNickname(ctx context.Context, userID uuid.UUID, nickname string) (User, string, string, error) {
	if _, err := s.repo.GetUserByID(ctx, userID); err != nil {
		return User{}, "", "", err
	}
	if err := s.repo.SetNickname(ctx, userID, nickname); err != nil {
		return User{}, "", "", ErrNicknameUsed
	}
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return User{}, "", "", err
	}
	access, refresh, err := s.issueTokens(ctx, user)
	return user, access, refresh, err
}

// CompleteOAuth is a documented mock OAuth exchange: no real Google/Apple
// app credentials exist in this environment (same class of deferred
// integration as the AI generation provider — see
// specs/001-neuratop-mvp/research.md). It trusts a caller-supplied identity
// claim instead of calling the real provider. Swapping in real OAuth later
// only touches this function.
type OAuthIdentity struct {
	Provider string
	Subject  string
	Email    string
}

func (s *Service) CompleteOAuth(ctx context.Context, identity OAuthIdentity, age int16) (User, string, string, error) {
	tier := DeriveAgeTier(age)
	emailPtr := &identity.Email
	if tier != "adult" {
		emailPtr = nil // minors never get their own email on file, even via OAuth
	}
	user := User{
		Nickname:      temporaryNickname(),
		Email:         emailPtr,
		Age:           age,
		AgeTier:       tier,
		Language:      "ru",
		OAuthProvider: &identity.Provider,
		OAuthSubject:  &identity.Subject,
	}
	created, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return User{}, "", "", err
	}
	access, refresh, err := s.issueTokens(ctx, created)
	return created, access, refresh, err
}

// Login authenticates by email+password (adults only — minors have no
// email/password of their own; they stay signed in via refresh tokens from
// their original registration instead, per data-model.md).
func (s *Service) Login(ctx context.Context, email, password string) (User, string, string, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return User{}, "", "", ErrWrongPass // no user enumeration
	}
	if user.PasswordHash == nil {
		return User{}, "", "", ErrWrongPass
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return User{}, "", "", ErrWrongPass
	}
	access, refresh, err := s.issueTokens(ctx, user)
	return user, access, refresh, err
}

func (s *Service) issueTokens(ctx context.Context, user User) (accessToken, refreshToken string, err error) {
	accessToken, err = s.access.Issue(user.ID, user.AgeTier)
	if err != nil {
		return "", "", err
	}
	refreshToken = generateOpaqueToken()
	if _, err = s.repo.CreateSession(ctx, user.ID, hashCode(refreshToken), s.cfg.RefreshTokenTTL); err != nil {
		return "", "", err
	}
	return accessToken, refreshToken, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (string, string, error) {
	session, err := s.repo.GetActiveSessionByTokenHash(ctx, hashCode(refreshToken))
	if err != nil {
		return "", "", ErrWrongCode
	}
	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return "", "", err
	}
	// Rotate: revoke old, issue new.
	if err := s.repo.RevokeSession(ctx, session.ID); err != nil {
		return "", "", err
	}
	return s.issueTokens(ctx, user)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	session, err := s.repo.GetActiveSessionByTokenHash(ctx, hashCode(refreshToken))
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return s.repo.RevokeSession(ctx, session.ID)
}

func (s *Service) StartPasswordReset(ctx context.Context, email string) error {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		// Deliberately no error surfaced to caller: avoid email enumeration.
		return nil
	}
	return s.SendCode(ctx, &user.ID, email, "password_reset")
}

func (s *Service) CompletePasswordReset(ctx context.Context, email, code, newPassword string) error {
	if err := s.consumeCode(ctx, email, "password_reset", code); err != nil {
		return err
	}
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return ErrWrongCode
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.SetPasswordHash(ctx, user.ID, string(hash))
}

// --- helpers ---

func temporaryNickname() string {
	return "player_" + uuid.NewString()[:8]
}

func generateNumericCode() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	n := (int(b[0])<<16 | int(b[1])<<8 | int(b[2])) % 1000000
	return fmt.Sprintf("%06d", n)
}

func generateOpaqueToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func hashCode(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
