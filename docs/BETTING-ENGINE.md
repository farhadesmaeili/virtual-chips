# docs/BETTING-ENGINE.md — Betting engine specification

The betting engine is the heart of the project. This file defines its precise behavioral contract so the implementation can be done without ambiguity. The engine must be **pure**: `(state, action) => newState`. No I/O, randomness, or real time inside it (time is provided as a tick input).

> We **do not evaluate hands**. The engine only manages chips, turns, the pot, and settlement. The winner is determined by a human (banker or showdown).

---

## 1) State model

```
Hand
├── id
├── roomId
├── street: number            // 0..N — the betting "street" (preflop/flop/... just a label)
├── players: PlayerInHand[]
├── buttonSeat: number        // dealer button
├── currentBet: number        // the highest amount committed on this street
├── lastRaiseSize: number     // for computing the min-raise
├── actingSeat: number | null // whose turn it is
├── actionDeadline: number|null// timestamp (epoch ms) of the turn's end
├── pots: Pot[]               // main + side pots
└── status: 'betting' | 'awaiting_showdown' | 'settled'

PlayerInHand
├── seat
├── userId
├── stack: number             // remaining chips
├── committedThisStreet: number
├── committedTotal: number    // total for this Hand (for side-pot)
├── state: 'active' | 'folded' | 'all_in' | 'sitting_out'
└── hasActedThisStreet: boolean

Pot
├── amount: number
└── eligibleSeats: number[]   // who is eligible for this pot
```

---

## 2) Actions and validation rules

`toCall(player) = currentBet - player.committedThisStreet`

| Action   | Condition for being allowed                                                           | Effect                              |
| -------- | ------------------------------------------------------------------------------------- | ----------------------------------- |
| `FOLD`   | always (when it's their turn)                                                         | `state='folded'`                    |
| `CHECK`  | `toCall == 0`                                                                         | only `hasActedThisStreet=true`      |
| `CALL`   | `toCall > 0` and `stack >= toCall`                                                    | `stack -= toCall`, add to committed |
| `BET`    | `currentBet == 0` and `amount >= minBet` and `amount <= stack`                        | open the betting                    |
| `RAISE`  | `currentBet > 0` and raiseTo `>= currentBet + lastRaiseSize` and `<= committed+stack` | increase                            |
| `ALL_IN` | always (when it's their turn)                                                         | commits the entire `stack`          |

- `minBet` = big blind (room settings).
- **Min-raise:** the minimum increase = the size of the last bet/raise (`lastRaiseSize`). For the first bet on each street, `lastRaiseSize = minBet`.
- If `stack < toCall`, the player can only `ALL_IN` (an incomplete call).
- **An all-in less than the min-raise:** does **not** reopen the action for those who have already acted (standard poker rule). In the MVP it can be simplified, but this behavior is correct — note it in a code comment.

All of this validation happens **on the server** and in the engine. An invalid action → `DomainError` (e.g. `NotYourTurnError`, `InvalidRaiseError`, `InsufficientChipsError`).

---

## 3) End of a Street

A street closes when:

1. At most one `active` player remains (the rest folded/all_in) — or —
2. All `active` players:
   - `hasActedThisStreet == true`, and
   - `committedThisStreet == currentBet` (everyone has matched).

Then:

- The `committedThisStreet` values are zeroed, `currentBet=0`, `lastRaiseSize=minBet`, `hasActedThisStreet=false`.
- If a next street exists → `street++` and the turn goes to the first `active` player left of the button.
- If all streets are done or only one person remains → `status` moves toward showdown/settlement (section 5).

**Turn order:** clockwise from the button. `folded`/`all_in`/`sitting_out` players are skipped.

---

## 4) Side Pots calculation (the most important part)

When players go all-in with different amounts, the pot is broken into layers. Each player is only eligible for the pots they contributed a share to.

**Algorithm (layer peeling):**

Input: a list of players with their `committedTotal` and whether they are folded. (A folded player's chips stay in the pot but they are not eligible to win.)

```
1. contributions = map<seat, committedTotal>  // including folded ones too
2. pots = []
3. while any positive contribution remains:
4.   minLevel = the smallest positive amount among the non-folded players who still have a share
        (if only folded players have a share, minLevel = the smallest remaining share)
5.   layerAmount = 0
6.   eligible = []
7.   for each seat with contribution > 0:
8.       take = min(contribution[seat], minLevel)
9.       layerAmount += take
10.      contribution[seat] -= take
11.      if seat is non-folded → eligible.push(seat)
12.   pots.push({ amount: layerAmount, eligibleSeats: eligible })
13. merge pots with identical eligibleSeats (optional, cleaner)
```

**Example:**

- A all-in with 100, B all-in with 60, C with 200 (calls up to 200).
- contributions: A=100, B=60, C=200.
- Layer 1 (level=60): 60 from each → main pot = 180, eligible = {A,B,C}.
- Remaining: A=40, C=140.
- Layer 2 (level=40): 40 from each of A and C → side pot 1 = 80, eligible = {A,C}.
- Remaining: C=100.
- Layer 3: only C, 100 → side pot 2 = 100, eligible = {C} (returned to C — uncontested).

Result: main=180 (A,B,C), side1=80 (A,C), side2=100 (C).

> This algorithm must be covered with numerous unit tests (including multiple simultaneous all-ins and folded players).

---

## 5) Determining the winner and settlement

### uncontested pot

If in a pot only one `eligible` and non-folded player remains → they are automatically the winner, with no need for a human declaration.

### Mode A — Banker-declared

In `awaiting_showdown`, the banker chooses the winner/winners for **each pot** from among the `eligibleSeats`. Equal division for a split (the remainder of the division to the nearest player left of the button — odd chip rule).

### Mode B — Player-showdown

The remaining `active` players each "claim" or "muck"; then **the banker confirms** (since we have no hand evaluation). Until the banker confirms, no chips are transferred.

Setting `room.settlementMode: 'banker' | 'showdown'`.

### End of game (Banker ends game)

The banker hits "end":

- `net[player] = currentChips - totalBuyIn`
- The sum of the nets must be zero (zero-sum). If rake is enabled, it is deducted from this sum and reported.
- The result is stored in the DB and kept for history.

---

## 6) Turn timer

- When the turn reaches a player, the server sets and broadcasts `actionDeadline = now + room.actionTimeoutMs`.
- **The client renders the countdown from the deadline** (not via a continuous server tick — to prevent spam).
- If the deadline passes and the player does not act, the server applies an auto-action:
  - if `toCall == 0` → `CHECK`
  - otherwise → `FOLD`
- (Optional) Time-bank: storing extra time for each player.
- The server is authoritative; the server's deadline is valid, not the client's clock.

---

## 7) Domain errors (typed)

`NotYourTurnError`, `InvalidActionError`, `InvalidRaiseError`, `InsufficientChipsError`, `NotBankerError`, `RoomFullError`, `HandNotInBettingError`. These are defined in `domain/errors` and mapped to a user-friendly message at the socket boundary.
