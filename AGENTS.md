# Virtual Chips — agent instructions

Virtual Chips manages virtual chips, betting turns, pots and human-confirmed
settlement for physical-card games. Hand evaluation is outside the product.

## Start with verified context

Read [Brain home](docs/brain/00-HOME.md), then follow the canonical
[memory protocol](docs/brain/MEMORY-PROTOCOL.md). Read project state and the active
task; load only relevant feature notes, decisions and source files. Verify stale
claims against the checkout before relying on them or updating memory.

Use [vc-brain-context](.agents/skills/vc-brain-context/SKILL.md) to recover context
and [vc-brain-handoff](.agents/skills/vc-brain-handoff/SKILL.md) to prepare a handoff.
These are instruction workflows, not background synchronization.

## Git and task scope

Follow [CONTRIBUTING.md](CONTRIBUTING.md): work on `feature/*`, `fix/*` or `chore/*`,
with PRs toward `develop`; never edit or commit directly on `main` or `develop`.
Announce the task identifier (and Roadmap item when applicable). Check repository
identity, branch, HEAD, tracked/untracked changes and unresolved operations first.
Preserve unrelated work. The active user's task restrictions take precedence over
the generic branch/commit/push workflow: an already prepared branch is not a
reason to switch or recreate it. Memory maintenance grants no publication rights.

## Engineering boundaries

- Follow [architecture](docs/ARCHITECTURE.md) and existing source patterns:
  domain is pure; application orchestrates domain through ports; infrastructure
  implements I/O; presentation renders public state and sends intent. `src/app`
  contains App Router entry points; `server.ts` composes the backend.
- Keep TypeScript strict; use `unknown` and narrowing instead of `any`.
- Validate external inputs, enforce session/turn/banker authorization on the
  server, and keep secrets and private state out of client projections.
- New or changed business logic requires unit tests in the same change. Use
  observable behavior and preserve valid tests. Run relevant existing checks from
  [package.json](package.json) and report actual outcomes, including failures and
  checks not run. A Roadmap checkbox is not test evidence.
- For UI work, read the existing
  [visual design skill](.claude/skills/vc-design/SKILL.md) and
  [animation guide](docs/ANIMATIONS.md). Preserve reduced-motion support.
- DG-1 in the [Roadmap](docs/ROADMAP.md) is an evaluation gate, not authorization
  to migrate to a feature-based architecture during an unrelated task.

## Finish with an accurate handoff

Inspect the full diff and untracked files, verify the claims being recorded, and
follow [MEMORY-PROTOCOL.md](docs/brain/MEMORY-PROTOCOL.md) for scoped state updates
and handoffs. Keep credentials, personal data and local machine details out of
this public repository. Never invent test, deployment, commit or review outcomes.
