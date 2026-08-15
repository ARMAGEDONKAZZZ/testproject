# Implementation Plan: Neuratop — AI Chess Puzzle Generator (MVP)

**Branch**: `001-neuratop-mvp` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-neuratop-mvp/spec.md`

## Summary

Build a full-stack web SaaS (Neuratop) that lets a user register with an age-appropriate
flow, request AI-generated chess puzzles, solve them on an interactive board with
assistive tools (hints, simplify, engine panel, timer, themes), organize puzzles into
folders/favorites, manage a profile (including a minor/parent-linked variant), and spend
credits on paid hint packages. Backend is a Go modular monolith over PostgreSQL; frontend
is a React + TypeScript SPA. **Puzzle generation, the AI chat assistant, and the
engine-analysis panel are explicitly mocked in this iteration** behind a fixture-backed
`Generator`/`Analyzer` interface — the user has a custom model they will provide separately
for that piece; everything around it (contracts, persistence, UI, business rules) is real.

## Technical Context

**Language/Version**: Go 1.23 (backend), TypeScript 5.x / Node 20 LTS (frontend tooling)

**Primary Dependencies**:
- Backend: `chi` (HTTP router/middleware), `pgx/v5` (Postgres driver, hand-written typed repositories — see research.md for the dropped-`sqlc` amendment), a small in-repo SQL migration runner (numbered files in `migrations/`), `golang-jwt/jwt/v5` (session tokens), `golang.org/x/crypto/bcrypt` (password hashing), `go-playground/validator/v10` (request validation), stdlib `log/slog` (structured logs), stdlib `testing` + `testify` (tests)
- Frontend: React 18, Vite, TypeScript, `react-router-dom`, `@tanstack/react-query` (server state), `zustand` (local UI state), `react-hook-form` + `zod` (forms/validation), Tailwind CSS (styling/design tokens), Radix UI primitives (accessible modal/dropdown/popover behavior), `chess.js` + `react-chessboard` (board rendering and client-side move-legality UX — not an AI/analysis engine), `react-i18next` (i18n scaffolding, RU complete for v1), `vitest` + `@testing-library/react` (unit), Playwright (e2e)

**Storage**: PostgreSQL 16

**Testing**: Go `testing`/`testify`/`httptest` + `testcontainers-go` against real Postgres for backend; Vitest/RTL for frontend units; Playwright for the register→generate→solve critical path (Constitution Principle VIII)

**Target Platform**: Linux server (containerized), evergreen desktop + mobile browsers (responsive per Figma breakpoints)

**Project Type**: Web application (frontend + backend, Option 2 structure)

**Performance Goals**: p95 API latency < 300ms for non-generation endpoints; puzzle-solving board interactions feel instant (< 100ms local feedback before server round-trip confirms)

**Constraints**: Server is the sole trust boundary for age-tier/consent/ownership rules (Constitution III); every displayed count/balance must reflect real backend state (FR-064) — no placeholder counters as seen in the audited design

**Scale/Scope**: Single-region MVP; design target low thousands of concurrent users; 6 audited screen groups / ~113 individual Figma frames mapped to 8 user stories and 64 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see bottom of this section.*

| Principle | Check | Result |
|---|---|---|
| I. Simplicity & Typed Code | Go (statically typed) + TypeScript strict everywhere; `sqlc` avoids a heavy ORM; no framework added without a concrete need | PASS |
| II. Figma Is the Design Source of Truth | All UI work traces to `docs/design-audit/*.md`; deviations (age-gate fix, mocked AI) are documented in spec Assumptions / this plan, not silent | PASS |
| III. Server-Owned Business Logic | Age-tier/consent, ownership, credit debits all enforced server-side; `chess.js` on the client is UX-only, backend is the correctness authority for stored state | PASS |
| IV. Typed, Consistent API Contracts | REST endpoints documented in `contracts/rest-api.md`; single JSON envelope for success/error (see Research) | PASS |
| V. Data Integrity by Design | `golang-migrate` forward-only migrations; FKs + indexes defined in `data-model.md` | PASS |
| VI. Security by Default | bcrypt, JWT with expiry, env-var secrets, per-endpoint rate limiting on auth/generation, server-enforced age gate | PASS |
| VII. Accessible, Responsive UI | Radix primitives for keyboard/focus-correct components; Tailwind breakpoints mirror the 1440 desktop-first Figma frames with graceful mobile reflow (no mobile frames exist in source — see Research) | PASS |
| VIII. Test-Backed Correctness | Backend: auth, ownership, credit-ledger, folder rules covered by tests; Frontend: critical e2e path; typecheck/lint gates before merge | PASS |
| IX. Deliberate Dependency Management | Every dependency above is justified per-use in Research; no duplicate-purpose libraries chosen | PASS |

**Deviation flagged for Complexity Tracking**: generation/chat/engine-analysis are mocked, not implemented against a real model — this is a scope decision from the user (see project memory), not a constitution violation, but it is tracked below because it means FR-017 ("every generated puzzle MUST be a verified-legal position") is satisfied only against a **static fixture set** for now, not a live verifier. This must be re-opened when the user's model is integrated.

*Post-Phase-1 re-check*: data model and contracts (below) keep the mock boundary isolated to one package (`internal/generation` behind a `Generator`/`Analyzer` interface) and one set of endpoints — nothing else in the design depends on a real model being present, so the deviation stays contained. Gate still PASSES.

## Project Structure

### Documentation (this feature)

```text
specs/001-neuratop-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── rest-api.md       # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── cmd/
│   └── api/
│       └── main.go              # entrypoint: config, DB pool, router, graceful shutdown
├── internal/
│   ├── platform/
│   │   ├── db/                  # pgx pool, sqlc-generated code, migrations runner
│   │   ├── httpserver/          # chi router setup, middleware (auth, logging, rate-limit, CORS)
│   │   └── config/              # env-var config struct + loader
│   ├── auth/                    # registration, age-gate/consent, login, password reset, sessions
│   ├── generation/               # Generator/Analyzer interfaces + fixture-backed mock impl, generation history
│   ├── puzzle/                  # puzzle CRUD, solve-attempt evaluation, hints, simplify
│   ├── folder/                  # folders, folder items, favorites, sharing
│   ├── profile/                 # identity, parent link, skills profile, board-design prefs
│   └── billing/                 # credit ledger, hint packages, transactions
├── migrations/                  # golang-migrate SQL files
├── fixtures/                    # static legal puzzle set + canned descriptions/eval used by the mock generator
├── go.mod
└── go.sum

frontend/
├── src/
│   ├── app/                     # router, providers (query client, auth context, i18n)
│   ├── pages/                   # one folder per route: auth/, generate/, puzzle/, folders/, favorites/, profile/
│   ├── components/              # shared design-system components (Button, Modal, Card, ChessBoardView, ...)
│   ├── features/                # feature-scoped hooks/state: auth, generation, puzzle-solving, folders, profile, billing
│   ├── api/                     # typed API client (generated/hand-written from contracts/rest-api.md)
│   ├── styles/                  # Tailwind config, design tokens from docs/design-audit palettes
│   └── i18n/                    # react-i18next setup, ru.json (complete), en.json/kz.json (scaffolded)
├── e2e/                          # Playwright specs
├── index.html
├── package.json
└── vite.config.ts

docker-compose.yml                # postgres + backend + frontend for local dev
```

**Structure Decision**: Option 2 (web application), monorepo with two top-level modules
(`backend/`, `frontend/`) sharing the repo root for docs/specs/CI. The Go backend is a
single deployable binary internally organized by domain package (matches the modular-
monolith decision — each `internal/*` package could become a separate service later
without a rewrite, but ships as one process now).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `generation` package returns fixture data instead of calling a real model/engine | User will supply their own model separately (see project memory `feedback_ai_generation_mocked`); building against Claude/OpenAI/Stockfish now would be thrown away | Waiting to build the whole feature until the model arrives was rejected because everything else (contracts, persistence, UI, credits, history) can and should be built and tested now against a stable mock boundary |
