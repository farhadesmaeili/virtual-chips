# presentation

Next.js UI. Talks to the backend only through use-cases / socket events — never
reaches into `infrastructure` directly.

- `components/` — React components
- `hooks/` — React hooks
- `stores/` — Zustand stores

**Note on routing:** the Next.js App Router lives at `src/app` because Next
requires `app/` at the project or `src/` root (it cannot be nested under
`src/presentation/app`). Treat `src/app` as the thin routing surface of this
layer and keep reusable UI here under `src/presentation`.

**Allowed imports:** `presentation`, `application`, `domain`, and external
packages. (Enforced by `eslint-plugin-boundaries`.)

**Composition root:** `src/app` (route handlers, the custom server) is the
outermost wiring layer and is additionally allowed to import `infrastructure`
— that is where framework entry points compose repositories, auth, etc. The
restriction above applies to presentation _components_, which must not reach
into `infrastructure` directly.
