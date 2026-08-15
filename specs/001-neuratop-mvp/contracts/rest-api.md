# Phase 1 Contracts: REST API

Base path: `/api/v1`. JSON over HTTPS. Auth via `Authorization: Bearer <access_jwt>`
unless marked **Public**.

## Envelope (applies to every endpoint)

Success:

```json
{ "data": { /* endpoint-specific payload */ }, "meta": { /* optional, e.g. pagination */ } }
```

Error (Constitution IV — one consistent shape everywhere):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable, localized message", "details": { "field": "email" } } }
```

Standard `code` values used across endpoints: `VALIDATION_ERROR` (400),
`UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
`RATE_LIMITED` (429), `INTERNAL_ERROR` (500). Endpoint-specific codes are noted inline.

---

## Auth (`internal/auth`) — FR-001–012

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/auth/register/start` | Public | `{ age, ageTier, email?, parent?: { name, email } }` | `201 { data: { registrationId } }` | `ageTier` is recomputed server-side from `age`, client value ignored (FR-001–003). `parent` required and validated when computed tier ≠ adult. |
| POST | `/auth/register/code` | Public | `{ registrationId, email }` | `202 {}` | Sends OTP; rate-limited (FR-009). |
| POST | `/auth/register/verify` | Public | `{ registrationId, code, password? }` | `200 { data: { accessToken, refreshToken } }` | Completes email/password leg. |
| POST | `/auth/register/oauth/:provider` | Public | `{ oauthCode }` | `200 { data: { accessToken, refreshToken } }` | `provider` ∈ `google\|apple`. |
| POST | `/auth/register/nickname` | Bearer (pre-final) | `{ nickname }` | `200 { data: { user } }` | FR-005. |
| POST | `/auth/login` | Public | `{ email, password }` | `200 { data: { accessToken, refreshToken } }` \| `401 WRONG_PASSWORD` | Rate-limited per account+IP (FR-007). |
| POST | `/auth/refresh` | Public (refresh token in body) | `{ refreshToken }` | `200 { data: { accessToken, refreshToken } }` | Rotates refresh token. |
| POST | `/auth/logout` | Bearer | `{}` | `204` | Revokes current session (FR-050). |
| POST | `/auth/password-reset/start` | Public | `{ email }` | `202 {}` | Always 202 regardless of email existing (no enumeration). |
| POST | `/auth/password-reset/complete` | Public | `{ email, code, newPassword }` | `200 {}` | FR-008. |

---

## Generation (`internal/generation`) — FR-013–023 *(mocked provider, see plan.md)*

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/generations` | Bearer | `{ inputMode: text\|tag\|image\|fen_pgn, payload, count (1-4) }` | `202 { data: { generationId, status: "pending" } }` | FR-014 validation: 400 `MISSING_INPUT` if payload empty. |
| GET | `/generations/:id` | Bearer | – | `200 { data: { generation, puzzles: [...] } }` | Poll until `status = succeeded\|failed` (FR-016). |
| POST | `/generations/:id/cancel` | Bearer | – | `200 {}` | FR-016. |
| GET | `/generations` | Bearer | query `page,pageSize` | `200 { data: [generation...], meta: { page } }` | "История генераций" (FR-023). |
| POST | `/puzzles/:id/regenerate` | Bearer | – | `202 { data: { generationId } }` | Regenerate one puzzle from a result set (FR-021). |
| GET | `/fen/current/:puzzleId` | Bearer | – | `200 { data: { fen } }` | Copy-FEN dialog. |
| POST | `/generations/fen` | Bearer | `{ fen, count }` | `202 { data: { generationId } }` | Generate from pasted FEN (FR-013, count defaults to 1 per Assumptions). |

---

## Puzzles & solving (`internal/puzzle`) — FR-024–033

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/puzzles/:id` | Bearer | – | `200 { data: { puzzle } }` | Never includes `solutionLine` unless attempt is `solved`/`solution_revealed`. |
| POST | `/puzzles/:id/attempts` | Bearer | `{}` | `201 { data: { attemptId } }` | Idempotent — returns existing `in_progress` attempt if one exists. |
| POST | `/attempts/:id/moves` | Bearer | `{ move }` | `200 { data: { correct: bool, outcome } }` | FR-024–025. Server-authoritative comparison against `solution_line`. |
| POST | `/attempts/:id/simplify` | Bearer | `{}` | `200 { data: { puzzle } }` \| `409 SIMPLIFY_LIMIT_REACHED` | FR-026, capped at `simplify_depth ≤ 3`. |
| POST | `/attempts/:id/hints` | Bearer | `{}` | `200 { data: { hint, hintsRemaining } }` \| `402 HINTS_EXHAUSTED` | FR-027; `402` response body includes `hintPackages` to drive the paywall (US6). |
| POST | `/attempts/:id/reveal-solution` | Bearer | `{}` | `200 { data: { solutionLine } }` | FR-028; sets `outcome = solution_revealed`. |
| GET | `/attempts/:id/analysis` | Bearer | – | `200 { data: { evaluation, bestMove, depth } }` | **Mocked** per-fixture static values (Research: AI generation / engine analysis). |
| POST | `/puzzles/:id/favorite` | Bearer | `{}` | `204` | Idempotent add. |
| DELETE | `/puzzles/:id/favorite` | Bearer | – | `204` | Idempotent remove (FR-030). |
| GET | `/puzzles/:id/export` | Bearer | query `format=pgn\|fen\|image` | `200` (file) | FR-031. |

---

## Folders, favorites, history (`internal/folder`) — FR-034–042

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/history` | Bearer | query `page,pageSize` | `200 { data: [puzzle...] }` | FR-034; empty-state signaled by empty array + `meta.total = 0` (FR-041 handled client-side). |
| GET | `/folders` | Bearer | – | `200 { data: { private: [...], public: [...] } }` | |
| POST | `/folders` | Bearer | `{ visibility }` | `201 { data: { folder } }` | Name-less create, default `Untitled` (FR-035). |
| PATCH | `/folders/:id` | Bearer, owner | `{ name?, visibility? }` | `200 { data: { folder } }` | Rename / visibility toggle. |
| DELETE | `/folders/:id` | Bearer, owner | – | `204` | Requires `confirm=true` query param, else `409 CONFIRMATION_REQUIRED` (FR-038). Puzzles are NOT deleted. |
| GET | `/folders/:id/items` | Bearer (owner or valid share) | – | `200 { data: [puzzle...] }` | |
| POST | `/folders/:id/items` | Bearer, owner | `{ puzzleIds: [...] }` | `204` | Multi-select add (FR-036). |
| DELETE | `/folders/:id/items/:puzzleId` | Bearer, owner | – | `204` | FR-037. |
| POST | `/folders/:id/share` | Bearer, owner | `{ password? }` | `200 { data: { shareUrl, slug } }` | Only valid while `visibility = public` (FR-058–059). |
| GET | `/share/:slug` | Public | header `X-Share-Password?` | `200 { data: { folder, items } }` \| `401 PASSWORD_REQUIRED` | Public read-only view; 404 if folder is private/unpublished. |
| GET | `/favorites` | Bearer | query `tag?, sideToMove?` | `200 { data: [puzzle...] }` | FR-040. |

---

## Profile (`internal/profile`) — FR-043–051

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/me` | Bearer | – | `200 { data: { user, parentLink?, skillProfile, boardPreferences } }` | Shape varies by `ageTier` per FR-043–044 (client renders accordingly; server never sends an email field for a minor). |
| PATCH | `/me` | Bearer | `{ name?, age?, avatarUrl? }` | `200 { data: { user } }` \| `409 CONSENT_REQUIRED` | FR-045: an age edit crossing into `child`/`teen` without an existing verified `parent_links` row is rejected with `409` and a `parentConsentUrl` to complete. |
| POST | `/me/password` | Bearer, adult only | `{ currentPassword?, newPassword }` | `200 {}` | FR-049. |
| DELETE | `/me` | Bearer, adult only | `{ confirm: true }` | `204` \| `403 FORBIDDEN` (minor) | FR-044, FR-049. |
| GET | `/me/skills` | Bearer | – | `200 { data: { skillProfile } }` | FR-046. |
| PATCH | `/me/skills/focus` | Bearer | `{ axes: string[] (max 3) }` | `200 { data: { skillProfile } }` | FR-047; 400 if `axes.length > 3`. |
| GET | `/me/training/summary` | Bearer | – | `200 { data: { trainingSummary } }` | Self Education dashboard (docs/design-audit/self-education.md). Every field computed on read from `solve_attempts`/`puzzles` — no dedicated table. `skillProfile` axes now move for real: `solved` (+4) / `solution_revealed` (-2) on the axis matching the puzzle's tag (internal/puzzle, tag↔axis map excludes `strategy`, which has no fixture tag). |
| PUT | `/me/board-preferences` | Bearer | `{ theme, pieceSet, showCoordinates, animationSpeedPct }` | `200 { data: { boardPreferences } }` | FR-048. |
| POST | `/parent-links/:id/verify` | Public (signed token in body) | `{ token }` | `200 {}` | Guardian confirms via emailed link (FR-051). |

---

## Billing (`internal/billing`) — FR-052–057 *(simulated payment provider, see plan.md)*

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/me/credits` | Bearer | – | `200 { data: { balance } }` | FR-052, also embedded in `/me`. |
| GET | `/hint-packages` | Bearer | – | `200 { data: [package...] }` | Static catalog (FR-053). |
| POST | `/hint-packages/:id/purchase` | Bearer | `{ attemptId }` | `200 { data: { balance, hintsRemaining } }` \| `402 INSUFFICIENT_CREDITS` | FR-054; atomic debit + hint grant in one DB transaction. |
| GET | `/me/transactions` | Bearer | query `page,pageSize` | `200 { data: [transaction...] }` | FR-055 audit trail. |
| POST | `/me/credits/topup` | Bearer | `{ amount }` | `200 { data: { balance } }` | **Simulated provider** — instantly credits, tagged `reason: topup_simulated` (FR-057; real gateway is a future swap, see Complexity Tracking in plan.md). |
