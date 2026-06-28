# docs/ARCHITECTURE.md — Architecture

## Overview

Virtual Chips is a **server-authoritative** and **real-time** app. All game logic and validation happen on the server; the client only renders and sends intent.

```
┌─────────────┐    Socket.io (WS)     ┌──────────────────────────┐
│  Client(s)  │ ◄───────────────────► │   Custom Node Server     │
│ Next.js UI  │    HTTP (SSR/API)     │  Next.js + Socket.io GW  │
│ Zustand     │ ◄───────────────────► │                          │
│ FramerMotion│                       │  ┌────────────────────┐  │
└─────────────┘                       │  │ application (UC)   │  │
                                      │  │ domain (engine)    │  │
                                      │  └─────────┬──────────┘  │
                                      │            │ ports       │
                                      │  ┌─────────▼──────────┐  │
                                      │  │ infrastructure     │  │
                                      │  │ Prisma │ Redis │Auth│  │
                                      │  └─────────┬──────────┘  │
                                      └────────────┼─────────────┘
                                           ┌───────▼───────┐
                                           │ PostgreSQL    │
                                           │ Redis (pub/sub)│
                                           └───────────────┘
```

## Flow of one action

1. The client sends `player:act` to the server with a payload (action type + amount).
2. The Gateway validates the payload with **Zod** and authorizes the **session**.
3. The use-case (`PlayerAct`) gets the current Hand state from the repository.
4. The `BettingEngine` in domain applies the action → new state or `DomainError`.
5. The new state is persisted and recorded in ActionLog.
6. The Gateway **broadcasts** the public state to all members of the room.
7. If the turn changed, a new timer with `actionDeadline` is set and broadcast.

## Why a custom server?

Socket.io needs a persistent WebSocket connection, which is not simple with stateless Route Handlers. A custom `server.ts` brings up Next.js and Socket.io together. For horizontal scale, the **Redis adapter** keeps messages in sync between instances.

## Layer boundaries (dependencies point inward only)

- `domain` ← no imports from outside.
- `application` ← only `domain` + port interfaces.
- `infrastructure` ← implementations of the ports (Prisma/Socket/Auth).
- `presentation` ← talks to the backend only through use-cases / sockets.

## Public vs private state

Since we have no hidden card information, almost all state is public. Even so, never broadcast internal fields (e.g. a raw userId or session) instead of display data; build a **public projection** of the Hand.
