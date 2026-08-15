# Quickstart & Validation: Neuratop MVP

## Prerequisites

- Go 1.23+
- Node 20 LTS + npm
- Docker (for local Postgres via `docker-compose`)

## Local setup

```bash
docker compose up -d postgres
cd backend && go run ./cmd/migrate up   # applies migrations/, seeds hint_packages + puzzle fixtures
cd backend && go run ./cmd/api          # starts API on :8080
cd frontend && npm install && npm run dev   # starts SPA on :5173, proxies /api to :8080
```

Required environment variables (backend): `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `SMTP_*` (for OTP/reset emails — a local dev catch-all like
Mailpit is sufficient), `APP_ENV=development`. See `.env.example` (created in Phase 5).

## Validation scenarios (map to spec Acceptance Scenarios)

1. **Adult registration → login** (US1 #1, #3)
   - `POST /auth/register/start` with `age: 25` → confirm response `ageTier: "adult"`,
     no `parentConsentUrl`.
   - Complete email/OTP leg, pick a nickname, receive tokens.
   - `POST /auth/login` with the same credentials → `200` with fresh tokens.
   - `POST /auth/login` with wrong password → `401 WRONG_PASSWORD`.

2. **Minor registration requires guardian consent** (US1 #2)
   - `POST /auth/register/start` with `age: 10`, no `parent` object → expect `400
     VALIDATION_ERROR` (guardian required).
   - Retry with `parent: { name, email }` → `201`, and confirm the created user's
     `parent_links` row has `verified_at IS NULL` until the guardian verifies.

3. **Generate → solve core loop** (US2, US3; Playwright e2e)
   - Sign in, `POST /generations` with `inputMode: tag, payload: "mate-in-1", count: 1`.
   - Poll `GET /generations/:id` until `status: succeeded`; assert the returned puzzle's
     FEN parses as a legal position (fixture-backed, always true per FR-017 in mock mode).
   - `POST /puzzles/:id/attempts`, then `POST /attempts/:id/moves` with the fixture's known
     correct move → assert `correct: true, outcome: "solved"`.
   - Repeat with an incorrect move → assert `correct: false`, then `POST
     /attempts/:id/simplify` → assert a different, easier `puzzle` is returned.

4. **Folder organization** (US4 #1–2, #4)
   - `POST /folders` with `visibility: "private"` → assert default name `Untitled`.
   - `POST /folders/:id/items` with the solved puzzle's id → `GET /folders/:id/items`
     includes it.
   - `DELETE /folders/:id` without `confirm=true` → `409`; with it → `204`, then confirm
     the puzzle still appears in `GET /history`.

5. **Hint paywall** (US6, all scenarios)
   - Use 3 free hints via `POST /attempts/:id/hints` (assert `hintsRemaining` decreasing
     to 0).
   - 4th call → `402 HINTS_EXHAUSTED` with `hintPackages` in the body.
   - `POST /hint-packages/:id/purchase` → assert `balance` decreases by the package price
     and a subsequent `POST /attempts/:id/hints` succeeds.

6. **Sharing visibility** (US8 #1)
   - Create a public folder, `POST /folders/:id/share`, then `GET /share/:slug` with no
     auth → `200`.
   - `PATCH /folders/:id` to `visibility: "private"` → repeat `GET /share/:slug` → `404`.

## Definition of done for this feature (Constitution VIII / Development Workflow gate)

- `go build ./...` and `go vet ./...` clean; `golangci-lint run` clean.
- `npm run typecheck` and `npm run lint` clean.
- `go test ./...` (including `testcontainers-go` integration tests) green.
- `npm run test` (Vitest) and `npm run test:e2e` (Playwright, scenarios 3 and 2 above at
  minimum) green.
- `npm run build` produces a production frontend bundle without errors.
