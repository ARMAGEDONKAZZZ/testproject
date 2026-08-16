-- Per-user first-run onboarding progress (wizard + the two contextual
-- coach-mark tours). Mirrors board_preferences: one row per user, lazily
-- created on first read.
CREATE TABLE onboarding_state (
    user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role                  text CHECK (role IN ('student', 'teacher')),
    declared_level        text CHECK (declared_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    wizard_completed      boolean NOT NULL DEFAULT false,
    home_tour_completed   boolean NOT NULL DEFAULT false,
    puzzle_tour_completed boolean NOT NULL DEFAULT false,
    updated_at            timestamptz NOT NULL DEFAULT now()
);
