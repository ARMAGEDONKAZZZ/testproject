-- Initial schema for Neuratop MVP. See specs/001-neuratop-mvp/data-model.md.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nickname        text NOT NULL UNIQUE,
    email           citext UNIQUE,
    password_hash   text,
    age             smallint NOT NULL CHECK (age >= 0 AND age <= 120),
    age_tier        text NOT NULL CHECK (age_tier IN ('child', 'teen', 'adult')),
    language        text NOT NULL DEFAULT 'ru',
    avatar_url      text,
    credit_balance  integer NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    oauth_provider  text CHECK (oauth_provider IN ('google', 'apple')),
    oauth_subject   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (oauth_provider, oauth_subject)
);

CREATE TABLE parent_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    child_user_id   uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    guardian_name   text NOT NULL,
    guardian_email  citext NOT NULL,
    verified_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  text NOT NULL UNIQUE,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE verification_codes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
    email        citext NOT NULL,
    purpose      text NOT NULL CHECK (purpose IN ('registration', 'login_otp', 'password_reset')),
    code_hash    text NOT NULL,
    expires_at   timestamptz NOT NULL,
    consumed_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_codes_lookup ON verification_codes (email, purpose, created_at DESC);

CREATE TABLE generations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_mode       text NOT NULL CHECK (input_mode IN ('text', 'tag', 'image', 'fen_pgn')),
    input_payload    jsonb NOT NULL,
    requested_count  smallint NOT NULL CHECK (requested_count BETWEEN 1 AND 4),
    status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    error_message    text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_generations_owner ON generations (owner_user_id, created_at DESC);

CREATE TABLE puzzles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generation_id       uuid REFERENCES generations(id) ON DELETE SET NULL,
    fen                 text NOT NULL,
    side_to_move        text NOT NULL CHECK (side_to_move IN ('white', 'black')),
    objective           text NOT NULL,
    solution_line       text[] NOT NULL,
    tag                 text NOT NULL,
    description         text NOT NULL,
    difficulty          smallint NOT NULL DEFAULT 0,
    simplified_from_id  uuid REFERENCES puzzles(id) ON DELETE SET NULL,
    simplify_depth      smallint NOT NULL DEFAULT 0 CHECK (simplify_depth <= 3),
    is_verified_legal   boolean NOT NULL DEFAULT true,
    mock_eval           jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_puzzles_owner ON puzzles (owner_user_id, created_at DESC);
CREATE INDEX idx_puzzles_tag ON puzzles (tag);

CREATE TABLE solve_attempts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    puzzle_id           uuid NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moves               jsonb NOT NULL DEFAULT '[]',
    outcome             text NOT NULL DEFAULT 'in_progress' CHECK (outcome IN ('in_progress', 'solved', 'solution_revealed', 'abandoned')),
    hints_used          smallint NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    solution_revealed   boolean NOT NULL DEFAULT false,
    simplify_count      smallint NOT NULL DEFAULT 0,
    started_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);
CREATE INDEX idx_solve_attempts_user_puzzle ON solve_attempts (user_id, puzzle_id);
CREATE UNIQUE INDEX idx_solve_attempts_one_in_progress
    ON solve_attempts (user_id, puzzle_id) WHERE outcome = 'in_progress';

CREATE TABLE skill_profiles (
    user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tactics      smallint NOT NULL DEFAULT 0 CHECK (tactics BETWEEN 0 AND 100),
    strategy     smallint NOT NULL DEFAULT 0 CHECK (strategy BETWEEN 0 AND 100),
    openings     smallint NOT NULL DEFAULT 0 CHECK (openings BETWEEN 0 AND 100),
    endgames     smallint NOT NULL DEFAULT 0 CHECK (endgames BETWEEN 0 AND 100),
    calculation  smallint NOT NULL DEFAULT 0 CHECK (calculation BETWEEN 0 AND 100),
    overall      smallint NOT NULL DEFAULT 0 CHECK (overall BETWEEN 0 AND 100),
    focus_axes   text[] NOT NULL DEFAULT '{}',
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT focus_axes_max_3 CHECK (cardinality(focus_axes) <= 3)
);

CREATE TABLE folders (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                  text NOT NULL DEFAULT 'Untitled',
    visibility            text NOT NULL CHECK (visibility IN ('private', 'public')),
    share_slug            text UNIQUE,
    share_password_hash   text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_folders_owner ON folders (owner_user_id);

CREATE TABLE folder_items (
    folder_id  uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    puzzle_id  uuid NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    added_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (folder_id, puzzle_id)
);

CREATE TABLE favorite_items (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id  uuid NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    added_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, puzzle_id)
);

CREATE TABLE board_preferences (
    user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme                 text NOT NULL DEFAULT 'default',
    piece_set             text NOT NULL DEFAULT 'classic',
    show_coordinates      boolean NOT NULL DEFAULT true,
    animation_speed_pct   smallint NOT NULL DEFAULT 72 CHECK (animation_speed_pct BETWEEN 0 AND 100),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hint_packages (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label          text NOT NULL,
    hint_count     integer,
    price_credits  integer NOT NULL,
    is_featured    boolean NOT NULL DEFAULT false,
    sort_order     smallint NOT NULL
);

CREATE TABLE credit_transactions (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount                    integer NOT NULL,
    reason                    text NOT NULL CHECK (reason IN ('topup_simulated', 'hint_package_purchase', 'adjustment')),
    related_puzzle_id         uuid REFERENCES puzzles(id) ON DELETE SET NULL,
    related_hint_package_id   uuid REFERENCES hint_packages(id) ON DELETE SET NULL,
    created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user ON credit_transactions (user_id, created_at DESC);

CREATE TABLE puzzle_hints (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solve_attempt_id       uuid NOT NULL REFERENCES solve_attempts(id) ON DELETE CASCADE,
    source                 text NOT NULL CHECK (source IN ('free', 'purchased')),
    credit_transaction_id  uuid REFERENCES credit_transactions(id) ON DELETE SET NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);
