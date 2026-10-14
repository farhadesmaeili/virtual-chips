# Realtime and table UI

[Feature index](README.md) · [Next steps](../NEXT-STEPS.md)

- **Purpose:** synchronize public room/hand views and collect player/banker intent.
- **Implementation status:** VERIFIED by inspection at
  `31cc9ab08ccfdc1bf785abb542bab6ab7b441e04` on 2026-10-15; live multiplayer,
  accessibility and mobile frame-rate measurements were not performed.
- **Boundaries:** Node composition + Socket.io infrastructure dispatch into
  application use-cases; presentation uses public projections and socket types.

## Important sources and dependencies

| Evidence                                                     | VERIFIED implementation                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [server.ts](../SOURCES.md#architecture-and-entry-points)     | Custom HTTP/Next server, socket auth, repositories/stores and handler registration; clears a room timer on its last disconnect              |
| [Socket boundary](../SOURCES.md#realtime)                    | `socket-auth.ts` validates the NextAuth JWT cookie at connection; schemas validate payloads; handlers derive user identity from socket data |
| `hand-gateway.ts` in that directory                          | Broadcasts hand/turn/action/pot/settlement events; schedules deadline-based auto-check/fold and time extensions                             |
| `room-handlers.ts`, `funding-handlers.ts`, `rate-limiter.ts` | Room/resync/history and funding handlers; rate limits on selected create/action/request paths                                               |
| `hand-projection.ts`, `room-projection.ts`                   | Explicit display projections; room/hand broadcasts omit raw user IDs                                                                        |
| [Presentation sources](../SOURCES.md#presentation)           | Shared socket client, connection/user Zustand store and public socket types; RoomView keeps room/hand and live animation state in React     |
| Table/seat/action components and animation modules           | Chip travel, countdown ring, turn highlight, presence and win effects; shared reduced-motion handling defaults to reduced when unknown      |

Dependencies: Next.js/React, Socket.io, NextAuth, Zod, Zustand, Framer Motion and
Tailwind. Redis packages are declared, but `server.ts` does not create a Redis
adapter or shared hand store. App Router pages are under `src/app`, not inside
`src/presentation/app` as an older illustrative layout might suggest.

## Tests and limitations

Existing unit tests cover HandGateway timers/sit-out/end-game, schema parsing,
socket token/cookie helpers, rate limiting, public projections and presentation
models (seat layout, available actions, chip motion, countdown, reduced motion,
history and net report). [Task 001](../handoffs/2026-10-15-task-001.md) records the
actual run. They are not a two-browser Socket.io acceptance test.

**VERIFIED / UNVERIFIED:** resync reads the in-memory hand and pending requests
after checking membership; it does not rearm the timer cleared on last disconnect.
Rejoin timing behavior needs an explicit check (N3). Concurrent callbacks and
timeout/extension overlap need controlled interleaving tests; source inspection
does not establish that all such races are safe.

**DOCUMENTED:** design and animation rules remain canonical; 60fps is a target,
not a measured result here. The realtime event document omits some handlers and
contains historical showdown-wiring notes. Use handlers, schemas and projections
to verify current behavior. Relevant inherited decisions:
[custom server, server authority and motion](../decisions/README.md).
