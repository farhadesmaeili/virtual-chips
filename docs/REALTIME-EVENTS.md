# docs/REALTIME-EVENTS.md — Socket event contract

All payloads are validated with Zod. Naming: `domain:action`.

## Client → Server

| Event                 | Payload                        | Authz                | Description                                                                          |
| --------------------- | ------------------------------ | -------------------- | ------------------------------------------------------------------------------------ |
| `room:create`         | `{ name, settings }`           | user                 | Create a room, user = banker                                                         |
| `room:join`           | `{ roomId }`                   | user                 | Join (if there is space)                                                             |
| `room:leave`          | `{ roomId }`                   | member               | Leave (not mid-hand; banker not mid-game) (4.14)                                     |
| `room:sit-out`        | `{ roomId }`                   | member (self)        | Sit out; not dealt from the next hand (4.14)                                         |
| `room:sit-in`         | `{ roomId }`                   | member (self)        | Return; dealt again from the next hand (4.14)                                        |
| `hand:start`          | `{ roomId }`                   | banker               | Start a new hand                                                                     |
| `hand:advance-street` | `{ roomId }`                   | banker               | Deal the next street (4.7)                                                           |
| `hand:reset`          | `{ roomId }`                   | banker               | Discard and re-deal the in-progress hand (6.6)                                       |
| `chips:request`       | `{ roomId, amount }`           | member               | buy-in request (4.15)                                                                |
| `chips:approve`       | `{ roomId, requestId }`        | banker               | Approve a chips request                                                              |
| `chips:reject`        | `{ roomId, requestId }`        | banker               | Reject a chips request                                                               |
| `player:act`          | `{ roomId, action, amount? }`  | acting player        | Betting action                                                                       |
| `hand:settle`         | `{ roomId, declarations[][] }` | banker               | Declare/confirm winners + move chips (mode A, and confirm for mode B)                |
| `player:claim`        | `{ roomId, claim }`            | active player (self) | showdown (mode B): claim equal to `'win'` or `'muck'` (6.1)                          |
| `banker:endGame`      | `{ roomId }`                   | banker               | End + settlement                                                                     |
| `banker:adjustChips`  | `{ roomId, seat, amount }`     | banker               | Adjust a member's chips ± (by seat) in lockstep with buyInTotal, between hands (6.7) |
| `history:mine`        | `{}`                           | user (self)          | The user's game history — finished games only (6.3)                                  |

## Server → Client (broadcast to room)

| Event            | Payload                                           | Description                                                               |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `room:state`     | `PublicRoomState`                                 | Full snapshot (on join/resync)                                            |
| `hand:state`     | `PublicHandState`                                 | After each change                                                         |
| `turn:changed`   | `{ actingSeat, actionDeadline }`                  | New turn start + deadline                                                 |
| `action:applied` | `{ seat, action, amount }`                        | For animation/log                                                         |
| `pot:updated`    | `{ pots }`                                        | pot/side-pot change                                                       |
| `hand:settled`   | `{ payouts: { seat, amount }[] }`                 | Hand result (for the win animation)                                       |
| `chips:requests` | `{ requests[] }`                                  | buy-in request queue (4.15)                                               |
| `game:ended`     | `{ nets: { seat, net }[], rake }`                 | Each player's net (without userId)                                        |
| `history:mine`   | `{ games: { gameId, net, roomName, endedAt }[] }` | The user's net history; `endedAt` as an ISO string (without userId) (6.3) |
| `error`          | `{ code, message }`                               | Mapped domain error                                                       |

## Principles

- The server always sends a **deadline (timestamp)**, not a tick-by-tick countdown. The client renders the countdown itself.
- Every connection is authenticated with the session on `connection`; unauthorized → disconnect.
- rate limit: at most N actions per second per socket.
- `PublicHandState` is only a display projection; no sensitive internal data is broadcast.

## Player-showdown (mode B) — claim / confirm (6.1)

- In `awaiting_showdown` and when `room.settlementMode === 'showdown'`, each **non-folded** player declares `'win'` or `'muck'` for **themselves** with `player:claim`. The seat/user is always taken from the session, not from the payload (anti-IDOR).
- Claims are stored on the **hand state** (an additive field on each `PlayerInHand`) and — once the wiring is added — are published additively inside `hand:state`; they persist after resync (single source of truth in the showdown window).
- **No chips move until the banker confirms.** The banker confirms with the same `hand:settle` event (not a separate event). Claims merely pre-fill the declarations (`claimsToDeclarations`), and chip movement happens **only** in the `settleHand` engine — the only award path; there is no parallel path (the net/zero-sum invariants of end-of-game in 6.2 depend on this).
- If a pot has no eligible `'win'` claim, it appears in declarations as `[]` at that pot's index (not removed, not a hole). Exactly as `settleHand` reads "no winner": a contested pot with `[]` is rejected on confirm ("not yet confirmable") and an uncontested pot ignores it and is awarded automatically. The banker-side gate (blocking confirm until every contested pot has a non-empty entry) is applied in a later PR.
- **Drift fix:** earlier versions of this document listed a `banker:declareWinner` event; it was never implemented, and declaring/confirming the winner — for both modes — happens via `hand:settle { roomId, declarations }`.
