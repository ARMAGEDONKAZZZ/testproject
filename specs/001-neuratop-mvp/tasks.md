---

description: "Task list for Neuratop MVP implementation"
---

# Tasks: Neuratop — AI Chess Puzzle Generator (MVP)

**Input**: Design documents from `specs/001-neuratop-mvp/` (spec.md, plan.md, research.md, data-model.md, contracts/rest-api.md, quickstart.md)

**Tests**: Included, scoped to what Constitution Principle VIII requires — critical backend logic (auth/consent, move evaluation, credit ledger, folder ownership/sharing) and one key end-to-end flow per user story — not exhaustive TDD of every line.

**Organization**: Tasks are grouped by user story (spec.md priorities) so each story is an independently testable, demoable increment, per the constitution's Development Workflow gate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unfinished dependency)
- **[Story]**: US1–US8, matching spec.md
- Paths follow the `backend/` (Go) / `frontend/` (React+TS) layout from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create backend Go module structure per plan.md: `backend/go.mod`, `backend/cmd/api/`, `backend/internal/{platform,auth,generation,puzzle,folder,profile,billing}/`, `backend/migrations/`, `backend/fixtures/`
- [ ] T002 [P] Create frontend Vite+React+TS project structure per plan.md in `frontend/` (`src/app`, `pages`, `components`, `features`, `api`, `styles`, `i18n`, `e2e`)
- [ ] T003 [P] Create `docker-compose.yml` at repo root with a `postgres:16` service for local dev
- [ ] T004 [P] Configure Go linting in `backend/.golangci.yml` (golangci-lint)
- [ ] T005 [P] Configure frontend ESLint + Prettier in `frontend/.eslintrc.cjs`, `frontend/.prettierrc`
- [ ] T006 [P] Configure Tailwind CSS with design tokens (colors/spacing) transcribed from `docs/design-audit/*.md` palettes in `frontend/tailwind.config.ts`
- [ ] T007 [P] Implement backend env-var config loader in `backend/internal/platform/config/config.go`
- [ ] T008 [P] Create `.env.example` at repo root documenting `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_*`, `APP_ENV`
- [ ] T009 Set up CI workflow (typecheck, lint, test, build gates for both `backend/` and `frontend/`) in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user-story work starts until this phase is complete.

- [ ] T010 Write initial schema migration covering every table in data-model.md in `backend/migrations/0001_init.sql`
- [ ] T011 Write seed migration for `hint_packages` (5/49, 10/129 featured, unlimited/299) in `backend/migrations/0002_seed_hint_packages.sql`
- [ ] T012 [P] Configure `sqlc` (queries → typed Go) in `backend/internal/platform/db/sqlc.yaml`
- [ ] T013 [P] Implement `pgx` connection pool + migration runner in `backend/internal/platform/db/pool.go`
- [ ] T014 Implement `chi` router + middleware chain (request-id, recover, CORS) in `backend/internal/platform/httpserver/router.go`
- [ ] T015 Implement the shared JSON success/error envelope helpers (contracts/rest-api.md) in `backend/internal/platform/httpserver/envelope.go`
- [ ] T016 [P] Implement JWT access/refresh issuance + verification middleware in `backend/internal/platform/httpserver/auth_middleware.go`
- [ ] T017 [P] Implement structured request logging (`log/slog`) in `backend/internal/platform/httpserver/logging.go`
- [ ] T018 [P] Implement per-route rate-limiting middleware (used by auth + generation routes) in `backend/internal/platform/httpserver/ratelimit.go`
- [ ] T019 Wire config, DB pool, router, and graceful shutdown in `backend/cmd/api/main.go`
- [ ] T020 [P] Set up frontend app shell: router, `QueryClientProvider`, auth context in `frontend/src/app/`
- [ ] T021 [P] Set up `react-i18next` with a complete `ru.json` and scaffolded `en.json`/`kz.json` in `frontend/src/i18n/`
- [ ] T022 [P] Build base design-system components (Button, Input, Modal, Card, Toast, Pill, Popover) per the audited dark/neon palette in `frontend/src/components/`
- [ ] T023 [P] Implement the typed API client (envelope parsing, auth header injection, 401→refresh retry) in `frontend/src/api/client.ts`

**Checkpoint**: Foundation ready — user stories can now start.

---

## Phase 3: User Story 1 - Register and sign in, with an age-appropriate account (P1) 🎯 MVP

**Goal**: A visitor can register (adult or minor-with-consent), sign in, and recover a forgotten password.

**Independent Test**: Run `quickstart.md` scenarios 1–2 end-to-end against a fresh database.

### Tests for User Story 1

- [ ] T024 [P] [US1] Integration test: age-tier derivation ignores client-supplied tier; minor registration without `parent` is rejected in `backend/internal/auth/age_gate_test.go`
- [ ] T025 [P] [US1] Integration test: wrong-password error shape + rate-limit after 5 failures/15min in `backend/internal/auth/login_test.go`
- [ ] T026 [P] [US1] Playwright e2e: adult registration → login in `frontend/e2e/auth-adult.spec.ts`
- [ ] T027 [P] [US1] Playwright e2e: minor registration blocked without guardian consent in `frontend/e2e/auth-minor.spec.ts`

### Implementation for User Story 1

- [ ] T028 [P] [US1] `users`, `parent_links`, `sessions`, `verification_codes` sqlc queries in `backend/internal/auth/queries.sql`
- [ ] T029 [US1] Age-tier derivation + consent-gating service (depends on T028) in `backend/internal/auth/service.go`
- [ ] T030 [US1] `POST /auth/register/start|code|verify` handlers in `backend/internal/auth/handlers_register.go`
- [ ] T031 [US1] `POST /auth/register/oauth/:provider` (Google/Apple) in `backend/internal/auth/handlers_oauth.go`
- [ ] T032 [US1] `POST /auth/register/nickname` in `backend/internal/auth/handlers_nickname.go`
- [ ] T033 [US1] `POST /auth/login`, `/auth/refresh`, `/auth/logout` in `backend/internal/auth/handlers_session.go`
- [ ] T034 [US1] `POST /auth/password-reset/start|complete` in `backend/internal/auth/handlers_reset.go`
- [ ] T035 [US1] OTP/reset-code email sending in `backend/internal/auth/mailer.go`
- [ ] T036 [US1] Wire auth routes into `backend/internal/platform/httpserver/router.go`
- [ ] T037 [P] [US1] Registration pages (age-gate, email/OTP, OAuth, nickname) in `frontend/src/pages/auth/Register*.tsx`
- [ ] T038 [P] [US1] Login + forgot-password pages in `frontend/src/pages/auth/Login.tsx`, `ForgotPassword.tsx`
- [ ] T039 [US1] Auth API hooks (`useRegister`, `useLogin`, `useRefresh`) in `frontend/src/features/auth/hooks.ts`
- [ ] T040 [US1] Session persistence + silent refresh in `frontend/src/features/auth/session.ts`
- [ ] T041 [US1] Route guards (unauthenticated redirect, tier-aware routing) in `frontend/src/app/routeGuards.tsx`

**Checkpoint**: US1 fully functional and independently testable/deployable.

---

## Phase 4: User Story 2 - Generate chess puzzles with AI (P1)

**Goal**: A signed-in user generates 1–4 puzzles via text/tag/image/FEN input (mocked, fixture-backed generator).

**Independent Test**: `quickstart.md` scenario 3 (generate step) against a running US1+Foundational stack.

### Tests for User Story 2

- [ ] T042 [P] [US2] Test: empty generation request rejected (FR-014) in `backend/internal/generation/service_test.go`
- [ ] T043 [P] [US2] Test: mock generator only ever returns fixture-verified-legal puzzles (FR-017) in `backend/internal/generation/mock_generator_test.go`
- [ ] T044 [P] [US2] Playwright e2e: generate via tag → view carousel/grid result in `frontend/e2e/generate.spec.ts`

### Implementation for User Story 2

- [ ] T045 [P] [US2] Curate ~25 legal puzzle fixtures (FEN, solution line, tag, description, static eval) in `backend/fixtures/puzzles.json`
- [ ] T046 [US2] `Generator`/`Analyzer` interfaces + fixture-backed mock implementation in `backend/internal/generation/mock_generator.go`
- [ ] T047 [US2] `generations`, `puzzles` sqlc queries in `backend/internal/generation/queries.sql`
- [ ] T048 [US2] Generation service (create/poll/cancel, depends on T046-T047) in `backend/internal/generation/service.go`
- [ ] T049 [US2] `POST/GET /generations`, `GET /generations/:id`, `POST /generations/:id/cancel` handlers in `backend/internal/generation/handlers.go`
- [ ] T050 [US2] `GET /generations` (history), `POST /puzzles/:id/regenerate`, FEN endpoints in `backend/internal/generation/handlers_extra.go`
- [ ] T051 [US2] Wire generation routes into router
- [ ] T052 [P] [US2] Generation form (text/tag/image/FEN-PGN inputs, count stepper) in `frontend/src/pages/generate/GenerateForm.tsx`
- [ ] T053 [P] [US2] Generation progress + result carousel/grid in `frontend/src/pages/generate/GenerationResult.tsx`
- [ ] T054 [US2] FEN copy/paste dialog in `frontend/src/components/FenDialog.tsx`
- [ ] T055 [US2] Generation API hooks (`useGenerate`, `usePollGeneration`) in `frontend/src/features/generation/hooks.ts`

**Checkpoint**: US1+US2 independently functional.

---

## Phase 5: User Story 3 - Solve a puzzle on the board (P1)

**Goal**: Interactive board with correct/incorrect feedback, simplify, hints, export.

**Independent Test**: `quickstart.md` scenario 3 (solve step) seeded with a fixture puzzle directly.

### Tests for User Story 3

- [ ] T056 [P] [US3] Test: move evaluation against `solution_line` (FR-024) in `backend/internal/puzzle/attempt_test.go`
- [ ] T057 [P] [US3] Test: simplify depth capped at 3 (FR-026) in `backend/internal/puzzle/simplify_test.go`
- [ ] T058 [P] [US3] Test: 4th hint → `402 HINTS_EXHAUSTED` with packages (FR-027) in `backend/internal/puzzle/hints_test.go`
- [ ] T059 [P] [US3] Playwright e2e: full solve loop, correct/incorrect/simplify in `frontend/e2e/solve.spec.ts`

### Implementation for User Story 3

- [ ] T060 [P] [US3] `solve_attempts`, `puzzle_hints` sqlc queries in `backend/internal/puzzle/queries.sql`
- [ ] T061 [US3] Solve-attempt service (start/evaluate/outcome) in `backend/internal/puzzle/service.go`
- [ ] T062 [US3] Simplify service (fixture-linked easier variant, depth cap) in `backend/internal/puzzle/simplify.go`
- [ ] T063 [US3] Hint service (3 free, 402 handoff to billing) in `backend/internal/puzzle/hints.go`
- [ ] T064 [US3] `POST /puzzles/:id/attempts`, `/attempts/:id/{moves,simplify,hints,reveal-solution}` handlers in `backend/internal/puzzle/handlers.go`
- [ ] T065 [US3] `GET /attempts/:id/analysis` (mocked static eval/bestmove/depth) in `backend/internal/puzzle/handlers_analysis.go`
- [ ] T066 [US3] Favorite toggle + export (PGN/FEN/image) handlers in `backend/internal/puzzle/handlers_favorite_export.go`
- [ ] T067 [US3] Wire puzzle routes into router
- [ ] T068 [P] [US3] Interactive board (`react-chessboard` + `chess.js`) in `frontend/src/components/ChessBoardView.tsx`
- [ ] T069 [P] [US3] Puzzle-solving page (status banner, material indicator, toolbar) in `frontend/src/pages/puzzle/PuzzlePage.tsx`
- [ ] T070 [US3] Correct/incorrect/simplify UI states + AI message card in `frontend/src/pages/puzzle/SolveFeedback.tsx`
- [ ] T071 [US3] Hint button + paywall trigger in `frontend/src/pages/puzzle/HintButton.tsx`
- [ ] T072 [US3] Solve API hooks (`useAttempt`, `useSubmitMove`, `useSimplify`, `useHint`) in `frontend/src/features/puzzle/hooks.ts`

**Checkpoint**: US1–US3 complete = core loop MVP (register → generate → solve).

---

## Phase 6: User Story 4 - Organize puzzles: history, folders, favorites (P2)

**Goal**: History browsing, folder CRUD + 3 add-methods, favorites with filters, safe deletion.

**Independent Test**: `quickstart.md` scenario 4.

### Tests for User Story 4

- [ ] T073 [P] [US4] Test: folder delete requires `confirm=true`; puzzles survive (FR-038) in `backend/internal/folder/folder_test.go`
- [ ] T074 [P] [US4] Test: multi-select/drag-drop/context-menu add converge to same state (FR-036) in `backend/internal/folder/items_test.go`

### Implementation for User Story 4

- [ ] T075 [P] [US4] `folders`, `folder_items`, `favorite_items` sqlc queries in `backend/internal/folder/queries.sql`
- [ ] T076 [US4] Folder service (create/rename/visibility/delete) in `backend/internal/folder/service.go`
- [ ] T077 [US4] Folder-items service (add/remove, multi-select) in `backend/internal/folder/items_service.go`
- [ ] T078 [US4] Favorites service + tag/side filters in `backend/internal/folder/favorites_service.go`
- [ ] T079 [US4] Paginated history query in `backend/internal/folder/history_service.go`
- [ ] T080 [US4] `GET /history`, `/folders*`, `/favorites` handlers in `backend/internal/folder/handlers.go`
- [ ] T081 [US4] Wire folder routes into router
- [ ] T082 [P] [US4] History page with date grouping + empty state in `frontend/src/pages/history/HistoryPage.tsx`
- [ ] T083 [P] [US4] Folders sidebar + folder-detail page in `frontend/src/pages/folders/FoldersPage.tsx`
- [ ] T084 [P] [US4] Favorites page with filters in `frontend/src/pages/favorites/FavoritesPage.tsx`
- [ ] T085 [US4] Add-to-folder picker (popover multi-select, drag-drop target, context-menu item) in `frontend/src/components/AddToFolderPicker.tsx`
- [ ] T086 [US4] Create-folder + delete-confirm modals in `frontend/src/components/FolderModals.tsx`
- [ ] T087 [US4] Folders/favorites/history API hooks in `frontend/src/features/folders/hooks.ts`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Manage profile, skills, and account settings (P2)

**Goal**: Role-shaped profile (adult vs minor), skills pentagon, board-design preferences, safe account edits.

**Independent Test**: `quickstart.md` scenario 2 extended to profile edit; manual check of adult vs minor profile shape.

### Tests for User Story 5

- [ ] T088 [P] [US5] Test: minor `/me` response has no email field and `DELETE /me` is forbidden (FR-044) in `backend/internal/profile/profile_test.go`
- [ ] T089 [P] [US5] Test: age edit crossing tier without existing verified consent → `409 CONSENT_REQUIRED` (FR-045) in `backend/internal/profile/age_edit_test.go`

### Implementation for User Story 5

- [ ] T090 [P] [US5] `skill_profiles`, `board_preferences` sqlc queries in `backend/internal/profile/queries.sql`
- [ ] T091 [US5] Profile service (get/update, role-shaped response) in `backend/internal/profile/service.go`
- [ ] T092 [US5] Skills service (compute from solve history, manual focus-axes) in `backend/internal/profile/skills_service.go`
- [ ] T093 [US5] Board-preferences service in `backend/internal/profile/board_prefs_service.go`
- [ ] T094 [US5] `GET/PATCH /me`, `/me/password`, `DELETE /me`, `/me/skills*`, `/me/board-preferences` handlers in `backend/internal/profile/handlers.go`
- [ ] T095 [US5] Parent-link verification endpoint in `backend/internal/profile/handlers_parent.go`
- [ ] T096 [US5] Wire profile routes into router
- [ ] T097 [P] [US5] Adult profile page (identity/contacts/skills/delete) in `frontend/src/pages/profile/ProfilePage.tsx`
- [ ] T098 [US5] Minor profile variant (parent-account card, no delete option) — conditional render in `frontend/src/pages/profile/ProfilePage.tsx`
- [ ] T099 [P] [US5] Chess Skills Pentagon modal (radar chart, focus-axis picker) in `frontend/src/components/SkillsPentagon.tsx`
- [ ] T100 [P] [US5] Board Design settings page in `frontend/src/pages/profile/BoardDesignPage.tsx`
- [ ] T101 [US5] Edit-profile modal with consent-required handling in `frontend/src/components/EditProfileModal.tsx`
- [ ] T102 [US5] Profile API hooks in `frontend/src/features/profile/hooks.ts`

**Checkpoint**: US1–US5 independently functional.

---

## Phase 8: User Story 6 - Buy more hints with credits (P2)

**Goal**: Credit balance, hint paywall with 3 packages, simulated top-up.

**Independent Test**: `quickstart.md` scenario 5.

### Tests for User Story 6

- [ ] T103 [P] [US6] Test: hint-package purchase atomically debits credits + grants hints (FR-054) in `backend/internal/billing/purchase_test.go`
- [ ] T104 [P] [US6] Test: insufficient balance → `402 INSUFFICIENT_CREDITS` in `backend/internal/billing/purchase_test.go`

### Implementation for User Story 6

- [ ] T105 [P] [US6] `hint_packages`, `credit_transactions` sqlc queries in `backend/internal/billing/queries.sql`
- [ ] T106 [US6] Credit-ledger service (transactional debit/credit, balance invariant) in `backend/internal/billing/service.go`
- [ ] T107 [US6] Simulated `PaymentProvider` + topup in `backend/internal/billing/simulated_provider.go`
- [ ] T108 [US6] `GET /me/credits`, `/hint-packages`, `POST .../purchase`, `GET /me/transactions` handlers in `backend/internal/billing/handlers.go`
- [ ] T109 [US6] Wire billing routes into router
- [ ] T110 [P] [US6] Global header credit-balance display in `frontend/src/components/CreditBalance.tsx`
- [ ] T111 [US6] Hint paywall modal (3 packages, "выгодно" badge) in `frontend/src/components/HintPaywallModal.tsx`
- [ ] T112 [US6] Billing API hooks in `frontend/src/features/billing/hooks.ts`

**Checkpoint**: US1–US6 independently functional.

---

## Phase 9: User Story 7 - Use advanced solving tools (P3)

**Goal**: Engine panel, Play vs AI, chat, timer, rules-content list — all mocked where AI/engine is involved.

**Independent Test**: Open each tool from an existing puzzle screen and confirm it behaves per spec Acceptance Scenarios.

- [ ] T113 [P] [US7] Engine-analysis panel UI (consumes mocked `/attempts/:id/analysis`) in `frontend/src/components/EngineAnalysisPanel.tsx`
- [ ] T114 [P] [US7] Play-vs-AI mode (separate game state/difficulty) in `frontend/src/pages/puzzle/PlayVsAiPage.tsx` + `backend/internal/puzzle/handlers_play.go`
- [ ] T115 [P] [US7] AI chat panel (canned/templated responses) in `frontend/src/components/AiChatPanel.tsx` + `backend/internal/generation/handlers_chat.go`
- [ ] T116 [P] [US7] Timer tool (duration presets, sound toggle) in `frontend/src/components/TimerTool.tsx`
- [ ] T117 [P] [US7] Chess-rules "List" learning-content panel (static content) in `frontend/src/components/RulesListPanel.tsx` + `backend/fixtures/rules_content.json`

**Checkpoint**: US1–US7 independently functional.

---

## Phase 10: User Story 8 - Share and publish folders/puzzles (P3)

**Goal**: Public share links, optional password, social share targets.

**Independent Test**: `quickstart.md` scenario 6.

### Tests for User Story 8

- [ ] T118 [P] [US8] Test: making a folder private revokes existing share-link access in `backend/internal/folder/share_test.go`

### Implementation for User Story 8

- [ ] T119 [US8] Share-link + password-gated view service in `backend/internal/folder/share_service.go`
- [ ] T120 [US8] `POST /folders/:id/share`, `GET /share/:slug` handlers in `backend/internal/folder/handlers_share.go`
- [ ] T121 [US8] Wire share routes into router
- [ ] T122 [P] [US8] Share modal (visibility, password, copy link, social icons) in `frontend/src/components/ShareModal.tsx`
- [ ] T123 [US8] Public share view page (unauthenticated) in `frontend/src/pages/share/SharedFolderPage.tsx`

**Checkpoint**: All 8 user stories independently functional — full feature set complete.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T124 [P] Responsive pass down to mobile breakpoints across all pages in `frontend/src/pages/**`
- [ ] T125 [P] Accessibility pass (keyboard nav, focus states, ARIA labels) across `frontend/src/components/**`
- [ ] T126 [P] Complete/verify Russian copy, eliminate mixed-language strings (SC-010) in `frontend/src/i18n/ru.json`
- [ ] T127 [P] Security hardening pass (CORS allowlist, security headers, `go mod`/`npm audit`) in `backend/internal/platform/httpserver/`
- [ ] T128 Run all `quickstart.md` validation scenarios end-to-end against a clean environment
- [ ] T129 Verify backend production build (`go build ./...`) and `go vet`/`golangci-lint`
- [ ] T130 Verify frontend production build (`npm run build`) and `typecheck`/`lint`
- [ ] T131 [P] Write repo-root `README.md` with local-dev setup instructions
- [ ] T132 Final self-review against `constitution.md`, `spec.md`, and all six `docs/design-audit/*.md` files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — blocks every user story.
- **US1 (Phase 3)**: depends on Foundational only. Blocks nothing structurally, but every other story needs an authenticated user, so US1 is the practical starting point.
- **US2 (Phase 4)**: depends on Foundational + US1 (needs a signed-in user).
- **US3 (Phase 5)**: depends on Foundational + US2 (needs a puzzle to solve) — can be developed against seeded fixtures without waiting on US2's UI.
- **US4–US8 (Phases 6–10)**: each depends on Foundational + US1; most also read `puzzles` (US2/US3) but do not require US2/US3's UI to exist, only the `puzzles` table — independently testable via direct fixture seeding per each phase's "Independent Test" line.
- **Polish (Phase 11)**: depends on all desired user stories being complete.

### Parallel Opportunities

- All `[P]`-marked tasks within a phase touch different files and can run concurrently.
- Once Foundational (Phase 2) is done, US4, US5, US6, US7, US8 can be staffed in parallel by different developers even before US2/US3 UI exists, since they only need the `puzzles` table (seed fixtures directly for their own independent tests).
- Within any story: tests marked `[P]` run together; backend and frontend implementation tasks for the same story are largely parallel once their shared contract (contracts/rest-api.md) is fixed.

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3).
2. **STOP and VALIDATE**: run `quickstart.md` scenarios 1–3. This is the demoable core loop (register → generate → solve).

### Incremental Delivery

3. Add US4 (organization) → validate scenario 4 → demo.
4. Add US5 (profile/skills) + US6 (credits) → validate scenarios 2(extended)/5 → demo.
5. Add US7 (advanced tools) + US8 (sharing) → validate scenario 6 → demo.
6. Phase 11 polish, then final self-review (Phase 6 of the overall project lifecycle).
