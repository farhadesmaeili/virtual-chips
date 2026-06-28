<div align="center">

# 🎰 Virtual Chips

**A virtual-chip betting layer for poker-style games.**

🇬🇧 English · [🇮🇷 فارسی](./README.fa.md)

</div>

---

Players join a **room** and play in real time, each acting on their turn against a countdown timer. One player is the **banker**, who controls buy-ins and ends the game; win/loss is then settled in virtual chips.

> **The game itself (hand evaluation) is intentionally not implemented.** Virtual Chips only manages chips, turns, actions, the pot, and settlement — the cards are physical and a human decides the winner.

## ✨ Features

- Create / join a room
- Player actions: fold / check / call / bet / raise / all-in
- Turn timer with server auto-action (auto-check or auto-fold on timeout)
- Main pot and **side pots** (multi-way all-in, layer-peeling algorithm)
- Two winner-determination modes: **banker-declared** and **player-showdown**
- Real-time state for every member of the room
- Accounts + per-user game history
- Professional animations (Framer Motion), with `prefers-reduced-motion` support

## 🧱 Stack

Next.js (App Router) · TypeScript (strict) · Socket.io · PostgreSQL / Prisma · Auth.js (NextAuth) · Zod · Zustand · Tailwind CSS · Framer Motion · Vitest / Playwright

Architecture is Clean Architecture (`domain` → `application` → `infrastructure` → `presentation`), server-authoritative throughout. See `docs/ARCHITECTURE.md`.

## 📚 Documentation

- `CLAUDE.md` — rules and context for Claude Code (**read this first**)
- `docs/ARCHITECTURE.md` — architecture
- `docs/BETTING-ENGINE.md` — precise betting-engine logic (side pots, settlement, …)
- `docs/REALTIME-EVENTS.md` — the socket event contract
- `docs/ROADMAP.md` — phases and tasks
- `CONTRIBUTING.md` — git and branching rules

## 🚀 Getting started

**Prerequisites:** Node `20` (per `.nvmrc`) · pnpm `9` · Docker (for PostgreSQL) · Redis is optional in dev.

If you don't have pnpm, enable it via corepack: `corepack enable && corepack prepare pnpm@9 --activate`

```bash
# 1) Install dependencies
pnpm install

# 2) Environment variables — copy and fill in the values (at minimum DATABASE_URL)
cp .env.example .env

# 3) Start the database (see "Database with Docker" below)
docker compose up -d

# 4) Generate the Prisma client and apply migrations
pnpm prisma:generate
pnpm prisma migrate deploy

# 5) (optional) Seed development data — users, a dev room
pnpm db:seed

# 6) Run the app  →  http://localhost:3000
pnpm dev
```

`pnpm dev` runs the custom Next.js + Socket.io server (`server.ts`), which is required for real-time play — a plain `next dev` would start Next without the websocket gateway.

## 🐳 Database with Docker

For local development, PostgreSQL (and Redis, used from Phase 3 for the Socket.io scale adapter) come up via Docker:

```bash
docker compose up -d      # postgres on host port 5433, redis on 6379
docker compose ps         # status + healthcheck
docker compose down       # stop (data is kept in the volume)
docker compose down -v    # stop + delete the database data
```

The postgres service matches `DATABASE_URL` in `.env.example` (`postgres:postgres@localhost:5433/virtual_chips`). Host port `5433` is intentional, to avoid clashing with a natively installed PostgreSQL on the default `5432`.

Apply migrations once the database is up:

```bash
pnpm prisma migrate deploy   # apply existing migrations
# or, in dev, to create + apply a new migration:
pnpm prisma:migrate          # = prisma migrate dev
```

### Seeded dev data

`pnpm db:seed` is idempotent and creates three login-ready users (password `password123`): `alice`, `bob`, `carol`, plus a "Dev Table" room (`dev-room`) with alice as banker (SB 5 / BB 10). History is empty for seeded users until a game is played and ended.

## ⛔️ Git golden rule

Never work directly on `main` / `develop`. Always use a `feature/*` branch. Details in `CONTRIBUTING.md`.

## 🧪 Quality gate

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

The same chain runs in CI (`.github/workflows/ci.yml`) and is the final reference.
