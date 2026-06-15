# domain

Pure game logic. Takes state in, returns new state or a typed `DomainError`.
**No external imports** — not Next, not Socket.io, not Prisma, not any npm
package, and not the other layers. This keeps the betting engine fully
unit-testable in isolation.

- `entities/` — `Room`, `PlayerInHand`, `Hand`, `Pot`
- `value-objects/` — `Chips`, `Seat`, `Money`
- `engine/` — `BettingEngine` (state machine) + side-pot calculator
- `errors/` — typed domain errors

**Allowed imports:** only other `domain` modules. (Enforced by
`eslint-plugin-boundaries`.)
