package profile

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrValidation      = errors.New("validation")
	ErrForbidden       = errors.New("forbidden")
	ErrConsentRequired = errors.New("guardian consent required")
	ErrWrongPassword   = errors.New("wrong current password")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// MeResult bundles everything GET /me needs. handlers.go decides which
// fields actually get serialized to JSON (FR-043/044 — the response shape
// differs by age tier, which no single struct+omitempty can express
// safely; see userJSON in handlers.go).
type MeResult struct {
	User             User
	ParentLink       *ParentLink // nil for an adult, or a minor with no link on file
	SkillProfile     SkillProfile
	BoardPreferences BoardPreferences
}

// GetMe loads the full profile view for the authenticated caller.
func (s *Service) GetMe(ctx context.Context, userID uuid.UUID) (MeResult, error) {
	user, err := s.repo.GetUser(ctx, userID)
	if err != nil {
		return MeResult{}, err
	}

	res := MeResult{User: user}

	if user.AgeTier != "adult" {
		link, err := s.repo.GetParentLinkByChild(ctx, userID)
		switch {
		case errors.Is(err, ErrNotFound):
			// No guardian link on file yet — leave ParentLink nil rather
			// than failing the whole request.
		case err != nil:
			return MeResult{}, err
		default:
			res.ParentLink = &link
		}
	}

	sp, err := s.repo.GetOrCreateSkillProfile(ctx, userID)
	if err != nil {
		return MeResult{}, err
	}
	res.SkillProfile = sp

	bp, err := s.repo.GetOrCreateBoardPreferences(ctx, userID)
	if err != nil {
		return MeResult{}, err
	}
	res.BoardPreferences = bp

	return res, nil
}

// UpdateProfile applies a partial edit to name/age/avatar (FR-045).
//
// Whenever the resulting age (if changed) derives a tier that requires
// guardian consent, a verified parent_links row must already exist. This is
// checked unconditionally on every age edit that resolves into child/teen —
// not only edits that visibly "cross" from a different previous tier —
// because that is the simplest rule that can never let an edit through with
// a missing or never-verified guardian link (data-model.md: "a transition
// INTO child/teen from adult is blocked unless a verified parent_links row
// exists"; this generalizes that guarantee to hold on every write, which is
// strictly safer and never rejects a request that already has a valid,
// verified link).
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, name *string, age *int16, avatarURL *string) (User, error) {
	if _, err := s.repo.GetUser(ctx, userID); err != nil {
		return User{}, err
	}

	var ageTier *string
	if age != nil {
		tier := DeriveAgeTier(*age)
		if RequiresGuardianConsent(tier) {
			link, err := s.repo.GetParentLinkByChild(ctx, userID)
			if err != nil && !errors.Is(err, ErrNotFound) {
				return User{}, err
			}
			if errors.Is(err, ErrNotFound) || link.VerifiedAt == nil {
				return User{}, ErrConsentRequired
			}
		}
		ageTier = &tier
	}

	if err := s.repo.UpdateUser(ctx, userID, name, age, ageTier, avatarURL); err != nil {
		return User{}, err
	}
	return s.repo.GetUser(ctx, userID)
}

// ChangePassword implements FR-049 (adult-only). If the account has no
// password set yet ("Not set" per docs/design-audit/profile.md — an
// OAuth-only account, or one that has never had a password),
// currentPassword is not required; otherwise it must match the existing
// hash. password_hash is written via repo.SetPasswordHash — a direct query
// into the users table that internal/profile owns for this one endpoint
// only (see repository.go).
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.repo.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	if user.AgeTier != "adult" {
		return ErrForbidden
	}

	existingHash, err := s.repo.GetPasswordHash(ctx, userID)
	if err != nil {
		return err
	}
	if existingHash != nil {
		if currentPassword == "" {
			return ErrWrongPassword
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*existingHash), []byte(currentPassword)); err != nil {
			return ErrWrongPassword
		}
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.SetPasswordHash(ctx, userID, string(newHash))
}

// DeleteAccount implements FR-044/FR-049: only an adult may self-delete.
// This is the critical safety gate for minor accounts and MUST run
// server-side regardless of what the client believes the caller's tier is
// (Constitution III/VI, SC-006).
func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	user, err := s.repo.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	if user.AgeTier != "adult" {
		return ErrForbidden
	}
	return s.repo.DeleteUser(ctx, userID)
}

func (s *Service) GetSkills(ctx context.Context, userID uuid.UUID) (SkillProfile, error) {
	return s.repo.GetOrCreateSkillProfile(ctx, userID)
}

// axisTopics is the mappable subset of skill axes — the ones that have a
// matching fixtures/puzzles.json tag (mirrors internal/puzzle's
// skillAxisColumns, inverted). "strategy" has no fixture tag, so it can
// never be picked as the next training topic — see
// docs/design-audit/self-education.md "Реализация".
var axisTopics = []struct {
	axis  string
	tag   string
	label string
}{
	{"tactics", "tactics", "Тактика — Простые комбинации"},
	{"calculation", "mate-in-1", "Расчёт — Маты в 1 ход"},
	{"openings", "opening-trap", "Дебюты — Ловушки"},
	{"endgames", "endgame", "Эндшпиль — Проведение пешки"},
}

// pickNextTopic implements "Следующая тема" (self-education.md): the
// user's first focus axis that has a puzzle tag, else the mappable axis
// with the lowest score (ties broken by axisTopics' fixed order).
func pickNextTopic(sp SkillProfile) *NextTopic {
	scoreOf := map[string]int16{
		"tactics":     sp.Tactics,
		"calculation": sp.Calculation,
		"openings":    sp.Openings,
		"endgames":    sp.Endgames,
	}
	for _, focus := range sp.FocusAxes {
		for _, t := range axisTopics {
			if t.axis == focus {
				return &NextTopic{Axis: t.axis, Tag: t.tag, Label: t.label}
			}
		}
	}
	best := axisTopics[0]
	bestScore := scoreOf[best.axis]
	for _, t := range axisTopics[1:] {
		if scoreOf[t.axis] < bestScore {
			best, bestScore = t, scoreOf[t.axis]
		}
	}
	return &NextTopic{Axis: best.axis, Tag: best.tag, Label: best.label}
}

// puzzleRating maps a puzzle's 1-5 difficulty to an Elo-comparable rating
// for the Elo-lite calculation in GetTrainingSummary — an arbitrary but
// fixed, documented scale, not a fitted/real chess rating.
func puzzleRating(difficulty int16) float64 {
	return 800 + float64(difficulty)*160
}

const (
	startingRating = 1000.0
	eloK           = 24.0
)

// GetTrainingSummary computes the Self Education dashboard's stats
// (docs/design-audit/self-education.md "Статистика") entirely from real
// solve history — nothing here is a stored or fabricated number:
//   - sessionsCount / accuracyPercent: plain aggregates over completed
//     attempts.
//   - streakDays: consecutive calendar days (ending today or yesterday)
//     with at least one completed attempt.
//   - rating / ratingDelta: a standard Elo-lite replay over the ordered
//     attempt history (K=24), which is why nothing needs to be persisted —
//     re-deriving it is cheap at this scale and can never drift.
func (s *Service) GetTrainingSummary(ctx context.Context, userID uuid.UUID) (TrainingSummary, error) {
	sp, err := s.repo.GetOrCreateSkillProfile(ctx, userID)
	if err != nil {
		return TrainingSummary{}, err
	}
	attempts, err := s.repo.ListCompletedAttempts(ctx, userID)
	if err != nil {
		return TrainingSummary{}, err
	}

	summary := TrainingSummary{
		Rating:    int(math.Round(startingRating)),
		NextTopic: pickNextTopic(sp),
	}
	if len(attempts) == 0 {
		return summary, nil
	}

	solved := 0
	rating := startingRating
	prevRating := startingRating
	dates := make(map[string]bool, len(attempts))
	for _, a := range attempts {
		if a.Outcome == "solved" {
			solved++
		}
		actual := 0.0
		if a.Outcome == "solved" {
			actual = 1.0
		}
		expected := 1.0 / (1.0 + math.Pow(10, (puzzleRating(a.Difficulty)-rating)/400))
		prevRating = rating
		rating += eloK * (actual - expected)
		dates[a.CompletedAt.Format("2006-01-02")] = true
	}

	summary.SessionsCount = len(attempts)
	summary.AccuracyPercent = int(math.Round(float64(solved) / float64(len(attempts)) * 100))
	summary.Rating = int(math.Round(rating))
	summary.RatingDelta = int(math.Round(rating - prevRating))
	summary.StreakDays = currentStreak(dates)
	return summary, nil
}

// currentStreak counts back day-by-day from today (allowing the streak to
// still show as "alive" if the most recent session was yesterday, not just
// today — matching a chess.com-style streak, not a strict "must have
// trained today" counter) while each day is present in dates.
func currentStreak(dates map[string]bool) int {
	today := time.Now().UTC()
	if !dates[today.Format("2006-01-02")] {
		today = today.AddDate(0, 0, -1)
		if !dates[today.Format("2006-01-02")] {
			return 0
		}
	}
	streak := 0
	for dates[today.Format("2006-01-02")] {
		streak++
		today = today.AddDate(0, 0, -1)
	}
	return streak
}

// validSkillAxes is the fixed set of FR-046 skill axis names.
var validSkillAxes = map[string]bool{
	"tactics":     true,
	"strategy":    true,
	"openings":    true,
	"endgames":    true,
	"calculation": true,
}

// validateFocusAxes enforces FR-047 ("up to 3 skill axes"). It is a pure
// function on purpose — split out from SetFocusAxes so the rule can be
// unit-tested without a database (see service_test.go).
func validateFocusAxes(axes []string) error {
	if len(axes) > 3 {
		return ErrValidation
	}
	for _, a := range axes {
		if !validSkillAxes[a] {
			return ErrValidation
		}
	}
	return nil
}

func (s *Service) SetFocusAxes(ctx context.Context, userID uuid.UUID, axes []string) (SkillProfile, error) {
	if err := validateFocusAxes(axes); err != nil {
		return SkillProfile{}, err
	}
	if _, err := s.repo.GetOrCreateSkillProfile(ctx, userID); err != nil {
		return SkillProfile{}, err
	}
	if err := s.repo.UpdateFocusAxes(ctx, userID, axes); err != nil {
		return SkillProfile{}, err
	}
	return s.repo.GetOrCreateSkillProfile(ctx, userID)
}

// SetBoardPreferences implements FR-048. animationSpeedPct is validated
// against the board_preferences column's 0-100 CHECK constraint here so a
// bad value gets a clear VALIDATION_ERROR instead of a raw DB error.
func (s *Service) SetBoardPreferences(ctx context.Context, userID uuid.UUID, theme, pieceSet string, showCoordinates bool, animationSpeedPct int) (BoardPreferences, error) {
	if theme == "" || pieceSet == "" {
		return BoardPreferences{}, ErrValidation
	}
	if animationSpeedPct < 0 || animationSpeedPct > 100 {
		return BoardPreferences{}, ErrValidation
	}

	if _, err := s.repo.GetOrCreateBoardPreferences(ctx, userID); err != nil {
		return BoardPreferences{}, err
	}
	prefs := BoardPreferences{
		UserID:            userID,
		Theme:             theme,
		PieceSet:          pieceSet,
		ShowCoordinates:   showCoordinates,
		AnimationSpeedPct: int16(animationSpeedPct),
	}
	if err := s.repo.UpdateBoardPreferences(ctx, userID, prefs); err != nil {
		return BoardPreferences{}, err
	}
	return s.repo.GetOrCreateBoardPreferences(ctx, userID)
}

// VerifyParentLink implements FR-051 (guardian confirms via emailed link).
//
// Simplification (documented, not an oversight): a production system would
// embed a signed, single-use, expiring token in the emailed link and verify
// its signature here. That infrastructure (signing key management, expiry,
// replay protection) is out of scope for this iteration — analogous to
// auth.Service.CompleteOAuth's documented mock OAuth exchange, this
// dev/test-grade stand-in uses the parent_links row's own id as the
// "token": the emailed link is simply /parent-links/{id}/verify. This MUST
// be swapped for a real signed token before this endpoint is exposed to
// real guardian emails in production.
func (s *Service) VerifyParentLink(ctx context.Context, token string) error {
	_, err := s.repo.VerifyParentLinkByToken(ctx, token)
	return err
}
