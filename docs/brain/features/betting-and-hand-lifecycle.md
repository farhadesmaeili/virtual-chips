# Betting and hand lifecycle

[Feature index](README.md) · [Next steps](../NEXT-STEPS.md)

- **Purpose:** manage chips, actions, turns, pots and human-confirmed awards.
- **Implementation status:** VERIFIED by source inspection at
  `31cc9ab08ccfdc1bf785abb542bab6ab7b441e04` on 2026-10-15. Unit results are in
  [Task 001](../handoffs/2026-10-15-task-001.md); browser/DB execution is unverified.
- **Boundaries:** pure domain engine; application orchestrates ports; gateway
  owns timers/broadcasts; persistence adapters own I/O. No hand evaluation.

## Important sources and behavior

Paths below are repository-relative; use the [domain source index](../SOURCES.md#domain)
and [application source index](../SOURCES.md#application) for local/browser links.

| Source / symbol                                                        | VERIFIED behavior                                                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/engine/apply-action.ts`                                    | Validates fold/check/call/bet/raise/all-in, turn and amount rules                                                            |
| `src/domain/engine/side-pot.ts`, `settlement.ts`                       | Contribution-based pots, eligible winners, split/odd-chip awards and zero-sum net calculation                                |
| `src/application/use-cases/start-hand.ts` / `StartHand`                | Banker-only; deals funded sitting-in members, rotates the button, posts blinds and opens/reuses a durable Game               |
| `src/domain/engine/street.ts` / `advanceHand`, `dealNextStreet`        | Ends a completed street in `awaiting_street`; banker advances, including all-in run-outs                                     |
| `src/application/use-cases/player-act.ts` / `PlayerAct`                | Resolves the actor from authenticated identity, applies the engine and saves the next hand/deadline                          |
| `src/application/use-cases/settle-hand.ts` / `SettleHand`              | Banker-only. Banker mode uses declarations; showdown mode derives winners from stored claims and ignores client declarations |
| `src/application/use-cases/reset-hand.ts`, `request-time-extension.ts` | Re-deal an in-progress hand under banker control; grant bounded time-bank extensions to the acting player                    |

Dependencies are application ports (`HandStore`, `RoomRepository`, `GameRepository`,
`Clock`, `IdGenerator` as needed), not framework/database imports in domain.
Runtime composition is [server.ts](../SOURCES.md#architecture-and-entry-points).

## Tests

Relevant existing tests: `src/domain/engine/{apply-action,street,side-pot,blinds,
settlement,uncalled,claims-to-declarations,time-bank}.test.ts`,
`src/application/use-cases/hand-use-cases.test.ts` and
`request-time-extension.test.ts`. They exercise pure rules, authorization and
use-case orchestration. Test existence is distinct from execution; see the handoff.

## Known limitations and relevant decisions

**VERIFIED:** the composed HandStore is in memory. Settlement writes individual
member balances and then the hand without one transaction across them. The pure
engine rejects invalid declarations before writes, which does **not** establish
database rollback safety once writes begin. `PlayerAct` uses get/compute/save
without version checks. **UNVERIFIED:** partial-failure and concurrent-action
outcomes; investigate N1–N3 before choosing a persistence/concurrency design.

**DOCUMENTED:** the betting specification is the intended behavioral reference,
but its state/progression section predates manual street control. Follow current
code/tests for observed behavior and report drift. Relevant inherited decisions:
[server authority, pure domain and manual progression](../decisions/README.md).
