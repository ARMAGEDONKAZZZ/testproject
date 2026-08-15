# Phase 1 Data Model: Neuratop MVP

PostgreSQL 16. All primary keys are `uuid` (generated `gen_random_uuid()`). All tables
have `created_at timestamptz not null default now()`; mutable tables also have
`updated_at timestamptz not null default now()`. Money/credits are integers (whole
credits, no fractional currency in scope).

## users

Represents `User` from the spec.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| nickname | text | not null, unique |
| email | citext | unique, nullable (null for a minor with no self-owned email) |
| password_hash | text | nullable (null if OAuth-only or minor with `Not set`) |
| age | smallint | not null, check (age >= 0 and age <= 120) |
| age_tier | text | not null, check in (`child`, `teen`, `adult`), derived from `age` server-side on every write, never trusted from client |
| language | text | not null, default `ru` |
| avatar_url | text | nullable |
| credit_balance | integer | not null, default 0, check (credit_balance >= 0) |
| oauth_provider | text | nullable, check in (`google`, `apple`), nullable if password/code auth |
| oauth_subject | text | nullable, unique with `oauth_provider` |
| created_at / updated_at | timestamptz | |

**Rules**: `age_tier` is a generated/derived value recomputed by the application layer on
every registration and every profile-age edit (FR-001–003, FR-045) — never accepted
directly from the client. `email` + `password_hash` are both nullable but a user MUST have
at least one authenticatable path (a `CHECK`/application invariant): `password_hash IS NOT
NULL` OR `oauth_provider IS NOT NULL` OR (age_tier != 'adult' AND an active `parent_links`
row exists, since a minor authenticates through the guardian relationship — see below).

## parent_links

Represents `ParentLink`. One row per minor user; a guardian may guard multiple children.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| child_user_id | uuid | FK → users.id, unique, not null |
| guardian_name | text | not null |
| guardian_email | citext | not null |
| verified_at | timestamptz | nullable (null until guardian confirms via emailed link) |
| created_at | timestamptz | |

**Rules**: A row MUST exist for any `users` row with `age_tier IN ('child','teen')`
(FR-002) — enforced at the application/service layer at registration time and re-checked
on every age-tier-crossing edit (FR-045). `verified_at IS NOT NULL` gates the "verified"
badge shown on the minor's profile (FR-051).

## sessions

Refresh-token records (access tokens are stateless JWT, not stored).

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null, on delete cascade |
| refresh_token_hash | text | not null, unique |
| expires_at | timestamptz | not null |
| revoked_at | timestamptz | nullable |
| created_at | timestamptz | |

Index: `(user_id)`, `(expires_at)` for cleanup jobs.

## password_reset_codes / verification_codes

One shared table for one-time codes (registration email verification, login OTP,
password reset) distinguished by `purpose`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, nullable (nullable pre-registration, keyed by email instead) |
| email | citext | not null |
| purpose | text | not null, check in (`registration`, `login_otp`, `password_reset`) |
| code_hash | text | not null |
| expires_at | timestamptz | not null |
| consumed_at | timestamptz | nullable |
| created_at | timestamptz | |

Index: `(email, purpose, created_at)` — used to enforce resend rate-limiting (FR-009).

## puzzles

Represents `Puzzle`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | FK → users.id, not null (the user who generated/owns it) |
| generation_id | uuid | FK → generations.id, nullable |
| fen | text | not null |
| side_to_move | text | not null, check in (`white`, `black`) |
| objective | text | not null (e.g. "Мат в 2 хода") |
| solution_line | text[] | not null (ordered list of moves in the intended solution) |
| tag | text | not null (e.g. `tactics`, `mate-in-1`, `endgame`, `opening-trap`) |
| description | text | not null (AI/mock-generated tactical-idea text) |
| difficulty | smallint | not null, default 0 |
| simplified_from_id | uuid | FK → puzzles.id, nullable (self-reference for the "Упростить задачу" chain) |
| simplify_depth | smallint | not null, default 0, check (simplify_depth <= 3) |
| is_verified_legal | boolean | not null, default true (FR-017 — mock generator only emits `true` rows, sourced from the fixture set) |
| created_at | timestamptz | |

Index: `(owner_user_id, created_at desc)` for history; `(tag)`.

## generations

Represents `Generation`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | FK → users.id, not null |
| input_mode | text | not null, check in (`text`, `tag`, `image`, `fen_pgn`) |
| input_payload | jsonb | not null (raw text/tag id/image ref/FEN-PGN string) |
| requested_count | smallint | not null, check (requested_count between 1 and 4) |
| status | text | not null, check in (`pending`, `succeeded`, `failed`), default `pending` |
| error_message | text | nullable |
| created_at / updated_at | timestamptz | |

Index: `(owner_user_id, created_at desc)`.

## solve_attempts

Represents `SolveAttempt`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| puzzle_id | uuid | FK → puzzles.id, not null |
| user_id | uuid | FK → users.id, not null |
| moves | jsonb | not null, default `[]` (ordered list of {move, correct} entries) |
| outcome | text | not null, check in (`in_progress`, `solved`, `solution_revealed`, `abandoned`), default `in_progress` |
| hints_used | smallint | not null, default 0, check (hints_used >= 0) |
| solution_revealed | boolean | not null, default false |
| simplify_count | smallint | not null, default 0 |
| started_at | timestamptz | not null, default now() |
| completed_at | timestamptz | nullable |

Index: `(user_id, puzzle_id)`; unique partial index on `(user_id, puzzle_id) WHERE outcome
= 'in_progress'` to prevent duplicate concurrent attempts.

## skill_profiles

Represents `SkillProfile` (one row per user, upserted as solve history accumulates).

| Column | Type | Constraints |
|---|---|---|
| user_id | uuid | PK, FK → users.id |
| tactics | smallint | not null, default 0, check (0–100) |
| strategy | smallint | not null, default 0, check (0–100) |
| openings | smallint | not null, default 0, check (0–100) |
| endgames | smallint | not null, default 0, check (0–100) |
| calculation | smallint | not null, default 0, check (0–100) |
| overall | smallint | not null, default 0, check (0–100) |
| focus_axes | text[] | not null, default `{}`, check (cardinality(focus_axes) <= 3) |
| updated_at | timestamptz | |

## folders

Represents `Folder`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | FK → users.id, not null |
| name | text | not null, default `Untitled` |
| visibility | text | not null, check in (`private`, `public`) |
| share_slug | text | unique, nullable (assigned on first share) |
| share_password_hash | text | nullable |
| created_at / updated_at | timestamptz | |

Index: `(owner_user_id)`; unique `(share_slug)` where not null.

## folder_items

Represents `FolderItem` (join table).

| Column | Type | Constraints |
|---|---|---|
| folder_id | uuid | FK → folders.id, on delete cascade |
| puzzle_id | uuid | FK → puzzles.id, on delete cascade |
| added_at | timestamptz | |

PK: `(folder_id, puzzle_id)`.

## favorite_items

Represents `FavoriteItem`.

| Column | Type | Constraints |
|---|---|---|
| user_id | uuid | FK → users.id, on delete cascade |
| puzzle_id | uuid | FK → puzzles.id, on delete cascade |
| added_at | timestamptz | |

PK: `(user_id, puzzle_id)`.

## board_preferences

One row per user (Board Design settings from Profile).

| Column | Type | Constraints |
|---|---|---|
| user_id | uuid | PK, FK → users.id |
| theme | text | not null, default `default` |
| piece_set | text | not null, default `classic` |
| show_coordinates | boolean | not null, default true |
| animation_speed_pct | smallint | not null, default 72, check (0–100) |
| updated_at | timestamptz | |

## hint_packages

Represents `HintPackage` — small fixed catalog, seeded via migration, not user-editable.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| label | text | not null (e.g. "10 подсказок") |
| hint_count | integer | nullable (null = unlimited-for-puzzle) |
| price_credits | integer | not null |
| is_featured | boolean | not null, default false ("выгодно" badge) |
| sort_order | smallint | not null |

Seed rows: 5 hints / 49 credits; 10 hints / 129 credits (`is_featured = true`); unlimited /
299 credits — taken directly from the audited paywall (toolboard.md).

## credit_transactions

Represents `CreditTransaction`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null |
| amount | integer | not null (signed: negative = spend, positive = top-up) |
| reason | text | not null, check in (`topup_simulated`, `hint_package_purchase`, `adjustment`) |
| related_puzzle_id | uuid | FK → puzzles.id, nullable |
| related_hint_package_id | uuid | FK → hint_packages.id, nullable |
| created_at | timestamptz | |

Index: `(user_id, created_at desc)`. `users.credit_balance` is maintained as the running
sum of this table, updated transactionally in the same DB transaction as each insert
(never computed ad hoc from the client).

## puzzle_hints

Tracks per-attempt hint consumption distinctly from `solve_attempts.hints_used` so a
purchased package's extra hints are auditable per puzzle.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| solve_attempt_id | uuid | FK → solve_attempts.id, not null |
| source | text | not null, check in (`free`, `purchased`) |
| credit_transaction_id | uuid | FK → credit_transactions.id, nullable (set when `source = 'purchased'`) |
| created_at | timestamptz | |

## Entity relationship summary

```text
users 1─1 parent_links (child_user_id)          [required if age_tier != adult]
users 1─N sessions
users 1─N generations 1─N puzzles
users 1─N puzzles (owner)
puzzles 1─N solve_attempts N─1 users
users 1─1 skill_profiles
users 1─N folders 1─N folder_items N─1 puzzles
users 1─N favorite_items N─1 puzzles
users 1─1 board_preferences
users 1─N credit_transactions
solve_attempts 1─N puzzle_hints N─1 credit_transactions (optional)
puzzles 1─N puzzles (self-ref via simplified_from_id)
```

## State transitions

- **generations.status**: `pending → succeeded` | `pending → failed` (terminal; a retry
  creates a new `generations` row, per FR-022 "form remains re-submittable without data
  loss" — we never mutate a failed generation back to pending).
- **solve_attempts.outcome**: `in_progress → solved` | `in_progress → solution_revealed` |
  `in_progress → abandoned` (abandoned set by a scheduled job after prolonged inactivity,
  not by direct user action — no design signal for an explicit "give up" button).
- **users.age_tier**: recomputed on every write to `age`; a transition INTO `child`/`teen`
  from `adult` is blocked unless a verified `parent_links` row is created in the same
  operation (FR-045); a transition OUT of `child`/`teen` into `adult` is always allowed
  (loosening a restriction needs no extra consent).
- **folders.visibility**: `private ⇄ public` freely by the owner; flipping to `private`
  immediately invalidates the existing `share_slug` for non-owners at the authorization
  layer (row is kept for history, access is what's revoked) (US8 Scenario 1).
