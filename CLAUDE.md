# CLAUDE.md — Virtual Chips

> Claude Code reads this file automatically. Before doing anything, read this file completely and follow it.

---

## ⛔️ Mandatory rules (MANDATORY — before anything)

These three rules are **non-negotiable**. Before any change to the code or any commit:

1. **First run `git branch`** and make sure you are on a branch matching the `feature/*` (or `fix/*` / `chore/*`) pattern.
   - If you are on `main` or `develop`, **immediately** stop and create a feature branch:
     `git switch -c feature/<task-name>`
2. **Never** work/commit/push directly on `develop` or `main`.
3. Every commit must be on the current feature branch. The pre-commit hook enforces this (`scripts/check-branch.sh`), but you must check it yourself too.

**Workflow for every task:**

```
git switch develop && git pull
git switch -c feature/<task-id>-<short-name>
# ... work + conventional commits ...
git push -u origin feature/<task-id>-<short-name>
# then a Pull Request toward develop
```

**For every task you start, first announce to the user** which task from `docs/ROADMAP.md` you are picking up.

---

## 🎯 What the project is

**Virtual Chips** is a _betting_ layer for poker-style games — **we do not implement the game itself (hand evaluation)**. We only handle virtual chip management, turns, actions, the pot, and settlement.

- Players create a **Room** and play together.
- Each player acts on their own turn with a **timer**: `fold` / `check` / `call` / `bet` / `raise` / `all-in`.
- One person is the **Banker**, who controls buy-ins and announces the end of the game.
- The winner of each pot is determined in two ways (both supported):
  - **Banker-declared:** the banker declares the winner manually.
  - **Player-showdown:** players claim and the banker confirms.
- Everything is **real-time**; everyone sees events instantly.
- Account + game history is stored (DB).

Logic details in `docs/BETTING-ENGINE.md` and the event contract in `docs/REALTIME-EVENTS.md`.

---

## 🧱 Tech Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Framework    | Next.js 14+ (App Router) + TypeScript (strict)          |
| Real-time    | Socket.io (custom server) + Redis adapter (for scale)   |
| Database     | PostgreSQL + Prisma                                     |
| Auth         | Auth.js (NextAuth)                                      |
| Validation   | Zod (schema shared client/server)                       |
| Client State | Zustand                                                 |
| Styling      | Tailwind CSS                                            |
| Animations   | **Framer Motion** (mandatory — professional animations) |
| Tests        | Vitest (unit) + Playwright (e2e)                        |
| Tooling      | ESLint + Prettier + Husky + lint-staged + Commitlint    |

---

## 🏛 Architecture (Clean Architecture)

Dependencies point inward only. `domain` has no dependency on a framework.

```
src/
├── domain/            # pure game logic — no dependency on Next/Socket/Prisma
│   ├── entities/      # Room, Player, Hand, Pot
│   ├── value-objects/ # Chips, Seat, Money
│   ├── engine/        # BettingEngine (state machine) + SidePot calculator
│   └── errors/        # domain errors
├── application/       # use cases — orchestration
│   ├── use-cases/     # CreateRoom, JoinRoom, PlayerAct, BankerSettle ...
│   └── ports/         # repository interfaces (Dependency Inversion)
├── infrastructure/    # implementations of the ports
│   ├── persistence/   # Prisma repositories
│   ├── realtime/      # Socket.io gateway + handlers
│   └── auth/          # Auth.js config
└── presentation/      # Next.js (app/, components/, hooks/, stores/)
```

**Principles:**

- The betting engine (`domain/engine`) must be **pure and fully testable**; it takes state as input and returns new state. No I/O inside it.
- Follow SOLID; especially Dependency Inversion between `application` and `infrastructure`.
- Side-effects (DB, socket) only in the infrastructure layer.

---

## 🔐 Security rules (to be followed in every task)

- **Server authoritative:** never trust the client. All action validation happens on the server in the domain engine. The chips/pot value is never taken from the client.
- **Authorization (IDOR/Broken Access Control):** a player can only act on **their own turn** and only for **themselves**. Banker actions only by the banker. These are checked in the use-cases, not only the UI.
- **Auth on the socket:** on `connection`, the session/token is validated; an anonymous connection is rejected.
- **Input validation (Injection):** all socket and API inputs are validated with **Zod**.
- **Rate limiting:** put a rate limit on actions and room creation (anti-spam / anti-abuse).
- **Prisma** is parameterized (against SQL Injection); never write a raw query with concatenation.
- **CSRF/XSS:** use React's default escaping; `dangerouslySetInnerHTML` is forbidden unless sanitized.
- Secrets only in `.env` (server side); no secret should go into the client bundle.

---

## ✍️ Code standards

> ## ⚠️ Mandatory test rule (no exceptions)
>
> **Every piece of logical code (business logic) must have a unit test in its own PR. Code without tests is not merged.** This rule has **no exceptions** unless the file is purely config / types / structure (without behavior).
>
> **Before finishing every task, check yourself:** "Did I write new logic that has no test?" If yes, **before reporting to the user**, add the test.
>
> **Never** forget this.

- All code and code comments in **English**.
- TypeScript **strict**; using `any` is forbidden (use `unknown` + narrowing if needed).
- Explicit error handling; domain errors should be typed (`domain/errors`).
- Small, single-responsibility, testable functions.
- Conventional Commits (example: `feat(engine): add side-pot calculation`).
- Every piece of domain logic must have a **unit test**. The betting engine = high coverage.

---

## 🎬 Animation rules (mandatory)

Animations are an integral part of the product, not a last-minute decoration:

- Library: **Framer Motion**.
- The minimum that must be animated:
  - Chip movement from player to pot and from pot to winner (chip stack physics-like).
  - The timer ring around the active player's avatar (countdown ring).
  - Turn change (highlight transition between seats).
  - Player enter/leave (`AnimatePresence`).
  - Win effect (pot collection + celebration).
  - dealer button and blinds with smooth movement.
- Principles: 60fps, use `transform/opacity` (not layout-thrash), respect `prefers-reduced-motion`, professional spring transitions.
- More details: `docs/ANIMATIONS.md` (completed in Phase 5).

---

## 🗺 Roadmap

The full task breakdown is in `docs/ROADMAP.md`. Follow the order of the phases. Before starting each phase, announce its tasks to the user.
