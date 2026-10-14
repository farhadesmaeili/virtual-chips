# Project state

Observed **2026-10-15**, source baseline
`31cc9ab08ccfdc1bf785abb542bab6ab7b441e04`. Labels follow the
[memory protocol](MEMORY-PROTOCOL.md). Reverify before future work.

## Identity and boundaries

**DOCUMENTED:** Virtual Chips is a virtual-chip betting layer for physical-card,
poker-style games. Players share rooms; a banker manages funding and confirms
winners. Hand/card evaluation is intentionally outside scope. No payment or
real-money integration is established by this baseline. See
[README and betting specification](SOURCES.md#canonical-documents).

## Git baseline

**VERIFIED:** configured origin is
`https://github.com/farhadesmaeili/virtual-chips.git`; branch is
`feature/brain-foundation`; starting HEAD is the revision above. The initial
working tree was clean, the stash list empty, and no merge/rebase/cherry-pick/
revert/bisect/sequencer state was found. Git's global-ignore access warning in the
sandbox was resolved by a read-only status check outside it before edits.

The starting commit is local history's merge of PR #100 (action-button amount
overflow); preceding history includes seat stack reveal and hover-hitbox fixes.
This is Git evidence, not a fresh GitHub CI or remote-branch freshness check.
Task 001's documentation remains an uncommitted overlay until separately published.

## Stack and structure

**VERIFIED from manifests/source, not a deployment inventory:**

| Area                        | Baseline                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Runtime/toolchain           | Node 20 target in `.nvmrc`, Node >=20 in package engines; pnpm 9.0.0 declaration                                  |
| Web                         | Next.js 14.2.35 App Router, React 18.3.1; strict TypeScript (lockfile 5.9.3)                                      |
| Backend                     | Custom Node HTTP + Socket.io 4.8.3 server; NextAuth 4.24.14 credentials/JWT sessions; Zod 3                       |
| Persistence                 | PostgreSQL via Prisma 5.22.0; chip columns use BigInt with number conversion at adapters                          |
| UI                          | Zustand 4 for connection/user state; room/hand state in React; Tailwind 3 and Framer Motion 11                    |
| Checks                      | Vitest 2.1.9, ESLint 8, Prettier 3, Husky/Commitlint; Playwright dependency/script without a discovered e2e suite |
| Optional scale dependencies | Redis adapter and ioredis are declared but not wired in `server.ts`                                               |

Exact locked versions come from [tooling sources](SOURCES.md#tooling-and-ci).

The architecture is **layer-based Clean Architecture**: pure entities/engine in
`src/domain`; use-cases and ports in `src/application`; Prisma/auth/realtime
adapters in `src/infrastructure`; UI in `src/presentation`. `src/app` holds the
actual App Router pages and auth route; `server.ts` is the composition root.
[ESLint boundaries](SOURCES.md#tooling-and-ci) encode inward dependency rules.
DG-1 has not selected a feature-based migration.

## Implemented capabilities

**VERIFIED by code inspection**; passing unit tests alone do not establish a full
multiplayer flow. Source pointers, test files and limitations are in these notes:

- [Betting and hand lifecycle](features/betting-and-hand-lifecycle.md): all six
  actions, blinds, dealer rotation, manual street advancement, side pots,
  banker/showdown settlement, hand reset and time bank.
- [Rooms, funding and history](features/rooms-funding-and-history.md): credentials
  login, create/join/resync, active-room list, sit-out/in and guarded leave,
  chip requests/approval, direct adjustments, end-game net report and user history.
- [Realtime and table UI](features/realtime-and-table-ui.md): authenticated socket
  handlers, validation, selected action rate limits, public projections, deadline
  timers, responsive table controls, chip/turn/win animations and reduced motion.

## Known limitations and evidence gaps

| Classification        | Observation and implication                                                                                                                                                               | Evidence / follow-up                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| VERIFIED              | Live hands and pending chip requests are process-local maps; no restart recovery is wired. Prisma `Hand`/`ActionLog` models do not prove runtime writes.                                  | [Persistence sources](SOURCES.md#persistence); candidate N1                        |
| VERIFIED              | Hand settlement writes each member separately, then saves the hand; end-game writes results, closes the game and changes room status separately. No shared transaction spans these paths. | [Settlement sources](SOURCES.md#application); candidate N2                         |
| VERIFIED / UNVERIFIED | HandStore offers get/save/clear; handlers await independently and the inspected action path has no per-room serialization/version check. Actual race outcomes were not reproduced.        | [Realtime](SOURCES.md#realtime), [PlayerAct](SOURCES.md#application); candidate N3 |
| VERIFIED / UNVERIFIED | Last disconnect clears a room timer; resync reads state without rearming it. Recovery after all clients leave needs a behavioral check.                                                   | `server.ts`, `HandGateway`, `ResyncRoom`; candidate N3                             |
| VERIFIED              | Room membership/ledgers and game/settlement repositories exist; the open-game uniqueness migration exists. Applying that migration to any current DB was not checked.                     | [Persistence sources](SOURCES.md#persistence)                                      |
| UNVERIFIED            | Real browser multiplayer, database failure recovery, complete security coverage, mobile frame rate and production readiness are not established.                                          | [Next steps](NEXT-STEPS.md)                                                        |

## Documentation drift

**VERIFIED comparison, not an edit to the canonical documents:**

- Architecture describes persisted action logging and Redis scaling; the composed
  runtime uses an in-memory hand store and no Redis adapter.
- Betting specification omits `awaiting_street` and describes automatic street
  progression; `advanceHand` pauses and `AdvanceStreet` requires the banker.
- Roadmap contains historical "current status" text for absent blinds, default
  funding and missing active-table UI, plus a remaining-6.2 note; current code
  implements these paths. Its completed checkboxes are not independent tests.
- Roadmap 4.14 suggests mid-hand leave acts as fold; `LeaveRoom` rejects mid-hand
  leave. Banker leave is blocked while the room is `playing`.
- Realtime docs are not exhaustive: handlers include `room:resync`, `rooms:mine`
  and `turn:request-time`. Some showdown text still describes later wiring.
- The preserved design skill says `three` is a dependency; package.json and the
  lockfile do not list it. Do not install it based on that note.

See [canonical documents](SOURCES.md#canonical-documents) and the linked feature
notes for current implementation evidence. Reconcile only in an authorized task.

## Planned work, tests and operations

**DOCUMENTED:** Roadmap leaves 6.4 straddle, undefined 6.5 "Deal", 6.8 dealer tip,
DG-1 and Phase 7 hardening/lifecycle work open. See the prioritized
[next steps](NEXT-STEPS.md); these are candidates, not automatically confirmed bugs.

**VERIFIED configuration:** CI on push/PR to main/develop installs locked
dependencies, generates Prisma, then checks format, lint, types, unit tests and
build. A PostgreSQL service is declared, but the workflow does not run migrations
or Playwright. Inspected repository tests use Prisma doubles, not a live database.
See [CI and tests](SOURCES.md#tooling-and-ci).

Task 001's exact executed checks and results are recorded once in its
[handoff](handoffs/2026-10-15-task-001.md). Historical Roadmap DoD statements and
merge commits do not establish a current green CI run.

**UNVERIFIED:** deployment target, live URL, deployed revision, production database
state and remote CI status. No deployment or operational inspection was performed.
