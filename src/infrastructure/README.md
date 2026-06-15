# infrastructure

Implementations of the application ports. All side effects (DB, sockets, auth)
live here.

- `persistence/` — Prisma repositories
- `realtime/` — Socket.io gateway + handlers
- `auth/` — Auth.js config

**Allowed imports:** `infrastructure`, `application`, `domain`, and external
packages. (Enforced by `eslint-plugin-boundaries`.)
