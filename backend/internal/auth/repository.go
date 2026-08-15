package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateUser(ctx context.Context, u User) (User, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (nickname, email, password_hash, age, age_tier, oauth_provider, oauth_subject)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`,
		u.Nickname, u.Email, u.PasswordHash, u.Age, u.AgeTier, u.OAuthProvider, u.OAuthSubject,
	).Scan(&u.ID, &u.CreatedAt)
	if err != nil {
		return User{}, err
	}
	return u, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, nickname, email, password_hash, age, age_tier, language, avatar_url,
		       credit_balance, oauth_provider, oauth_subject, created_at
		FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Nickname, &u.Email, &u.PasswordHash, &u.Age, &u.AgeTier, &u.Language,
		&u.AvatarURL, &u.CreditBalance, &u.OAuthProvider, &u.OAuthSubject, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return u, nil
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, nickname, email, password_hash, age, age_tier, language, avatar_url,
		       credit_balance, oauth_provider, oauth_subject, created_at
		FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Nickname, &u.Email, &u.PasswordHash, &u.Age, &u.AgeTier, &u.Language,
		&u.AvatarURL, &u.CreditBalance, &u.OAuthProvider, &u.OAuthSubject, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return u, nil
}

func (r *Repository) SetPasswordHash(ctx context.Context, userID uuid.UUID, hash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, hash, userID)
	return err
}

func (r *Repository) SetNickname(ctx context.Context, userID uuid.UUID, nickname string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET nickname = $1, updated_at = now() WHERE id = $2`, nickname, userID)
	return err
}

func (r *Repository) UpdateAgeTier(ctx context.Context, userID uuid.UUID, age int16, tier string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET age = $1, age_tier = $2, updated_at = now() WHERE id = $3`, age, tier, userID)
	return err
}

func (r *Repository) CreateParentLink(ctx context.Context, p ParentLink) (ParentLink, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO parent_links (child_user_id, guardian_name, guardian_email)
		VALUES ($1, $2, $3) RETURNING id`,
		p.ChildUserID, p.GuardianName, p.GuardianEmail,
	).Scan(&p.ID)
	if err != nil {
		return ParentLink{}, err
	}
	return p, nil
}

func (r *Repository) GetParentLinkByChild(ctx context.Context, childUserID uuid.UUID) (ParentLink, error) {
	var p ParentLink
	err := r.pool.QueryRow(ctx, `
		SELECT id, child_user_id, guardian_name, guardian_email, verified_at
		FROM parent_links WHERE child_user_id = $1`, childUserID,
	).Scan(&p.ID, &p.ChildUserID, &p.GuardianName, &p.GuardianEmail, &p.VerifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentLink{}, ErrNotFound
	}
	return p, err
}

func (r *Repository) VerifyParentLink(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE parent_links SET verified_at = now() WHERE id = $1`, id)
	return err
}

// --- verification codes (registration / login OTP / password reset) ---

func (r *Repository) CreateVerificationCode(ctx context.Context, userID *uuid.UUID, email, purpose, codeHash string, ttl time.Duration) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO verification_codes (user_id, email, purpose, code_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, email, purpose, codeHash, time.Now().Add(ttl))
	return err
}

// LatestUnconsumedCode returns the most recent, unexpired, unconsumed code
// for (email, purpose), for verification and for resend-cooldown checks.
func (r *Repository) LatestUnconsumedCode(ctx context.Context, email, purpose string) (id uuid.UUID, codeHash string, expiresAt time.Time, createdAt time.Time, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT id, code_hash, expires_at, created_at FROM verification_codes
		WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
		ORDER BY created_at DESC LIMIT 1`, email, purpose,
	).Scan(&id, &codeHash, &expiresAt, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}

func (r *Repository) ConsumeCode(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE verification_codes SET consumed_at = now() WHERE id = $1`, id)
	return err
}

// --- sessions (refresh tokens) ---

func (r *Repository) CreateSession(ctx context.Context, userID uuid.UUID, refreshTokenHash string, ttl time.Duration) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
		VALUES ($1, $2, $3) RETURNING id`,
		userID, refreshTokenHash, time.Now().Add(ttl),
	).Scan(&id)
	return id, err
}

func (r *Repository) GetActiveSessionByTokenHash(ctx context.Context, tokenHash string) (Session, error) {
	var s Session
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, refresh_token_hash, expires_at, revoked_at
		FROM sessions
		WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`, tokenHash,
	).Scan(&s.ID, &s.UserID, &s.RefreshTokenHash, &s.ExpiresAt, &s.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	return s, err
}

func (r *Repository) RevokeSession(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE sessions SET revoked_at = now() WHERE id = $1`, id)
	return err
}
