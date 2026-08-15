# Neuratop — AI Chess Puzzle Generator

Full-stack web app: generate AI chess puzzles, solve them on an interactive
board, organize them into folders, and manage a profile that supports both
adult and minor (parent-linked) accounts.

Built by Spec-Driven Development — see [`specs/001-neuratop-mvp/`](specs/001-neuratop-mvp/)
for the full specification, technical plan, data model, API contracts, and
task breakdown, and [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
for governing engineering principles. The visual source of truth (Figma
exports) was audited screen-by-screen into [`docs/design-audit/`](docs/design-audit/)
before any code was written.

**Puzzle generation, the AI chat assistant, and the engine-analysis panel are
mocked** behind a fixture-backed interface — see `specs/001-neuratop-mvp/research.md`
("AI generation / chat / engine analysis") for why and how to swap in a real
model later.

## Stack

- **Backend**: Go 1.23+, `chi` router, `pgx/v5` (hand-written repositories, no ORM), PostgreSQL 16.
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS v4, TanStack Query, Zustand, React Router, react-i18next, Radix UI, `chess.js` + `react-chessboard`.

## Prerequisites

- Go 1.23+
- Node 20 LTS + npm
- Docker (for local Postgres)

## Local setup

```bash
# 1. Start Postgres
docker compose up -d postgres

# 2. Configure environment
cp .env.example .env   # then edit JWT secrets etc.

# 3. Apply migrations (seeds the hint-package catalog)
cd backend
export $(cat ../.env | xargs)  # or export the vars manually
go run ./cmd/migrate

# 4. Start the API server
go run ./cmd/api        # listens on :8080

# 5. In a second terminal, start the frontend
cd frontend
npm install
npm run dev              # listens on :5173, proxies /api to :8080
```

Open http://localhost:5173.

In development, `SMTP_HOST` is unset by default, so one-time registration/
login/password-reset codes are **logged to the backend's stdout** instead of
emailed — watch the server logs for `"logging verification code instead of
sending email"` and use the printed code.

## Verification

```bash
# Backend
cd backend
go build ./...
go vet ./...
go test ./...
gofmt -l .        # should print nothing

# Frontend
cd frontend
npx tsc -b
npx oxlint
npm run build
```

## Project layout

```text
backend/    Go modular monolith (internal/{auth,generation,puzzle,folder,profile,billing})
frontend/   React SPA (src/{pages,components,features,api,i18n})
specs/      Spec-Driven Development artifacts (spec, plan, data model, contracts, tasks)
docs/       Figma design audit (source of truth for UI/UX)
```

## Known limitations

- Puzzle generation, chat, and engine analysis are mocked (see above) — no
  real AI/chess-engine integration in this iteration.
- Credit top-up is simulated (no real payment gateway).
- OAuth (Google/Apple) is a documented mock — no real provider credentials.
- No automated test coverage for `generation`, `puzzle`, `billing` (backend)
  or any frontend component/e2e tests yet, despite Vitest/Playwright being
  configured — manual and direct-API verification was used instead this
  iteration.
- No dedicated responsive/mobile or accessibility audit pass yet.
