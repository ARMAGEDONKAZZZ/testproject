# Feature Specification: Neuratop — AI Chess Puzzle Generator (MVP)

**Feature Branch**: `001-neuratop-mvp`

**Created**: 2026-08-14

**Status**: Draft

**Input**: Product brief derived from Figma source-of-truth design audit (`docs/design-audit/*.md`, produced from `figma/*.svg`): a dark-themed web product, brand **Neuratop**, that lets a user generate chess puzzles/positions with AI, solve them on an interactive board with AI-assisted tools, organize them into folders/favorites, and manage a profile that supports both adult and minor (parent-linked) accounts.

## Scope

This specification covers everything documented in the six audited Figma files: **Авторизация** (auth), **Генерация задач** (AI puzzle generation), **Задача** (puzzle-solving screen), **Панель инструментов** (solving toolboard + its 10 tools), **Папки** (history/folders/favorites), **Профиль** (profile/settings/skills). Global navigation items visible in headers but never designed in any provided file (**Self Education**, **My Class** content, **Library**, **Tournaments**, **Progress**) are out of scope for this spec — see Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and sign in, with an age-appropriate account (Priority: P1)

A new visitor creates a Neuratop account by declaring an age tier, then authenticates by email + one-time code (or Google/Apple), or later signs back in with email/password, and can recover access if they forget their password.

**Why this priority**: Nothing else in the product is reachable without an account. The age tier also gates which experience (adult vs. minor/parent-linked) the rest of the product must show, so it has to exist before any other story can be considered "done."

**Independent Test**: A fresh visitor can complete registration end-to-end (age tier → email → nickname) and land in an authenticated session; a returning user can log in and, separately, recover a forgotten password — each verifiable without any other feature existing yet.

**Acceptance Scenarios**:

1. **Given** a new visitor on the registration screen, **When** they select "Взрослые (старше 18 лет)" and complete email + password/code + nickname, **Then** an adult account is created with no parental-consent requirement.
2. **Given** a new visitor who selects "Дети (до 12 лет)" or "Подростки (12–18 лет)", **When** they proceed, **Then** registration requires an explicit parent/guardian consent step (checkbox + parent email) before the account can be created, and the resulting account is flagged as a minor account linked to that parent's verified email.
3. **Given** a registered user on the login screen, **When** they submit a correct email/password, **Then** they are signed in and redirected to the main app; **When** they submit an incorrect password, **Then** an inline "Неверный пароль" error appears under the password field and the session is not created.
4. **Given** a user who forgot their password, **When** they request a reset code by email and submit a new password, **Then** their password is changed and they can sign in with the new password (this end state is not covered by the audited frames — see Assumptions).
5. **Given** a user attempts sign-in with the same account, **When** the account has failed login 5+ consecutive times within 15 minutes, **Then** further attempts are temporarily rate-limited with a clear message (design has no explicit lockout screen — see Assumptions).

---

### User Story 2 - Generate chess puzzles with AI (Priority: P1)

A signed-in user describes what kind of puzzle(s) they want — by free text, by picking a suggested/quick-pick tag, by uploading an image of a position, or by pasting a PGN/FEN — and receives one or more AI-generated, chess-legal puzzles ready to solve.

**Why this priority**: Puzzle generation is the product's core value proposition ("AI Chess Puzzle Generator"); without it the app is just a generic puzzle viewer.

**Independent Test**: A signed-in user can submit a generation request through any one of the four input methods and receive a valid puzzle result, independent of whether solving-tools or folders exist yet.

**Acceptance Scenarios**:

1. **Given** the generation screen, **When** the user submits the form with no text, tag, image, or FEN/PGN attached, **Then** submission is blocked and a "Please enter content" validation message is shown.
2. **Given** a filled request (free text, tag, image, or FEN) and a chosen count (1–4, default 4), **When** the user submits, **Then** the system shows a 3-step progress indicator (fetching patterns → calibrating difficulty → generating boards) and the request can be cancelled while in progress.
3. **Given** a completed generation, **When** results are ready, **Then** the user sees between 1 and 4 puzzles, each with a legal chess position, a solvable objective (e.g., "mate in N"), an assigned tactical tag, the side to move, and a short AI-written description of the tactical idea.
4. **Given** a generation result, **When** the user opens the FEN dialog, **Then** they can copy the current position's FEN and, separately, paste their own FEN to generate from a specific position.
5. **Given** a generation result, **When** the user toggles between carousel and grid view, **Then** the same result set is shown in the corresponding layout without re-generating.
6. **Given** a generation request fails server-side (e.g. AI provider error/timeout), **When** this happens, **Then** the user sees a clear, non-technical error and the form remains editable for retry (no partial/corrupt result is shown or saved).

---

### User Story 3 - Solve a puzzle on the board (Priority: P1)

A user opens a puzzle, makes a move on the interactive board, and immediately learns whether the move was correct; on an incorrect move, they can request a simplified version of the same puzzle instead of getting stuck.

**Why this priority**: Solving is the second half of the core loop (generate → solve) and is the primary session activity once a puzzle exists.

**Independent Test**: Given any single valid puzzle (seeded directly, independent of the generation flow), a user can make a move, see correct/incorrect feedback, and use "simplify" — fully testable without folders, profile, or monetization existing.

**Acceptance Scenarios**:

1. **Given** an open puzzle with the AI's framing message shown ("Я подготовил для тебя задачу..."), **When** the user plays the objectively correct move, **Then** the board shows a green success state and a "Отличный ход!" confirmation.
2. **Given** the same starting point, **When** the user plays an incorrect move, **Then** the board shows a red error state, a countdown/attempt timer starts, and a "Попробуйте иначе" card offers "Упростить задачу."
3. **Given** the "Упростить задачу" offer, **When** the user accepts, **Then** the system returns a strictly easier variant of the same puzzle (fewer pieces and/or fewer moves-to-mate) accompanied by an explanatory AI message, and the user can request simplification again if they are still stuck, down to a defined floor (see Assumptions — the design's second "simplify" state is an unfinished duplicate).
4. **Given** an open puzzle, **When** the user requests a hint, **Then** up to 3 free hints per puzzle are available; requesting a 4th prompts a paywall to buy more (see User Story 6).
5. **Given** an open puzzle, **When** the user uses "Flip the board," "Regenerate," or switches the board color theme, **Then** the corresponding change applies immediately without leaving the puzzle screen.
6. **Given** an open puzzle, **When** the user opens the engine-analysis panel, **Then** they see a position evaluation, best move, and search depth for the current position (read-only assistance, does not reveal the puzzle's intended solution by itself).
7. **Given** any puzzle state, **When** the user requests "показать решение" ("view solution"), **Then** the full correct line is revealed and the attempt is marked as solution-assisted (not an independently solved puzzle) for statistics purposes.

---

### User Story 4 - Organize puzzles: history, folders, and favorites (Priority: P2)

A user browses everything they've generated, saves puzzles into folders (private or public) to organize them, marks individual puzzles as favorites, and can find any of it again later.

**Why this priority**: Without organization, generated puzzles are ephemeral and the product loses retention value after the first session — important, but the product is usable without it (P1 stories stand alone).

**Independent Test**: Given a user with at least one previously generated puzzle, they can create a folder, add that puzzle to it via any of the three supported methods, and later find it again in the folder or in favorites — independent of profile or monetization features.

**Acceptance Scenarios**:

1. **Given** the puzzle history view, **When** the user opens the folder-picker on a puzzle card, **Then** they can multi-select any number of existing folders to add that puzzle to in one action.
2. **Given** the same context, **When** the user creates a new folder, **Then** they choose only the visibility (Private/Public) — the folder is created with a default, immediately-renamable name and appears in the correct sidebar section (Private folders / Public folders).
3. **Given** a folder the user owns, **When** they choose "Поделиться" ("Share"), **Then** they get a shareable link (`neuratop.com/board/{slug}`), can optionally set a view password, and the folder's Private/Public state controls link access — see User Story 8.
4. **Given** a folder or a puzzle the user owns, **When** they choose "Удалить," **Then** the system asks for confirmation before deleting, and deleting a non-empty folder removes the folder without deleting the puzzles themselves (they remain in history/favorites) — see Assumptions.
5. **Given** the Favorites page, **When** the user toggles the heart icon on a puzzle from anywhere in the app (history, folder, puzzle screen), **Then** it appears/disappears from Favorites immediately and consistently across all views.
6. **Given** the history view with no generations yet, **When** a brand-new user visits it, **Then** an empty state explains how to generate their first puzzle (no empty state was captured in the audited frames — see Assumptions).

---

### User Story 5 - Manage profile, skills, and account settings (Priority: P2)

A user views and edits their identity (name, age, avatar), sees an AI-computed skills breakdown across five chess competencies, customizes board appearance, and — if they are an adult — manages contacts/security and can delete their account; a minor's profile instead shows a verified parent-account link and omits self-service account deletion.

**Why this priority**: Necessary for retention and trust (skills feedback, personalization) and for the safety/compliance requirements tied to minor accounts, but the app's core loop functions without it — hence P2, not P1.

**Independent Test**: A user (adult or minor) can open their profile, see role-appropriate sections, edit name/age/avatar, and — for skills — open and interact with the Skills Pentagon, all independent of folders or generation.

**Acceptance Scenarios**:

1. **Given** an adult account, **When** they open their profile, **Then** they see Identity, Contacts (email + password state), the Skills radar card, an Account-deletion option, and Logout.
2. **Given** a minor account, **When** they open their profile, **Then** they see Identity, a Contacts card without an email field, a Parent Account card showing the verified guardian's name/email, the Skills radar card, and Logout — with **no** self-service account-deletion option.
3. **Given** the Skills card, **When** the user opens "Chess Skills Pentagon," **Then** they see per-axis scores (Tactics/Strategy/Openings/Endgames/Calculation) plus an overall score, can select an axis to view a description and recommended puzzles for it, and can manually adjust up to 3 axes as a personal training focus.
4. **Given** the profile edit modal, **When** the user changes their declared age such that it crosses a tier boundary (e.g. 17 → 19, or 11 → 13), **Then** the system re-evaluates their account tier and, if the new tier requires parental consent that isn't already on file, blocks the change until that consent is completed (see Assumptions — the audited modal has no such validation, which we treat as a gap to close, not a rule to copy).
5. **Given** the Board Design page, **When** the user picks a board theme, a piece set, and toggles "Show coordinates" / animation speed, **Then** the choice is saved and immediately reflected on the puzzle-solving board.

---

### User Story 6 - Buy more hints with credits (Priority: P2)

A user who has exhausted the free hints on a puzzle is offered paid hint packages, purchasable with an in-app credit balance shown throughout the app.

**Why this priority**: This is the product's only fully-specified monetization surface in the audited design; it matters for business viability but nothing else in the product depends on it functioning.

**Independent Test**: A user with a known credit balance and 3/3 hints already used on a puzzle can open the paywall, pick a package, complete a (simulated, see Assumptions/Plan) purchase, and immediately use the newly available hints — independent of every other story.

**Acceptance Scenarios**:

1. **Given** a puzzle where the user has used all 3 free hints, **When** they request another hint, **Then** a paywall modal appears offering 3 packages (5 hints / 10 hints marked "выгодно" / unlimited) at fixed credit prices, defaulting the 10-hint option as pre-selected.
2. **Given** the paywall, **When** the user completes a purchase, **Then** their credit balance decreases by the package price, their available-hints count increases accordingly (or becomes unlimited for that puzzle), and the header credit balance updates everywhere it is shown.
3. **Given** the paywall, **When** the user chooses "Продолжить без подсказок" instead, **Then** the modal closes and solving continues with no further hints available for that puzzle.
4. **Given** a user with an insufficient credit balance for any package, **When** they reach the paywall, **Then** they are shown a path to acquire more credits (exact top-up flow is not in the audited design — see Assumptions/Plan).

---

### User Story 7 - Use advanced solving tools (Priority: P3)

While solving, a user can consult a chess-engine analysis panel, play a live game against an AI opponent instead of solving a fixed puzzle, chat freely with the AI assistant, run a countdown timer, and browse built-in chess-rules learning content.

**Why this priority**: These are engagement/power-user features layered on top of the core solve loop (US3); valuable but not required for the product to deliver its primary promise.

**Independent Test**: Each tool (engine panel, Play vs AI, chat, timer, rules list) can be opened and used from an existing puzzle screen independent of the others and independent of folders/profile/monetization.

**Acceptance Scenarios**:

1. **Given** an open puzzle, **When** the user opens the engine panel, **Then** they see a live evaluation, best move, and search depth that update as the position changes, without the panel itself revealing "this is the puzzle's solution."
2. **Given** an open puzzle, **When** the user switches to "Играть против ИИ" (Play vs AI), **Then** they enter a free-play game against a bot at a selectable difficulty level, separate from puzzle-solving statistics.
3. **Given** an open puzzle, **When** the user opens the AI chat panel, **Then** they can send free-form questions and use quick-prompt chips (e.g. "Analyze this chess position," "Упростить задачу") and receive contextual responses about the current position.
4. **Given** an open puzzle, **When** the user opens the timer tool, **Then** they can set a countdown duration (10s/30s/1/2/5min presets), toggle sound, and start/stop it independent of the puzzle's own error-state timer.
5. **Given** the "List" tool, **When** the user opens it, **Then** they see a hierarchical, expandable list of chess-rules learning content (piece movement, special moves, checkmate) unrelated to their generation/solve history.

---

### User Story 8 - Share and publish folders/puzzles (Priority: P3)

A user shares a folder or an individual puzzle with others via a public link, optionally protected by a view password, and via direct share to common messaging/social channels.

**Why this priority**: Extends reach/virality but is not required for a single user to get value from the product.

**Independent Test**: Given a folder the user owns, they can generate a share link, toggle Private/Public, set a password, and copy the link — independently verifiable without any other story.

**Acceptance Scenarios**:

1. **Given** a Private folder, **When** the user opens Share and switches to Public, **Then** a shareable link becomes accessible to anyone with the URL; switching back to Private immediately revokes third-party access to that link.
2. **Given** the Share dialog, **When** the user sets a view password, **Then** anyone opening the link (who is not the owner) must enter the password before seeing the folder's contents.
3. **Given** the Share dialog, **When** the user clicks "Copy," **Then** the link is copied to the clipboard and the button confirms with "Copied!" feedback.
4. **Given** the Share dialog opened from a coaching/class context, **When** the sharer has the "coach" role, **Then** their role is displayed alongside their identity on the shared view (exact class/coach model is out of scope for this spec — see Assumptions).

---

### Edge Cases

- What happens when a user under 18 tries to self-edit their declared age to bypass parental consent? → Blocked server-side per US5 Scenario 4; the age tier and its consent requirement are never trusted from client input alone (Constitution Principle III/VI).
- What happens when a "Подростки" (12–18) user registers? → Treated as a minor account requiring parent/guardian consent, same as "Дети" — the audited prototype's decision-branch for this tier was missing/ambiguous, so this is a deliberate, documented choice (see Assumptions), not a literal copy of the mockup.
- What happens on repeated failed logins? → Rate-limited after 5 failures in 15 minutes (no lockout screen existed in the design; see Assumptions).
- What happens if a generation request's image/PGN/FEN input is invalid or unparseable? → Rejected with a specific validation message identifying the bad input (not the generic "Error" toast seen in the design for server failures).
- What happens if an AI-generated puzzle would be an illegal position (e.g., missing a king) or an already-solved/trivial position? → The system MUST NOT surface it to the user; generation validates legality and non-triviality before returning results (the audited "simplify" mockups showed illegal positions with no kings — treated as a placeholder defect to fix, not a target behavior).
- What happens when a user deletes a non-empty folder? → Folder is removed; contained puzzles remain in the user's history/favorites (not deleted) — see US4 Scenario 4 and Assumptions.
- What happens when a user resends a registration/reset code multiple times quickly? → Resend is rate-limited (e.g. one request per 30–60 seconds) even though the design shows no such cooldown state.
- What happens when a user's hint balance and credit balance are both zero and they still want a hint? → They see the paywall with an explicit path to top up (see US6 Scenario 4).
- What happens if two devices edit the same folder/puzzle concurrently? → Last write wins at the field level; no design signal exists for conflict UI, so this default applies without a dedicated screen.
- What happens when the AI generation/analysis backend is unreachable? → The user sees a clear "try again" error state and no partial data is persisted (Constitution: AI-generation endpoints MUST fail safely).

## Requirements *(mandatory)*

### Functional Requirements — Authentication & Onboarding

- **FR-001**: System MUST let a new user register by declaring an age tier (Дети <12 / Подростки 12–18 / Взрослые 18+) before any other registration step.
- **FR-002**: System MUST require an explicit parent/guardian consent step (acknowledgement + parent/guardian email, later verified) for any account registering as Дети or Подростки, and MUST NOT create the account until that consent is captured.
- **FR-003**: System MUST NOT require parental consent for accounts registering as Взрослые.
- **FR-004**: System MUST let a user register with email + a one-time emailed code, and separately support Google and Apple OAuth as alternative registration methods.
- **FR-005**: System MUST let a user pick a nickname during registration from AI/system-suggested options or enter a custom one, and MUST allow changing it later from profile settings.
- **FR-006**: System MUST let a returning user sign in with email + password, and MUST show a specific inline error ("Неверный пароль") on wrong-password submission without revealing whether the email itself exists.
- **FR-007**: System MUST rate-limit repeated failed sign-in attempts for a given account/IP combination.
- **FR-008**: System MUST let a user request a password-reset code by email, and complete the reset by setting a new password (full inputs and outputs of this flow, not just the mid-flow "code sent" state).
- **FR-009**: System MUST rate-limit resending a registration/verification/reset code.
- **FR-010**: System MUST validate email format and MUST reject registration with an email already in use, with a specific error message for each case.
- **FR-011**: System MUST persist the user's selected UI language preference and MUST support at minimum Russian for v1 (see Assumptions on localization scope).
- **FR-012**: System MUST end each authenticated session after a defined inactivity/expiry period and require re-authentication after expiry.

### Functional Requirements — AI Puzzle Generation

- **FR-013**: System MUST let a signed-in user request puzzle generation via at least one of: free-text description, a suggested/quick-pick tag, an uploaded position image, or a pasted FEN/PGN string.
- **FR-014**: System MUST reject a generation request that supplies none of the above inputs, with a specific validation message.
- **FR-015**: System MUST let the user choose how many puzzles to generate per request (1–4, default 4).
- **FR-016**: System MUST show generation progress (multi-step) and MUST allow the user to cancel an in-flight generation request.
- **FR-017**: System MUST validate that every generated puzzle is a legal chess position with a verified, solvable objective (e.g., an actual forced mate-in-N or tactical win) before returning it to the user — illegal or unverified positions MUST NOT be surfaced.
- **FR-018**: System MUST attach a tactical category tag, the side to move, and a short natural-language description of the tactical idea to each generated puzzle.
- **FR-019**: System MUST let the user view results as a carousel (one at a time with navigation) or as a grid (all results at once), toggle-able without re-generating.
- **FR-020**: System MUST let the user copy the FEN of the currently shown position and separately generate from a manually supplied FEN.
- **FR-021**: System MUST let the user regenerate/retry an individual puzzle from a result set without discarding the others.
- **FR-022**: System MUST show a specific, actionable error (not a bare "Error") when generation fails, and MUST leave the form re-submittable without data loss.
- **FR-023**: System MUST record every generation request (inputs + resulting puzzles) under the requesting user's "История генераций" / "My generations" history.

### Functional Requirements — Puzzle Solving

- **FR-024**: System MUST evaluate a user's move against the puzzle's known-correct solution line and classify it as correct or incorrect.
- **FR-025**: System MUST show a distinct success state (visual + confirmation message) on a correct move and a distinct error state (visual + message) on an incorrect move.
- **FR-026**: System MUST offer a "simplify" action after an incorrect move that returns an objectively easier variant of the same puzzle (fewer pieces and/or fewer moves to the goal), and MUST bound how many times a single puzzle can be simplified (a hard floor, since the audited design's second simplification state was an incomplete duplicate with no defined limit).
- **FR-027**: System MUST grant each puzzle 3 free hints; a 4th hint request MUST route to the credit-based paywall (US6) rather than being silently denied or silently granted.
- **FR-028**: System MUST let the user reveal the full solution on demand, and MUST record that the puzzle was solution-assisted (distinct from an independently solved puzzle) for statistics/skills purposes.
- **FR-029**: System MUST let the user flip board orientation, change the board color theme/piece set (from their saved profile preference or on the fly), and regenerate a fresh puzzle from the same tool panel.
- **FR-030**: System MUST let the user mark/unmark a puzzle as favorite from the solving screen, consistent with Favorites elsewhere in the app (US4).
- **FR-031**: System MUST let the user download the current puzzle as PGN, FEN, or an image, and MUST let them copy/share it (see US8).
- **FR-032**: System MUST show a running material-count indicator and side-to-move indicator that reflect the actual current position (not a static/placeholder value).
- **FR-033**: System MUST persist per-puzzle solve state (attempted, solved, solution-assisted, hints used) per user.

### Functional Requirements — Organization (History, Folders, Favorites)

- **FR-034**: System MUST show a chronological, dated history of all puzzles the user has generated.
- **FR-035**: System MUST let a user create a folder specifying only its visibility (Private/Public); the system MUST assign a default editable name and MUST let the user rename it afterward.
- **FR-036**: System MUST let a user add a puzzle to one or more folders via a multi-select picker, via drag-and-drop onto a folder, and via a context-menu action — all three MUST produce the same resulting state.
- **FR-037**: System MUST let a user remove a puzzle from a folder without deleting the puzzle itself.
- **FR-038**: System MUST let a user delete a folder only after explicit confirmation, and deleting a folder MUST NOT delete the puzzles it contained (they remain in history/favorites).
- **FR-039**: System MUST let a user mark/unmark any puzzle as a favorite from any screen that shows that puzzle, and MUST reflect that state consistently everywhere the puzzle appears.
- **FR-040**: System MUST let a user filter their Favorites by tactical category and by side-to-move.
- **FR-041**: System MUST show an explanatory empty state when a user has no generation history, no folders, or no favorites yet.
- **FR-042**: System MUST let a user download an individual puzzle (PGN/FEN/image) from within a folder or history view, matching the export options available on the solving screen.

### Functional Requirements — Profile & Account

- **FR-043**: System MUST show an adult profile with identity, contacts (email + password-set state), skills, board-design settings, and account-deletion.
- **FR-044**: System MUST show a minor profile with identity, a contacts card with no email field, a verified parent/guardian account card, skills, and board-design settings — and MUST NOT expose self-service account deletion to a minor account.
- **FR-045**: System MUST let a user edit their name, age, and avatar; on an age edit that crosses a tier boundary, the system MUST re-run the tier/consent logic from FR-002/FR-003 (blocking the change if new consent is required and missing) rather than silently accepting the new age.
- **FR-046**: System MUST compute and display a 5-axis skills profile (Tactics, Strategy, Openings, Endgames, Calculation) plus an overall score, derived from the user's solve history.
- **FR-047**: System MUST let a user manually mark up to 3 skill axes as a personal training focus, distinct from (and layered on top of) the system-computed scores.
- **FR-048**: System MUST let a user choose a board theme and piece set from a fixed catalog, toggle coordinate display, and adjust animation speed; the choice MUST persist across sessions and devices.
- **FR-049**: System MUST let an adult user change their password and MUST let a user permanently delete their own account (adult only, per FR-044), with an explicit confirmation step.
- **FR-050**: System MUST let a user log out, ending their session.
- **FR-051**: System MUST let a parent/guardian's verification status be visibly reflected on the linked minor's profile (e.g., a "verified" indicator once the guardian confirms).

### Functional Requirements — Monetization (Credits)

- **FR-052**: System MUST maintain a per-user credit balance, visible in the app header wherever a user is signed in.
- **FR-053**: System MUST limit free hints to 3 per puzzle and MUST present exactly the packages needed to buy more (5 / 10 / unlimited) with their credit prices when the limit is reached.
- **FR-054**: System MUST debit the user's credit balance by the selected package's price upon a completed purchase and MUST immediately reflect the new hint allowance for that puzzle.
- **FR-055**: System MUST record every credit-affecting event (purchase, generation cost if any, hint-package purchase) as an auditable transaction tied to the user.
- **FR-056**: System MUST let a user decline the paywall and continue solving without additional hints.
- **FR-057**: System MUST provide a path for a user to acquire additional credits when their balance is insufficient for any hint package (implementation of the acquisition step itself belongs to the Plan phase; see Assumptions).

### Functional Requirements — Sharing

- **FR-058**: System MUST let a folder owner generate a shareable link for a Public folder and MUST make Private folders inaccessible via any previously shared link.
- **FR-059**: System MUST let a folder owner optionally require a view password on a shared link; a non-owner opening a password-protected link MUST be required to enter it before seeing contents.
- **FR-060**: System MUST let a user copy a share link with clear confirmation feedback, and MUST offer direct share to at least the channels shown in the design (Telegram, generic messenger, X/Twitter, Facebook, email).

### Functional Requirements — Cross-Cutting / Non-Functional

- **FR-061**: System MUST enforce every access-control, ownership, and age-tier rule above on the server; client-side checks are UX-only (Constitution Principle III).
- **FR-062**: System MUST log authentication failures, rate-limit rejections, and authorization denials server-side without leaking credentials, for abuse monitoring (Constitution: Security & Compliance Requirements).
- **FR-063**: System MUST present every user-facing error in the target UI language with actionable, non-technical wording — never a bare "Error" with no context (a defect pattern seen repeatedly in the audited design).
- **FR-064**: System MUST NOT display placeholder/mock counters or user data (e.g., identical folder counts, mismatched credit balances between screens) in the shipped product — every displayed count/value MUST reflect real, current backend state.

### Key Entities

- **User**: an account holder; attributes include nickname, email (nullable for minor accounts), password hash (nullable if OAuth-only), age, computed age tier, preferred language, board-design preference, credit balance, timestamps. Has one optional `ParentLink` if a minor.
- **ParentLink**: links a minor `User` to a verified guardian identity (name, email, verification status). Required for any User whose age tier is Дети or Подростки.
- **Puzzle**: a chess position with metadata — FEN, side to move, tactical tag(s), objective (e.g. mate-in-N), AI-written description, difficulty, legality/verification status, and the `Generation` it originated from (nullable if seeded another way).
- **Generation**: one AI generation request — owner, input mode (text/tag/image/FEN-PGN), input payload, requested count, status (pending/succeeded/failed), and the resulting `Puzzle` records.
- **SolveAttempt**: a record of one user attempting one `Puzzle` — moves made, correct/incorrect outcome, hints used, whether the solution was revealed, simplification count, timestamps.
- **SkillProfile**: per-user computed scores for the five skill axes plus overall, and the user's manually chosen focus axes (max 3).
- **Folder**: owner, name, visibility (Private/Public), share settings (password, link slug), timestamps.
- **FolderItem**: association between a `Folder` and a `Puzzle`.
- **FavoriteItem**: association between a `User` and a `Puzzle`.
- **CreditTransaction**: owner, amount (signed), reason (purchase, hint-package, adjustment), related `Puzzle`/`Generation` if applicable, timestamp.
- **HintPackage**: a purchasable offer (hint count or unlimited-for-puzzle, credit price) — a small fixed catalog, not user-editable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can complete registration (age tier through nickname) in under 2 minutes for the adult path, and under 3 minutes for a minor path including guardian-consent input.
- **SC-002**: A signed-in user can go from an empty generation form to viewing at least one valid, legal puzzle result in under 30 seconds of perceived wait time for a standard request.
- **SC-003**: 100% of puzzles ever shown to a user are legal chess positions with a verified solution — zero illegal (e.g., kingless) or unverifiable positions reach the UI.
- **SC-004**: A user can add a puzzle to a folder and find it again from that folder in under 3 actions (open picker/menu, select folder, confirm — or drag-drop as one action).
- **SC-005**: 95% of incorrect-move attempts result in the user either succeeding on a subsequent attempt or accepting a simplified variant, without needing to abandon the puzzle entirely.
- **SC-006**: A minor account can never reach an account-deletion control, and can never complete registration or an age-tier-crossing profile edit without a verified guardian link — verified by security testing, not just UI absence.
- **SC-007**: Every credit-affecting action (purchase, hint spend) is reflected in the visible balance within 1 second of completion, with zero discrepancies between the balance shown in different parts of the app.
- **SC-008**: A shared Public folder is viewable by a non-owner without an account; a shared Private folder (or a since-unpublished one) is not, verified by direct URL access attempts.
- **SC-009**: 90% of first-time users who complete generation also complete at least one solve attempt in the same session (core-loop stickiness).
- **SC-010**: Zero user-facing screens ship with mixed-language labels within a single view (the pervasive RU/EN mixing found throughout the audited design is fully resolved before release).

## Assumptions

- **Age-gate branch logic corrected**: the audited "есть 18 лет?" decision connector had ДА (yes) wired to the "Дети" (children) state and НЕТ (no) wired to "Взрослые" (adults) — the reverse of the only sensible reading. This is treated as a Figma prototyping/connector labeling error, not an intentional rule, and the specification above (FR-001–003) implements the corrected, safe logic: under 18 → consent required, 18+ → not required.
- **"Подростки" (12–18) treated as a minor tier requiring guardian consent**, same as "Дети," because the audited prototype defines no separate path for this tier and the safer default (avoiding under-protection of minors) is preferred over inventing a lighter-consent path with no design or legal basis.
- **Localization scope for v1**: Russian is the one fully-specified, primary language (confirmed by the one fully Russian screen — "Редактирование профиля" — and by the presence of a RU/EN/KZ language switcher in the auth flow, which signals multi-language is an intended long-term capability even though only Russian is fully mocked). The product MUST be built with translatable strings (not hard-coded language mixing), but only Russian needs complete, correct copy for v1; the English fragments found throughout the audit (button labels, toasts, panel titles) are treated as unfinished draft copy to be translated to Russian for v1, not as intentionally bilingual UI.
- **Monetization is real business logic with a simulated payment step for this iteration**: the credit ledger, balances, transaction history, and hint-paywall logic are all real, persisted, and enforced server-side. No payment-gateway credentials or merchant account exist in this environment, so the "acquire more credits" step (FR-057) is implemented behind a swappable payment-adapter interface with a simulated/test provider for now — this is a scope boundary to close explicitly when a real payment processor is integrated, not a hidden shortcut.
- **Puzzle-generation correctness is a hard requirement, not merely a nice-to-have**: because the audited mockups themselves contain illegal placeholder positions (no kings), this spec treats "every generated/simplified position must be legal and verified-solvable" as non-negotiable (FR-017, SC-003) regardless of how the design mockups looked.
- **Nav items not covered by any audited screen** ("Self Education," "Library," "Tournaments," "Progress," full "My Class" functionality) remain visible in navigation for design fidelity but are out of scope for this spec — they are inert/"coming soon" for v1 rather than being invented from scratch.
- **Password-reset completion screens** (new-password entry, success confirmation) do not exist in the audited file (the flow cuts off after "code sent"); FR-008 specifies the necessary complete behavior using standard, industry-typical patterns.
- **Account lockout/rate-limiting thresholds** (FR-007, FR-009) are not specified by the design at all; the numeric defaults given (5 attempts/15 min, 30–60s resend cooldown) are reasonable, adjustable engineering defaults, not contractual requirements.
- **"Play vs AI" and the engine-analysis panel** are assumed to use a real, standard chess engine/rules library server- or client-side (choice deferred to the Technical Plan) so that legality and evaluation are always correct — not an LLM guessing moves.
- Users are assumed to have a stable internet connection typical of a web app; no offline mode is in scope for v1.
- Existing/duplicate design content noted in the audits (e.g., duplicate "Дерево" piece-set name, the pixel-identical Экран 9 in puzzle-detail, mismatched credit numbers across screens) is treated as design draft noise and intentionally NOT reproduced literally in the requirements above.

## Traceability: Figma Screens → Requirements

| Design audit source | Screens | Primary user stories / requirements |
|---|---|---|
| `docs/design-audit/auth.md` | 20 (registration + age-gate, login, password recovery) | US1; FR-001–012 |
| `docs/design-audit/puzzle-generation.md` | 19 (input methods, generation progress, results) | US2; FR-013–023 |
| `docs/design-audit/puzzle-detail.md` | 9 (correct/incorrect, simplify, chat/engine panels) | US3, US7; FR-024–033, FR-029 (partial, tools) |
| `docs/design-audit/toolboard.md` | 38 (10 solving tools + My Puzzles library screen) | US3, US7, US8; FR-024–033, FR-046, FR-052–060 |
| `docs/design-audit/folders.md` | 14 (history, folders, favorites, share) | US4, US8; FR-034–042, FR-058–060 |
| `docs/design-audit/profile.md` | 13 (adult/minor profile, skills pentagon, board design, edit) | US5; FR-043–051 |
