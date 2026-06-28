# docs/ROADMAP.md — Phasing and task breakdown

> Follow the order of the phases. **Before starting each task, announce to the user which task you are picking up** and create a feature branch.
> Branch pattern: `feature/<phase>.<task>-<slug>` — example: `feature/1.2-side-pot-calc`.

Statuses: `[ ]` not done · `[~]` in progress · `[x]` done.

---

## Phase 0 — Foundation & Tooling

Goal: get the project infrastructure and GitHub ready, get CI green.

- [x] **0.1** init the Next.js project + TypeScript strict + Tailwind.
- [x] **0.2** install and configure ESLint + Prettier + lint-staged.
- [x] **0.3** Husky hooks: `pre-commit` (lint-staged + branch guard) and `commit-msg` (commitlint).
- [x] **0.4** Clean Architecture folder structure (`src/domain|application|infrastructure|presentation`).
- [x] **0.5** configure Vitest + the first smoke test. _(Done earlier, during task 0.1, to get CI green.)_
- [x] **0.6** review and complete `.github/` (CI, templates, CODEOWNERS) and get the workflow green.
- [x] **0.7** `.env.example`, `README` setup section.

**Definition of Done:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green locally and in CI.

---

## Phase 1 — Domain: Betting Engine (pure)

Goal: the betting engine per `docs/BETTING-ENGINE.md`, with no I/O.

- [x] **1.1** Entities and Value Objects: `Room`, `PlayerInHand`, `Hand`, `Pot`, `Chips`.
- [x] **1.2** the **Side Pot** algorithm + comprehensive unit tests (multiple all-ins, folded players).
- [x] **1.3** action validation (`FOLD/CHECK/CALL/BET/RAISE/ALL_IN`) + min-raise.
- [x] **1.4** the state machine for end of street and determining the next turn.
- [x] **1.5** settlement logic (net, zero-sum) and determining the winner (uncontested + both modes).
- [x] **1.6** typed domain errors.

**DoD:** high test coverage on the engine; all documented examples green.

---

## Phase 2 — Persistence & Auth

Goal: database and authentication.

- [x] **2.1** Prisma schema: `User`, `Room`, `RoomMember`, `Game`, `Hand`, `ActionLog`, `Settlement`.
- [x] **2.2** initial migration + development seed.
- [x] **2.3** Auth.js (credentials + OAuth if desired) + session.
- [x] **2.4** implement the repositories behind the `application` ports (Dependency Inversion).

**DoD:** create a user, log in, and persist a test room.

---

## Phase 3 — Real-time Gateway

Goal: a server-authoritative Socket.io per `docs/REALTIME-EVENTS.md`.

- [x] **3.1** custom server (Next + Socket.io) + auth on connection.
- [x] **3.2** room lifecycle: create/join/leave + room state snapshot.
- [x] **3.3** player action handler → call the use-case → broadcast state.
- [x] **3.4** turn timer (deadline-based) + server auto-action.
- [x] **3.5** reconnection + state resync.
- [x] **3.6** Zod validation on all payloads + rate limiting.

**DoD:** two simultaneous clients, actions sync instantly; disconnect/reconnect without losing state.

---

## Phase 4 — Frontend (Table UI)

Goal: the table, the seats, action controls, real-time connection.

- [x] **4.1** Lobby page (create/join a room).
- [x] **4.2** table component + seat layout (responsive).
- [x] **4.3** player action panel (fold/check/call/bet/raise/all-in) with valid values. _(Includes the banker's temporary "Start hand" button and the temporary default buy-in `DEFAULT_BUY_IN`.)_
- [x] **4.4** display of the pot, stacks, dealer button, active turn. _(Mostly implemented during 4.2/4.3; the countdown timer is addressed in 4.9.)_
- [x] **4.5** Zustand store + connection to socket events. _(The base was implemented during 4.1–4.3: `connection-store` + socket wiring.)_
- [x] **4.6** banker view (buy-in control, end game, declare winner).
  - **Part 1 (done, merged):** declare winner + settlement — the banker declares the winner of each pot, chips are moved and the final stack is stored in the DB; the next hand starts with correct chips (`SettleHand` use-case + `updateMemberChips`).
  - **Part 2 (remaining):** the banker's real buy-in/rebuy control → moved to task **4.15
    (Chip requests / banker approval)** (replacing `DEFAULT_BUY_IN`). +
    end game and the net report (`computeNetSettlement`), which stays here.

**DoD:** a full game from create to settle can be played in the UI.

---

## Phase 4 — Manual Game Flow (banker-driven)

> A continuation of Phase 4 (tasks 4.7–4.15). This section came out of manual playtesting: because
> **the game itself is manual** (no hand evaluation, physical cards), the pace is controlled by a human, not the engine.
> It includes manual progression, hand rotation, blinds, turn/timer display,
> time bank, player presence/leaving, and chip request/approval.

- [x] **4.7** manual progression + banker confirmation of each step + display of the step name.
      The game advances **step by step**, and the banker must **explicitly start each step**,
      not just "next street". Flow: **start hand → start flop → start turn → start
      river**. After the betting of each step is complete, the game **stays paused** until the banker confirms
      the next step; **there is no automatic progression** and the time for each step is unlimited
      (because the human paces the cards physically).
  - **Step name on the table:** the current step's name (**preflop / flop / turn / river**)
    must always be visible on the table (not just the `street` number).
  - **Conflict with the current engine:** in `application/use-cases/player-act.ts`, after
    `applyAction` the function `advanceHand` (`domain/engine/street.ts`) is called, which
    on street completion **automatically** runs `startNextStreet` and sets the next actor.
    This behavior must be broken.
  - **Required changes:**
    - `domain/entities` (HandStatus): add the status `'awaiting_street'` (the betting of this
      street is done and later streets remain) — separate from `'awaiting_showdown'` (all
      streets done or uncontested → settle).
    - `domain/engine/street.ts`: split `advanceHand` so that on **street completion
      with a next street existing** it goes to `'awaiting_street'` and **does not call `startNextStreet`**.
      `startNextStreet` (pure, existing) is moved to a new use-case.
      The uncontested → `awaiting_showdown` and pass-to-next-seat logic stays unchanged.
    - all-in case: when no one can act (everyone all-in), the banker must still advance
      street-by-street to the river (to pace the physical run-out), just without
      betting. So `'awaiting_street'` covers this case too (the current skip loop in
      `advanceHand` is removed/replaced).
    - `application/use-cases`: a new use-case `AdvanceStreet` (banker-only) — it checks
      the requester is the banker and the hand is in `'awaiting_street'`, then
      applies `startNextStreet` + saves.
    - `infrastructure/realtime`: a new event + handler (e.g. `hand:advance-street`
      → broadcast `hand:state` + `turn:changed`), schema with Zod; the turn-timer in
      `'awaiting_street'` must not count (no turn is pending).
    - `presentation`: add `'awaiting_street'` to the client's `PublicHandState.status`;
      the banker control for "Deal flop / turn / river" (label based on `street`); display the paused
      state to the others ("Waiting for the banker to deal").
  - **DoD:** after the betting of each street ends, the game waits; only the banker starts the next street;
    unit test for the transitions (street complete → `awaiting_street` →
    next street) and authorization; no automatic progression happens.

- [x] **4.8** hand cycle by the banker: start the next hand with the dealer button rotating. _(merged)_
      `firstButtonSeat`/`nextButtonSeat` (pure, with tests); the button for the first hand is the lowest
      seat and then rotates clockwise with wrap; the banker's button after settle
      becomes "Start next hand".

- [x] **4.9** turn timer display — a countdown of the active player's remaining time.
      The active player must clearly see how much time they have to act. The countdown ring around
      the avatar (`presentation/components/seat.tsx`) is built but in a real game does not show the remaining
      time.
  - **Diagnosis:** the original invisibility root was the same seat off-by-one (fixed in 4.3).
    The ring is currently **static**; no countdown from `actionDeadline` (absolute, from the server in 3.4 and
    the `turn:changed` event) is consumed by the client.
  - **Work:** a visible counter driven by `actionDeadline` (a ring that
    fills/empties **or** a numeric seconds counter); based on absolute time, not a per-second tick in
    state. The smooth ring animation can be deferred to 5.2, but **the remaining time must
    be visible in 4.9**. (cross-ref: server 3.4, animation 5.2.)
  - **DoD:** the active turn in a real game has a remaining-time countdown; compatible with
    `prefers-reduced-motion`.

- [x] **4.10** Blinds — the banker sets SB/BB when creating the table + posting the blinds at the start of a hand.
  - **Current status (report):** blinds are **not actually posted**. In
    `application/use-cases/start-hand.ts`, the value of `room.settings.bigBlind` is only
    used as `minBet`/`lastRaiseSize` (the minimum bet/raise increment), and
    its comment explicitly says "No blinds are posted yet". That is, the hand starts with `currentBet=0` and
    an empty pot and no one is forced to post SB/BB. The values are in the schema
    (`smallBlind`/`bigBlind`) with domain defaults SB=1/BB=2.
    **The plumbing for the banker to set them already exists** (`createRoomSchema` accepts the optional
    `settings.smallBlind/bigBlind` fields and the handler + `CreateRoom` pass
    them to the domain) — only **the table creation form in the lobby has no input**, so
    in practice the defaults always apply.
  - **Work:**
    - **Lobby (`presentation`):** add Small blind / Big blind numeric inputs to
      the table creation form, with validation (`BB > SB > 0`, integers) and a sensible default;
      send them in the `settings` of the `room:create` event (the plumbing exists).
    - **`StartHand`:** post the mandatory blinds at the start of a hand — SB by the player
      left of the button and BB by the next one; `currentBet=BB`, `lastRaiseSize=BB`, committing
      chips and reducing the stack (with all-in handling for a short stack); the first actor =
      left of the BB. Handle the heads-up case (the button posts the SB) separately.
    - **Display/settlement:** show SB/BB on the table (readout); the blind chips are automatically
      included in settlement via `committedTotal`.
  - **DoD:** the banker sets SB/BB on creation; the blinds are posted at the start of each hand
    (pot and currentBet correct); unit test for posting a blind, heads-up, and the
    short-stack all-in.
  - **Post-merge follow-ups to 4.10:** after merging
    4.10, three UI fixes were needed (recorded here for history honesty):
    - **Blinds readout placement:** the readout that in 4.10 was at the bottom-center of the felt fell on
      the hero avatar of seat 0 → moved to the central tote-board. The initial fix
      on a branch was not merged to develop and was landed again via **PR #39**.
    - **Blind input overflow in the lobby:** the new SB/BB inputs in the table creation form
      overflowed the card at narrow widths → fixed with `min-w-0`/`w-full`
      (**PR #38**).
    - **Overlap recheck:** it was determined that the readout fix had never been merged to develop;
      it was re-verified across all states and seat counts and landed via
      **PR #39**.

- [x] **4.11** active-turn banner at the top of the table — clearly showing "whose turn it is".
      The name of the player whose turn it is should be prominently visible at the top of the table/screen (e.g.
      "alice to act").
  - **Work:** from `hand.actingSeat` → the corresponding member's name; a banner/bar at the top of the table with
    the vc-design visual identity (calm, tote-board). Cover the other states too:
    `awaiting_street` → "Waiting for the banker to deal", `awaiting_showdown` →
    "Showdown — banker to settle", no turn → an appropriate message. Complements the 4.9 timer.
  - **DoD:** at any moment it's clear whose turn it is; readable on mobile too.

- [x] **4.12** Time bank — a player's request for extra time. **Depends on 4.9.**
      When a player's turn timer is running out, they can request **extra time** so
      their deadline is extended (like a time bank in poker apps).
  - **Work:**
    - **Server (authoritative):** each player has a limited time budget (e.g. a few seconds,
      configurable); a socket event like `turn:request-time` that extends the `actionDeadline`
      and reduces the budget; validation with Zod (only the player whose turn it is, only
      if they have budget). The server's turn-timer is rescheduled based on the new deadline.
    - **Client:** an "Add time" button near the action panel when it's your turn and time is
      low; display the remaining budget.
  - **DoD:** a player can extend their turn; the budget is respected; unit test
    for extension and budget exhaustion. (cross-ref: 4.9 timer, 3.4 server turn-timer.)

- [x] **4.13** lobby "your active table" — quick return to the table you are seated at.
      When a player returns to the lobby, they should see which table they are currently a member of and return to it with one
      click (instead of re-entering the code).
  - **Reminder:** this is exactly the capability the user requested (quick return to the active
    table from the lobby) — it is already a planned task, not something new.
  - **Current status:** membership is persistent in the DB; re-entering the code in the lobby correctly takes you to
    the table (the `ALREADY_IN_ROOM` → redirect logic), but there is no display of "your active
    table".
  - **Work:**
    - **Server/use-case:** a way to find the table(s) the user is a member of
      (e.g. `listRoomsForUser(userId)` in the repository + a lobby use-case/event).
    - **Lobby (`presentation`):** a "Your table" card with the table name + a "Rejoin" button
      (path `/room/<id>`). If the user is a member of no table, show nothing.
  - **DoD:** the player sees their active table in the lobby and returns with one click.

- [x] **4.14** Sit out / Leave — completing the current incomplete "Leave room".
  - **Sit out:** temporarily skipping hands while keeping the seat; a sitting-out player is not dealt at the start of
    a hand but their seat and chips remain and they can return (sit in).
    The `'sitting_out'` status already exists in `PlayerState`; it must be wired into the lifecycle and UI.
  - **Leave:** the player leaving the table completely and **freeing the seat** (`removeMember` exists;
    the `LeaveRoom` use-case exists too but is not fully wired in the UI). If a player leaves mid-hand,
    it should behave like a fold.
  - **Work:**
    - **Server:** the `room:sit-out` / `room:sit-in` / `room:leave` event/handlers
      (with Zod + authz); apply in the lifecycle (deal only seated active players).
    - **Client:** Sit out / Sit in / Leave buttons in the table view; display the
      sitting-out state on the seat.
  - **DoD:** sit out/in without losing the seat; leave frees the seat;
    correct behavior on a mid-hand leave. (cross-ref: 7.3 edge cases — banker leaving.)

- [x] **4.15** Chip requests / banker buy-in approval — **completing the buy-in part of task 4.6**.
      Replacing the temporary `DEFAULT_BUY_IN`. The player makes a **chip request**; the banker
      approves/rejects; the approved chips are added to the player's stack and `buyInTotal` is updated
      (for computing net in 6.2). **A core banker capability.**
  - **Current status:** sitting down gives chips temporarily via `DEFAULT_BUY_IN` (in `application/use-cases/
funding.ts`). It must be replaced with the request/approval flow;
    at that point sitting down should give 0 chips.
  - **Work:**
    - **Server/use-case:** `RequestChips` (player) and `ApproveChips`/`DenyChips`
      (banker-only); adding chips to the member and increasing `buyInTotal` (a repository method
      like `addMemberChips`/`updateMemberFunding`); socket events + Zod + authz;
      broadcasting the updated `room:state` and a request queue to the banker.
    - **Client:** a "Request chips" button for the player; an approval queue for the banker (a list of
      requests with Approve/Deny); removing reliance on `DEFAULT_BUY_IN`.
  - **DoD:** a player can request chips and the banker can approve; stack and buyInTotal
    update correctly; sitting down no longer gives automatic chips; unit test for approve/deny
    and the funding update. (cross-ref: 4.6 part 2, 6.2 net report.)

- [x] **4.16** Action menu — a single button that opens a menu of player actions
      instead of the buttons being scattered across the table view. **Depends on 4.14 and 4.15; comes after
      4.14.**
  - **Work:**
    - **Player:** a button that gathers a menu including request chips (4.15), sit out / sit in, and
      leave (4.14).
    - **Banker (variant):** the same menu with the banker controls (e.g. deal/advance,
      settle, approve/reject chip requests) in a single place.
  - **Dependency:** it relies on the sit-out/leave handler/UI from **4.14** and request-chips from
    **4.15**; therefore it must be done **after 4.14**. Presentation-focused
    (no new domain logic).
  - **DoD:** a single button/menu offers all player actions; the banker version shows the banker
    controls; readable and accessible on mobile.

- [x] **4.17** Room id UX — display a shortened table id with a copy button. Independent of
      the other tasks.
  - **Work:** in the table view (`room-view`), show the table id in a shortened form
    (e.g. the first few characters + "…") together with a copy button that copies **the full id** to the
    clipboard.
  - **Scope:** presentation only — no change to the schema or join-code; the actual id value
    stays untouched and only its display is shortened.
  - **DoD:** the shortened id is visible; copy copies the full id; a brief
    "copied" feedback; works on mobile too.

> Note: Phase 4 is functionally complete (4.1 through 4.17 are merged). The only
> remaining piece is the end-game/net-report part of 4.6, which deliberately stays `[~]` and is followed up under
> **6.2**.

---

## Phase 5 — Animations (mandatory, professional)

Goal: high-level animations with Framer Motion (`docs/ANIMATIONS.md`).

> The actual merge order was foundation-first: **5.0 → 5.2 → 5.3 → 5.1
> → 5.4**. The numbers were deliberately not changed (they are referenced in git history and elsewhere);
> so 5.1, even though its number is smaller, landed after its own foundation.

- [x] **5.0** animation foundations — reduced-motion chokepoint + transform/opacity + motion-value/rAF infra. _(It existed in the code but was not recorded in the list; PR #48.)_
- [x] **5.1** chip movement player→pot and pot→winner (spring, chip stack). _(PR #51)_
- [x] **5.2** the timer ring (countdown ring) around the active avatar. _(PR #49)_
- [x] **5.3** turn-change transition + player enter/leave (`AnimatePresence`). _(PR #50)_
- [x] **5.4** win effect (celebration) and dealer/blind motion. _(PR #55)_
- [x] **5.5** respect `prefers-reduced-motion` + 60fps optimization. _(audit:
      PR #62 reduced-motion fail-safe across 6 secondary-UI components; PR #63
      clip-path tray reveal replacing height-thrash. Table-surface animations
      were already clean.)_

**DoD:** no jank; smooth on mobile too.

---

## Phase 6 — Banker, Settlement & History

- [x] **6.1** both winner-determination modes (banker / showdown-confirm).
- [x] **6.2** end-of-game settlement page + net report.
- [x] **6.3** game history page (per user).
- [ ] **6.4** Straddle (optional forced bet) — **a separate and subsequent task, depends on 4.10**.
      After the blinds base (4.10), the option of an optional straddle: the player left of the BB can
      post a forced bet (usually 2×BB) before the deal, which becomes the new effective blind
      and that player acts last preflop. Optional per-hand (player/banker
      activation). **Deliberately separate from the base blinds and with lower priority.**
  - **Work:** add the straddle to the hand-start engine (after the blinds, before the first
    actor); a UI control for activation; unit test for the act order and effective currentBet.
- [ ] **6.5** "Deal" — _placeholder, undefined._ A future item for cards/deal
      whose scope is not yet defined. For now it is only recorded so it isn't forgotten; before
      starting it must become a concrete, scoped task. (Reminder: the product deliberately has no hand
      evaluation and the cards are physical — this item must stay compatible with that.)
- [ ] **6.6** Banker reset current hand — the banker can throw away **the in-progress hand**
      and re-deal (not the whole game). Because the game is manual and human error happens,
      the banker discards and replays the current hand.
  - **Work:** revert the live hand to the pre-deal state of the same hand (only this hand, not the whole
    game); banker-only; a typed guard if no hand is in progress. The smallest and without
    dependency. **High priority.**
- [ ] **6.7** Banker direct chip adjustment — the banker can at any time decrease/increase any
      member's chips. The sibling of 4.15 (which was player-requested + banker-approved)
      but here it is banker-initiated.
  - **Work:** reuse the existing funding plumbing (addMemberFunding /
    buyInTotal); domain + UI; banker-only.
- [ ] **6.8** Dealer tip after win — after receiving an award, the winning player has a time
      window (configurable by the banker, e.g. 10s) to tip the dealer, up to
      a percentage cap (configurable, e.g. 10%) of their own chips.
  - **Work:** domain (computing the tip from the award, deducting from the stack) + UI (a countdown window) +
    room settings. Depends on a stable award/settle path (now available via 6.2).
  - **Note (phase split):** 6.6/6.7/6.8 are close to banker/settlement and stay in this
    phase. In contrast, 7.7/7.8/7.9 are deliberately deferred to Phase 7, because they touch the room state
    machine / membership, not settlement.

**DoD:** the game result is viewable in history.

---

## Decision Gate (between Phase 6 and Phase 7) — architecture evaluation

> A decision gate, not a build task. It must be reviewed **after Phase 6 is finished and before Phase 7 starts**.

- [ ] **DG-1** evaluate migrating from the current **layer-based** structure
      (`domain`/`application`/`infrastructure`/`presentation`) to **feature-based**.
  - Measure cost/benefit on the **existing code**, not theoretically.
  - If **go**: the refactor must be planned, with **green tests at every step**;
    never done in the middle of an open feature.
  - If **no-go**: write the decision and its reason down here so it isn't reopened.
  - **Scope:** decision/evaluation only; this item itself does not refactor.
  - **DoD:** a written go/no-go decision with a reason; if go, a phased plan.

---

## Phase 7 — Hardening

- [ ] **7.1** e2e tests with Playwright (a full scenario + all-in/side-pot).
- [ ] **7.2** security review per the `CLAUDE.md` checklist (IDOR, injection, authz).
- [ ] **7.3** edge cases: disconnect mid-turn, banker leaving (role transfer), empty room.
  - **Note (dependency):** the current temporary constraint "the banker cannot leave until `status==='playing'`"
    is a stopgap and depends on **7.6** (banker-as-non-seated-manager) +
    the role transfer of this same task; it must be revisited when working on 7.3/7.6.
- [ ] **7.4** basic observability (structured logging) + error boundaries.
- [ ] **7.5** Redis adapter for Socket.io (horizontal scale) — optional for the MVP.

- [ ] **7.6** Banker as non-seated manager — the banker does not necessarily sit at the table;
      they can simply be the **room/game manager** (without a seat/stack). **A change to the
      membership model**, depends on 7.3 and with priority after Phase 4 is stabilized.
  - **Motivation:** the banker role (buy-in control, deal/advance, settle, ending the game)
    is independent of their participation in the current hand. Right now we have an implicit assumption that the banker is a
    seated player; this assumption must be broken.
  - **Impact:**
    - `membership/lifecycle`: a member can be banker without a seat/stack; not dealt at the
      start of a hand and not included in the turn order and side-pot calculation.
    - the temporary banker-leave constraint (the banker cannot leave until `status==='playing'`)
      is revisited with this new model.
    - `presentation`: a "manager without a seat" view, separate from sitting at the table.
  - **Work (initial plan — turn it into a precise, scoped task before starting):** the
    `banker` role independent of `seat` in the membership model; review the deal/turn lifecycle to
    skip a non-seated banker; coordinate with the role transfer in 7.3.
  - **DoD:** the banker can manage the game without sitting at the table; deal/turn/
    side-pot ignore them; the banker-leave constraint is revisited per the new model.

- [ ] **7.7** Banker pause/resume — a room-level state called `'paused'` that freezes all
      actions and turn timers; resume continues from the same point.
  - **Work:** a server-authoritative state machine + timer + gateway. Lifecycle
    hardening.
- [ ] **7.8** Seat swap with banker approval — the banker opens a 'swap' window
      in which players can change seats; when the banker closes the window,
      the seats are locked and the game continues.
  - **Work:** membership/lifecycle; related to 4.14 (sit-out/leave) and 7.6
    (banker-as-manager).
- [ ] **7.9** Automatic game end by hand-count or time — at the start of the game the banker sets a
      limit: N hands (e.g. 120) or total duration (e.g. 2h, from the first hand). On
      reaching the limit the game automatically ends to the net-report page.
  - **Work:** depends on the end-game path (6.2). Lifecycle.

**DoD:** ready to deploy; full CI green.

---

## Per-task execution note

1. `git switch develop && git pull`
2. `git switch -c feature/<phase>.<task>-<slug>`
3. Announce the task to the user.
4. Work + Conventional commits.
5. push + open a PR toward `develop`.
6. Wait for CI to go green and review.
