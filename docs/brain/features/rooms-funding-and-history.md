# Rooms, funding and history

[Feature index](README.md) · [Next steps](../NEXT-STEPS.md)

- **Purpose:** manage room membership, approved chip funding and per-user results.
- **Implementation status:** VERIFIED by inspection at
  `31cc9ab08ccfdc1bf785abb542bab6ab7b441e04` on 2026-10-15. Operational DB behavior
  was not exercised. [Task 001](../handoffs/2026-10-15-task-001.md) records tests.
- **Boundaries:** application use-cases own membership/banker checks; Prisma
  adapters implement ports; socket handlers pass authenticated identities.

## Important sources and capabilities

Source links: [application](../SOURCES.md#application),
[persistence](../SOURCES.md#persistence), [auth/realtime](../SOURCES.md#realtime)
and [presentation](../SOURCES.md#presentation).

| Source / symbol                                                                    | VERIFIED behavior                                                                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/auth/options.ts`, `credentials.ts`                             | Credentials provider with JWT sessions; Zod validation, bcrypt comparison and generic login failure                                      |
| `src/application/use-cases/create-room.ts`, `join-room.ts`, `list-user-rooms.ts`   | Room creation/join and the user's room list; memberships and chip balances use RoomRepository                                            |
| `presence.ts`, `leave-room.ts`                                                     | Sit out/in retains membership; leave is self-only, blocked mid-hand and blocked for a banker while playing                               |
| `chip-requests.ts`                                                                 | Request/approve/reject funding; approval rechecks current stack limits and increments chips and buyInTotal together in one member update |
| `adjust-member-chips.ts`                                                           | Banker adjustments with hand-state and funding validation                                                                                |
| `end-game.ts` / `EndGame`                                                          | Banker ends between hands; computes zero-sum net from ledgers, saves results, closes Game and marks room ended                           |
| `list-user-game-history.ts`, `prisma-settlement-repository.ts`                     | Authenticated user's finished-game results, newest first                                                                                 |
| `src/app/history/page.tsx`, `history-screen.tsx`, `net-report.tsx` in presentation | History page and live end-game net-report UI                                                                                             |

Dependencies: PostgreSQL/Prisma for durable entities, NextAuth/bcrypt for login,
application repository ports and the in-memory pending-request/hand stores.
Schema has User, Room, RoomMember, Game, Hand, ActionLog and Settlement models.
Chip columns use BigInt; `chip-codec.ts` converts at the adapter boundary. The
SQL migration defines at most one open Game per room; database application of
that migration is **UNVERIFIED** in this task.

## Tests

Existing use-case tests: `room-use-cases.test.ts`, `chip-requests.test.ts`,
`end-game.test.ts`, `list-user-game-history.test.ts` and `resync-room.test.ts`.
Adapter tests: `prisma-room-repository.test.ts`, `prisma-game-repository.test.ts`,
`prisma-settlement-repository.test.ts`, `chip-codec.test.ts`, `mappers.test.ts`.
Auth and presentation model tests are colocated. Inspected Prisma tests use
doubles; they do not verify actual SQL transactions, constraints or failures.

## Known limitations and relevant decisions

**VERIFIED:** pending funding requests are process-local. Approval changes a
durable balance before removing its in-memory request; it is not an atomic
consume-and-credit operation across both stores. EndGame's save-results/end-game/
update-room sequence is also separate. A unique open-game index alone does not
make these flows transactional or retries idempotent.

**PROPOSED:** investigate retries, simultaneous approvals, funding during a live
hand, and leave/rejoin effects on end-game ledgers in N2/N3. This task did not
reproduce failures or change business rules. Banker role transfer and non-seated
management remain Roadmap 7.3/7.6 candidates. Relevant decisions:
[human settlement and server authority](../decisions/README.md).
