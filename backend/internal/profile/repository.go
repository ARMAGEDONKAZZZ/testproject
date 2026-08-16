package profile

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned by repository lookups that find no matching row.
var ErrNotFound = errors.New("not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// --- users ---
//
// The `users` table is created and owned by internal/auth. internal/profile
// reads and writes a subset of its columns through its own independent SQL
// here — each domain package talks to shared tables via its own queries
// rather than importing another domain's repository, which is the intended
// architecture for this codebase, not an accidental coupling.

func (r *Repository) GetUser(ctx context.Context, id uuid.UUID) (User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, nickname, email, age, age_tier, language, avatar_url, credit_balance, created_at
		FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Nickname, &u.Email, &u.Age, &u.AgeTier, &u.Language, &u.AvatarURL, &u.CreditBalance, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return u, nil
}

// UpdateUser updates only the non-nil fields. age_tier is supplied by the
// service layer alongside age whenever age changes (FR-045) — it is never
// derived in SQL and never trusted from the client.
func (r *Repository) UpdateUser(ctx context.Context, id uuid.UUID, nickname *string, age *int16, ageTier *string, avatarURL *string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET
			nickname   = COALESCE($1, nickname),
			age        = COALESCE($2, age),
			age_tier   = COALESCE($3, age_tier),
			avatar_url = COALESCE($4, avatar_url),
			updated_at = now()
		WHERE id = $5`,
		nickname, age, ageTier, avatarURL, id)
	return err
}

func (r *Repository) DeleteUser(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

// GetPasswordHash / SetPasswordHash are the one deliberate exception to
// "profile doesn't model auth's fields": FR-049's POST /me/password
// endpoint contractually lives in this package (contracts/rest-api.md), so
// it reads/writes password_hash directly with its own narrow query — same
// pattern as any other domain package writing into a shared table it
// doesn't own.
func (r *Repository) GetPasswordHash(ctx context.Context, id uuid.UUID) (*string, error) {
	var hash *string
	err := r.pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, id).Scan(&hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return hash, nil
}

func (r *Repository) SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, hash, id)
	return err
}

// --- parent_links ---

func (r *Repository) GetParentLinkByChild(ctx context.Context, childUserID uuid.UUID) (ParentLink, error) {
	var p ParentLink
	err := r.pool.QueryRow(ctx, `
		SELECT id, child_user_id, guardian_name, guardian_email, verified_at
		FROM parent_links WHERE child_user_id = $1`, childUserID,
	).Scan(&p.ID, &p.ChildUserID, &p.GuardianName, &p.GuardianEmail, &p.VerifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentLink{}, ErrNotFound
	}
	if err != nil {
		return ParentLink{}, err
	}
	return p, nil
}

// VerifyParentLinkByToken marks a parent_links row as verified and returns
// it. See Service.VerifyParentLink for the documented simplification this
// implements: `token` is expected to be the parent_links.id itself (as a
// string), not a signed token.
func (r *Repository) VerifyParentLinkByToken(ctx context.Context, token string) (ParentLink, error) {
	id, err := uuid.Parse(token)
	if err != nil {
		return ParentLink{}, ErrNotFound
	}
	var p ParentLink
	err = r.pool.QueryRow(ctx, `
		UPDATE parent_links SET verified_at = now()
		WHERE id = $1
		RETURNING id, child_user_id, guardian_name, guardian_email, verified_at`, id,
	).Scan(&p.ID, &p.ChildUserID, &p.GuardianName, &p.GuardianEmail, &p.VerifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentLink{}, ErrNotFound
	}
	if err != nil {
		return ParentLink{}, err
	}
	return p, nil
}

// --- skill_profiles ---

func (r *Repository) getSkillProfile(ctx context.Context, userID uuid.UUID) (SkillProfile, error) {
	var sp SkillProfile
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, tactics, strategy, openings, endgames, calculation, overall, focus_axes, updated_at
		FROM skill_profiles WHERE user_id = $1`, userID,
	).Scan(&sp.UserID, &sp.Tactics, &sp.Strategy, &sp.Openings, &sp.Endgames, &sp.Calculation, &sp.Overall, &sp.FocusAxes, &sp.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SkillProfile{}, ErrNotFound
	}
	if err != nil {
		return SkillProfile{}, err
	}
	return sp, nil
}

// GetOrCreateSkillProfile lazily creates the default (all-zero) row the
// first time a user's skills are read — skill_profiles has no
// auto-creation trigger, so the application layer owns this upsert-on-read.
func (r *Repository) GetOrCreateSkillProfile(ctx context.Context, userID uuid.UUID) (SkillProfile, error) {
	sp, err := r.getSkillProfile(ctx, userID)
	if err == nil {
		return sp, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return SkillProfile{}, err
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO skill_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
	); err != nil {
		return SkillProfile{}, err
	}
	return r.getSkillProfile(ctx, userID)
}

// UpdateFocusAxes persists the user's manually chosen training-focus axes.
// The "max 3" rule (FR-047) is validated in the service layer — the DB
// CHECK constraint (focus_axes_max_3) is only the last-resort backstop.
func (r *Repository) UpdateFocusAxes(ctx context.Context, userID uuid.UUID, axes []string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE skill_profiles SET focus_axes = $1, updated_at = now() WHERE user_id = $2`, axes, userID)
	return err
}

// --- training summary (solve_attempts / puzzles are owned by
// internal/puzzle & internal/generation — read here with this package's own
// query, same cross-domain-read pattern used throughout this codebase) ---

// CompletedAttempt is one finished (solved or gave-up) solve, in the shape
// Service.GetTrainingSummary needs to derive accuracy, streak and rating —
// all computed in Go from this single query rather than three.
type CompletedAttempt struct {
	Difficulty  int16
	Outcome     string
	CompletedAt time.Time
}

func (r *Repository) ListCompletedAttempts(ctx context.Context, userID uuid.UUID) ([]CompletedAttempt, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.difficulty, sa.outcome, sa.completed_at
		FROM solve_attempts sa
		JOIN puzzles p ON p.id = sa.puzzle_id
		WHERE sa.user_id = $1 AND sa.outcome IN ('solved', 'solution_revealed') AND sa.completed_at IS NOT NULL
		ORDER BY sa.completed_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CompletedAttempt
	for rows.Next() {
		var a CompletedAttempt
		if err := rows.Scan(&a.Difficulty, &a.Outcome, &a.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// --- board_preferences ---

func (r *Repository) getBoardPreferences(ctx context.Context, userID uuid.UUID) (BoardPreferences, error) {
	var bp BoardPreferences
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, theme, piece_set, show_coordinates, animation_speed_pct, updated_at
		FROM board_preferences WHERE user_id = $1`, userID,
	).Scan(&bp.UserID, &bp.Theme, &bp.PieceSet, &bp.ShowCoordinates, &bp.AnimationSpeedPct, &bp.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return BoardPreferences{}, ErrNotFound
	}
	if err != nil {
		return BoardPreferences{}, err
	}
	return bp, nil
}

// GetOrCreateBoardPreferences lazily creates the default row the first time
// a user's board preferences are read (mirrors GetOrCreateSkillProfile).
func (r *Repository) GetOrCreateBoardPreferences(ctx context.Context, userID uuid.UUID) (BoardPreferences, error) {
	bp, err := r.getBoardPreferences(ctx, userID)
	if err == nil {
		return bp, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return BoardPreferences{}, err
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO board_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
	); err != nil {
		return BoardPreferences{}, err
	}
	return r.getBoardPreferences(ctx, userID)
}

func (r *Repository) UpdateBoardPreferences(ctx context.Context, userID uuid.UUID, prefs BoardPreferences) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE board_preferences SET
			theme = $1, piece_set = $2, show_coordinates = $3, animation_speed_pct = $4, updated_at = now()
		WHERE user_id = $5`,
		prefs.Theme, prefs.PieceSet, prefs.ShowCoordinates, prefs.AnimationSpeedPct, userID)
	return err
}

// --- onboarding_state ---

func (r *Repository) getOnboardingState(ctx context.Context, userID uuid.UUID) (OnboardingState, error) {
	var o OnboardingState
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, role, declared_level, wizard_completed, home_tour_completed, puzzle_tour_completed, updated_at
		FROM onboarding_state WHERE user_id = $1`, userID,
	).Scan(&o.UserID, &o.Role, &o.DeclaredLevel, &o.WizardCompleted, &o.HomeTourCompleted, &o.PuzzleTourCompleted, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return OnboardingState{}, ErrNotFound
	}
	if err != nil {
		return OnboardingState{}, err
	}
	return o, nil
}

// GetOrCreateOnboardingState lazily creates the default (nothing completed
// yet) row the first time it's read (mirrors GetOrCreateBoardPreferences).
func (r *Repository) GetOrCreateOnboardingState(ctx context.Context, userID uuid.UUID) (OnboardingState, error) {
	o, err := r.getOnboardingState(ctx, userID)
	if err == nil {
		return o, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return OnboardingState{}, err
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO onboarding_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID,
	); err != nil {
		return OnboardingState{}, err
	}
	return r.getOnboardingState(ctx, userID)
}

// UpdateOnboardingState applies a partial patch — nil pointers leave the
// existing column untouched, mirroring UpdateProfile's COALESCE style.
// Booleans only ever move false->true in practice (see Service), but are
// still passed as pointers so "not provided" and "explicitly false" stay
// distinguishable at this layer.
func (r *Repository) UpdateOnboardingState(
	ctx context.Context, userID uuid.UUID,
	role, declaredLevel *string, wizardCompleted, homeTourCompleted, puzzleTourCompleted *bool,
) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE onboarding_state SET
			role                  = COALESCE($1, role),
			declared_level        = COALESCE($2, declared_level),
			wizard_completed      = COALESCE($3, wizard_completed),
			home_tour_completed   = COALESCE($4, home_tour_completed),
			puzzle_tour_completed = COALESCE($5, puzzle_tour_completed),
			updated_at            = now()
		WHERE user_id = $6`,
		role, declaredLevel, wizardCompleted, homeTourCompleted, puzzleTourCompleted, userID)
	return err
}
