# Next steps

Observed 2026-10-15 at the [project baseline](PROJECT-STATE.md). All entries below
are **PROPOSED investigation or engineering candidates**, not incident reports,
confirmed defects or authorization to implement. The
[canonical Roadmap](SOURCES.md#canonical-documents) retains product sequencing;
DG-1 is after Phase 6 and before Phase 7. Priorities here rank engineering attention,
not permission to bypass that gate.

| Priority / ID | Candidate and evidence                                                                                                                                                                   | Evidence needed / scoped outcome                                                                                                                                                                         | Roadmap relationship                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| P0 / N1       | Persistent active-hand state: `server.ts` uses `InMemoryHandStore`; durable Hand/ActionLog models are not connected to the action path.                                                  | Define restart/recovery semantics, state ownership and logging; compare persistence options and propose an ADR. Include pending chip-request durability.                                                 | Persistence 2.4; reconnect 3.5; scale 7.5 |
| P0 / N2       | Atomic settlement and database consistency: `SettleHand` and `EndGame` perform separate writes; approval increments funding before removing the request.                                 | Reproduce partial failures/retries in an isolated harness; specify atomicity/idempotency across balances, hand state, results and game closure. Recognize the existing open-game unique index.           | 6.1–6.3; hardening 7.3                    |
| P0 / N3       | Concurrent player-action and timer safety: HandStore has no version/CAS operation; socket callbacks run independently. Last-disconnect timer clearing is separate from read-only resync. | Test action/action, action/timeout, extension/timeout, reset/settle/start and duplicate approval interleavings; test all-clients-disconnect/rejoin. Recommend serialization/locking only after evidence. | 3.3–3.5, 4.12, 7.3                        |
| P1 / N4       | DG-1: evaluate Feature-Based Clean Architecture against the existing layered structure.                                                                                                  | Measure change locality, coupling and migration cost; write go/no-go with reasons. A go requires a phased plan with green tests at each step; no migration in the evaluation task.                       | DG-1, after Phase 6 and before Phase 7    |
| P1 / N5       | Multiplayer end-to-end testing: Playwright exists as a dependency/script, but no config or e2e specs were discovered.                                                                    | Establish an isolated DB/browser harness for login, two-player funding/play/settle/history, all-in side pots, reconnect and authorization failures.                                                      | 7.1                                       |
| P1 / N6       | Security hardening: existing JWT socket auth, Zod and use-case checks are useful controls, not a complete audit.                                                                         | Review cross-room access, banker boundaries, long-lived session handling, rate-limit coverage and public projections using negative tests. No live penetration testing is implied.                       | 7.2                                       |
| P2 / N7       | Reconcile documentation drift recorded in project state.                                                                                                                                 | Update canonical contracts with evidence while preserving historical task-time notes. Check event inventories and actual storage guarantees.                                                             | Cross-cutting documentation follow-up     |
| P2 / N8       | Remaining Phase 6 product scope.                                                                                                                                                         | Scope 6.4 straddle and 6.8 tip separately; define 6.5 "Deal" before work, preserving the no-hand-evaluation boundary.                                                                                    | 6.4, 6.5, 6.8                             |
| P2 / N9       | Later lifecycle/operations work.                                                                                                                                                         | Plan banker transfer/manager role, pause/resume, approved seat swap, automatic end, logging and scale after dependencies and DG-1. Redis pub/sub alone would not make local hand state shared.           | 7.3–7.9                                   |

Evidence entry points: [application](SOURCES.md#application),
[persistence](SOURCES.md#persistence), [realtime](SOURCES.md#realtime),
[tooling](SOURCES.md#tooling-and-ci). Feature notes give the relevant constraints.

## Recommended Task 002

**Hand-state durability and consistency assessment** (N1–N3): trace one complete
hand through memory, balances, settlement and timers; define failure/retry and
concurrency scenarios; propose the smallest coherent persistence/atomicity design
with acceptance tests. Start with read-only inspection; any executable harness or
runtime/database changes need explicit scope for that task. Produce a proposed
ADR and implementation plan. This does not decide DG-1 or begin the feature-based
refactor. First independently review Task 001's documentation and agent guidance.
