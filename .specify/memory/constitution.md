<!--
Sync Impact Report
- Version change: template → 1.0.0 (initial ratification)
- Modified principles: n/a (first version)
- Added sections: Core Principles (I–IX), Security & Compliance Requirements,
  Development Workflow & Quality Gates, Governance
- Removed sections: none
- Templates requiring follow-up: none — plan/spec/tasks templates consume this
  file at runtime and were not modified here
- Deferred TODOs: none
-->

# Neuratop Constitution

## Core Principles

### I. Simplicity & Typed Code
All application code (frontend and backend) MUST use strict static typing
(TypeScript strict mode, or equivalent for any non-JS component). Prefer the
simplest abstraction that solves the current, real requirement — no speculative
generalization, no framework or pattern introduced "because it might be needed
later." Three similar lines of code are preferred over a premature abstraction.
Every module has one clear responsibility.
**Rationale**: Untyped glue code and speculative abstractions are the largest
source of silent bugs and stalled velocity in small full-stack teams.

### II. Figma Is the Design Source of Truth
The specification derives UI/UX from the Figma exports audited in
`docs/design-audit/`. Implementation MUST reproduce layout, spacing, typography,
color, and component structure from that source, including every visible state
captured in the design (default, loading, empty, error, success, disabled,
hover/focus/active). Where Figma does not specify a state or behavior, engineers
use documented product judgment instead of inventing new visual language.
Deviations required for technical reasons MUST be recorded in the spec with a
rationale.
**Rationale**: The design was produced deliberately; silent drift between design
and shipped UI erodes product coherence and trust.

### III. Server-Owned Business Logic
All business rules, permissions, and input validation MUST be enforced on the
backend regardless of what the frontend already checks. Frontend validation
exists only to improve UX (immediate feedback); it is never the last line of
defense. No client-supplied value (including IDs, prices, roles, or age-tier)
is trusted without server-side re-validation.
**Rationale**: Frontend code is attacker-controlled; only the server is a
trust boundary.

### IV. Typed, Consistent API Contracts
Every frontend–backend boundary is described by a shared, typed contract
(request/response schemas). All API responses use one consistent success/error
envelope shape across the whole API. Breaking a contract requires updating the
contract definition first, then both sides together — never an undocumented
one-sided change.
**Rationale**: Typed contracts turn integration bugs into compile-time errors
instead of production incidents.

### V. Data Integrity by Design
Schema changes ship as explicit, forward-only migrations checked into version
control — never manual, undocumented database edits. Foreign keys and
constraints enforce relationships at the database level, not only in
application code. Fields that are queried or filtered on frequently MUST be
indexed. Destructive migrations (drops, irreversible type changes) require an
explicit note on data-loss impact in the PR/task description.
**Rationale**: The database outlives any single deployment of application code;
its integrity cannot depend on every caller behaving correctly.

### VI. Security by Default
Passwords are hashed with a modern algorithm (bcrypt/argon2), never stored or
logged in plaintext. Sessions/tokens have explicit expiry and are transmitted
over HTTPS only. All secrets (API keys, DB credentials, AI provider keys) live
in environment variables, never in source control. Every external input is
validated against a schema at the API boundary. Endpoints that are expensive or
sensitive (AI puzzle generation, authentication, password reset) are
rate-limited. CORS is an explicit allowlist, not a wildcard. The age-tier
selected at registration (children/teens/adults) is enforced server-side
wherever it gates content or features, not only hidden in the UI. Standard
OWASP Top 10 mitigations apply (injection, broken auth, XSS, SSRF, etc.).
**Rationale**: A chess-puzzle product with a children's age tier carries real
safety and trust obligations, not just generic best practice.

### VII. Accessible, Responsive UI
UI is built from semantic HTML with correct roles/labels, full keyboard
navigability, and visible focus states matching the design system. Color
contrast meets WCAG AA at minimum. Layouts adapt across the breakpoints
identified in the Figma audit (desktop-first per the source frames, with
graceful mobile/tablet behavior); no horizontal scrolling of the page body.
**Rationale**: Accessibility and responsiveness are cheapest to build in from
the start and expensive to retrofit.

### VIII. Test-Backed Correctness
Critical backend logic (authentication, authorization, puzzle-generation
business rules, folder/data ownership checks) and key end-to-end user flows
(register → generate puzzle → solve → save to folder) MUST have automated test
coverage. Typecheck and lint are part of the Definition of Done for every task.
A task is not "complete" while tests, typecheck, or lint are red.
**Rationale**: Tests and static checks are the cheapest available defense
against regressions in a codebase built quickly across many tasks.

### IX. Deliberate Dependency Management
Every new dependency must earn its place: prefer the language/framework
standard library or an already-adopted library before adding a new one. No two
libraries may serve the same purpose in the codebase. Dependencies MUST be
actively maintained; unmaintained or unnecessary packages are not introduced
for convenience.
**Rationale**: Every dependency is a long-term maintenance and security-surface
cost, not a one-time convenience.

## Security & Compliance Requirements

Beyond Principle VI, the following are non-negotiable for this product:
- The registration age-gate (children under 12 / teens 12–18 / adults) MUST
  drive concrete, server-enforced behavior (e.g., feature or content
  restrictions), not just be stored as a display field.
- AI-generation endpoints MUST validate and bound all generation parameters
  server-side (no unbounded prompts/positions reaching the AI provider
  unchecked) and MUST fail safely (clear error, no partial/corrupt puzzle
  state) if the AI provider errors or times out.
- Authentication failures, rate-limit rejections, and authorization denials are
  logged server-side (without leaking credentials) for abuse monitoring.

## Development Workflow & Quality Gates

- Work follows Spec-Driven Development in order: Constitution → Specification →
  Plan → Tasks → Implementation → Verification. Implementation does not start
  ahead of an approved specification and plan for that feature area.
- Every functional requirement in the specification MUST be traceable to a
  plan section, a task, and the implementing code; requirements discovered
  mid-implementation are added back to the spec/plan/tasks before being built.
- Before any feature is considered done: typecheck passes, lint passes, tests
  pass, and the production build succeeds. Errors encountered during
  verification are fixed, not merely reported.
- Mock/placeholder data is acceptable only as a temporary implementation aid
  and MUST be replaced by real persistence/business logic before the feature
  is considered complete.

## Governance

This constitution supersedes ad hoc technical preferences for this project.
Amendments are made by editing this file, incrementing the version per
semantic versioning (MAJOR: incompatible principle removal/redefinition;
MINOR: new principle or materially expanded guidance; PATCH: clarifications
and wording), and prepending an updated Sync Impact Report. Any plan or task
that conflicts with a principle here must either be changed to comply or must
amend this constitution first, with an explicit rationale — complexity or
deviation is never justified silently.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
