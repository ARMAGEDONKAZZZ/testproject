# Phase 0 Research: Neuratop MVP

All items below were open questions in the Technical Context; each is resolved with a
decision, rationale, and rejected alternatives so no `NEEDS CLARIFICATION` remains.

## Architecture style

- **Decision**: Modular monolith — one Go binary, internal packages per domain (`auth`,
  `generation`, `puzzle`, `folder`, `profile`, `billing`).
- **Rationale**: Single small team, no domain currently needs independent scaling or
  independent deploy cadence; Constitution explicitly prefers one coherent architecture.
  Domain package boundaries keep a future service split possible without a rewrite.
- **Alternatives considered**: Microservices per domain — rejected: adds network calls,
  distributed tracing, service discovery, and multiple deploy pipelines for zero current
  benefit at this scale (user confirmed this is early-stage SaaS).

## Backend language/framework

- **Decision**: Go 1.23, `chi` router.
- **Rationale**: User specified Go. `chi` is a thin, idiomatic router/middleware library
  (not a full framework) — keeps stdlib `net/http` semantics, minimal magic, easy to test
  with `httptest`.
- **Alternatives considered**: stdlib `http.ServeMux` alone — workable but `chi`'s
  middleware chaining and route grouping meaningfully reduce boilerplate for ~40+
  endpoints across 6 domains, a justified single dependency. `gin`/`echo` — heavier,
  more magic/less idiomatic than needed; rejected per Constitution IX.

## Database access

- **Decision**: PostgreSQL via `pgx/v5`, hand-written repository structs/queries (no code
  generator); `golang-migrate`-style forward-only numbered SQL migration files (applied
  via a small `cmd/migrate` runner rather than the external `golang-migrate` CLI).
- **Rationale**: User specified Postgres. Plain `pgx` with explicit Go structs and
  `Scan()` calls keeps full static typing (Principle I) and explicit, reviewable SQL
  (Principle V) without adding a code-generation build step (`sqlc`) or its toolchain
  dependency — a deliberate simplification made during implementation (Principle IX:
  don't add a dependency/tool without a concrete, current need). `sqlc` remains a
  reasonable future upgrade if the number of hand-written queries becomes unwieldy.
- **Alternatives considered**: GORM — rejected, adds query-building magic and weaker
  compile-time guarantees. `sqlc` — considered and initially planned, but dropped in favor
  of hand-written `pgx` to avoid an extra external CLI/build step for the current scope;
  revisit if repository boilerplate grows past what's comfortable. Raw `database/sql` —
  rejected in favor of `pgx` for its better Postgres-native type support (e.g. arrays,
  `jsonb`) needed by this schema.

## Authentication

- **Decision**: Email + one-time code (primary) and email+password (returning login),
  Google/Apple OAuth as alternatives; short-lived JWT access token + longer-lived refresh
  token, both server-issued and verified; `bcrypt` for any stored password.
- **Rationale**: Matches the audited auth flow exactly (US1). JWT access/refresh is a
  standard, well-understood session model for a SPA + REST API split across two
  origins/deploys.
- **Alternatives considered**: Server-side session cookies only — workable, but JWT access
  tokens are simpler to reason about across the SPA/API boundary here since frontend and
  backend are separately deployable artifacts, not a single server-rendered app.

## AI generation / chat / engine analysis

- **Decision**: **Mocked for this iteration.** A `Generator` interface
  (`Generate(ctx, request) ([]Puzzle, error)`) and an `Analyzer` interface
  (`Evaluate(ctx, fen) (Evaluation, error)`) are defined in `internal/generation`; the only
  implementation shipped now is a fixture-backed mock that samples from a small
  (~20–30 entry) static set of real, legal, hand-verified chess puzzles (FEN + correct
  solution line + tag + pre-written description + pre-computed pseudo-eval/best-move/depth
  for the analysis panel), filtered by the user's requested tag/count where possible.
  The AI chat assistant returns canned, context-templated replies from the same package.
- **Rationale**: Explicit user instruction — a custom model will be supplied separately
  later (see project memory `feedback_ai_generation_mocked`); building against a
  third-party LLM or Stockfish now would be thrown away. Using a *static fixture of real,
  legal positions* (rather than random/fabricated FEN strings) keeps FR-017 ("no illegal
  position ever reaches the UI") satisfied even in mock mode, and keeps the mock
  indistinguishable from a real backend at the API-contract level — swapping the
  implementation later requires no contract or frontend change.
- **Alternatives considered**: Integrating Claude API or OpenAI now — rejected per
  explicit user instruction. Integrating Stockfish via UCI now — rejected, same reason
  (also named "Stockfish 16" in the audited design, but deferred). Fabricating random FEN
  strings for the mock — rejected, would violate FR-017 even in mock mode and produce a
  worse development/demo experience.

## Client-side chess rules (board interaction)

- **Decision**: `chess.js` (rules/legal-move generation) + `react-chessboard` (rendering)
  on the frontend, used purely for UX (drag/drop legality, highlighting, check detection
  for display) — **not** an AI/analysis engine and not the source of truth for solve
  correctness.
- **Rationale**: Any interactive chess board needs a rules library to know which squares
  are legal for a given piece; this is standard, unavoidable frontend tooling, distinct
  from the "AI/Stockfish" scope the user asked to defer. Backend remains authoritative:
  it evaluates a submitted move string against the fixture's known-correct line, never
  trusting client-side legality alone (Constitution III).
- **Alternatives considered**: A custom hand-rolled move-legality implementation —
  rejected as reinventing a well-tested, ubiquitous library for no benefit.

## Frontend framework

- **Decision**: React 18 + TypeScript + Vite SPA.
- **Rationale**: Product is fully behind authentication with no SEO/content-indexing need,
  so SSR (Next.js) adds complexity without payoff. React has the deepest ecosystem for the
  needed pieces (chessboard component, forms, i18n, accessible primitives) and is a safe,
  well-supported default per house guidance for building AI-adjacent apps quickly.
- **Alternatives considered**: Next.js — rejected, SSR/routing-file-convention overhead
  not justified for a pure authenticated SPA. Vue/Svelte — smaller ecosystem for the
  specific chess-board/i18n/accessible-primitive needs; no reason given by the user to
  prefer them.

## Styling / design system

- **Decision**: Tailwind CSS for utility styling + design tokens (colors, spacing)
  extracted from `docs/design-audit/*.md` palettes; Radix UI primitives (unstyled,
  accessible) for modal/dropdown/popover/tooltip behavior, styled with Tailwind.
- **Rationale**: Tailwind makes it fast to encode the exact dark-theme + neon-accent
  tokens found across all 6 audits consistently (Constitution: Maintainability & UX
  Consistency). Radix guarantees keyboard/focus-correct behavior for the many
  modals/menus/popovers documented in the audit (Constitution VII) without hand-rolling
  ARIA behavior.
- **Alternatives considered**: CSS Modules/hand-rolled CSS — rejected, slower to keep
  consistent across ~113 audited frames. MUI/Chakra (full component kits) — rejected,
  their default look actively fights the highly custom neon dark-theme design instead of
  helping.

## State management (frontend)

- **Decision**: TanStack Query for all server state (fetch/cache/invalidate API data);
  Zustand for local-only UI state (board interaction, open modals) where React context
  isn't enough.
- **Rationale**: Keeps server-state caching/invalidation (credits balance, folders,
  generation results) consistent and simple (Constitution I: simplest sufficient
  abstraction) without hand-rolled fetch/cache logic. Zustand avoids Redux's boilerplate
  for the comparatively small amount of pure client state needed.
- **Alternatives considered**: Redux Toolkit — rejected as heavier than needed for the
  actual amount of client-only state. Plain React Context for server state — rejected,
  reinvents caching/invalidation TanStack Query already solves well.

## Internationalization

- **Decision**: `react-i18next`, Russian locale complete for v1, English/Kazakh scaffolded
  (empty/placeholder catalogs) behind the same language switcher seen in the audited auth
  screens.
- **Rationale**: Spec Assumption: RU is the only fully specified language, but the
  presence of a real RU/EN/KZ switcher component in the design signals i18n is an intended
  long-term capability — building string-key-based i18n from day one avoids a costly
  hardcoded-string retrofit later, at negligible extra cost now.
- **Alternatives considered**: Hardcoded Russian strings — rejected, would contradict the
  designed language switcher and require a full rewrite to add EN/KZ later.

## Responsive strategy

- **Decision**: Desktop-first (1440px base, matching every audited frame), with standard
  Tailwind breakpoints (`sm`/`md`/`lg`/`xl`) applied for graceful reflow down to mobile
  widths using conventional patterns (collapsing sidebars to icon rails — already shown
  as a real state in the audit — stacking multi-column layouts).
- **Rationale**: No mobile/tablet frames exist in any of the 6 audited files (confirmed in
  `toolboard.md`); Constitution VII still requires responsive behavior, so standard,
  conservative reflow patterns are used rather than inventing a parallel mobile design.
- **Alternatives considered**: Mobile-first — rejected, would fight the desktop-only
  source material; Constitution: don't invent UI Figma doesn't specify.

## Payments / credit top-up

- **Decision**: A `PaymentProvider` interface behind the credit-purchase endpoint; the
  only implementation shipped now is a `SimulatedProvider` that instantly credits the
  account and records a transaction, clearly logged/flagged as non-real payment.
- **Rationale**: No merchant account or payment-gateway credentials exist in this
  environment; spec Assumption already scopes this. Keeping it behind an interface means
  swapping in a real provider (Stripe/YooKassa/etc.) later touches one package, not the
  whole credits feature.
- **Alternatives considered**: Building a real Stripe integration speculatively — rejected,
  no real credentials to test against and no business/legal setup confirmed.

## Testing strategy

- **Decision**: Backend — table-driven unit tests per package + `httptest`-based handler
  tests + `testcontainers-go` integration tests against real Postgres for
  repository/migration correctness. Frontend — Vitest/RTL component and hook tests;
  Playwright for the one critical end-to-end path (register → generate → solve →
  save-to-folder) plus the age-gate/consent path given its safety criticality.
- **Rationale**: Matches Constitution VIII exactly: critical backend logic and key
  end-to-end flows must have coverage; typecheck/lint/tests are part of Definition of
  Done.
- **Alternatives considered**: Mocking the DB entirely in backend tests — rejected per
  standing guidance to prefer real-database integration tests over mocks that can mask
  migration/query bugs.
