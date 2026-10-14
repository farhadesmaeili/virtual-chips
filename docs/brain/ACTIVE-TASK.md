# Active task

## Task 001 — Virtual Chips Brain Foundation

- **Date:** 2026-10-15.
- **Status:** implemented and verified; ready for independent review. Changes are
  uncommitted. Review, publication and deployment have not occurred.
- **Objective:** establish persistent, reviewable project memory for Obsidian,
  Codex, Claude Code and GitHub-connected ChatGPT without runtime changes.
- **Starting branch:** `feature/brain-foundation`.
- **Starting HEAD:** `31cc9ab08ccfdc1bf785abb542bab6ab7b441e04`.
- **Preflight:** expected repository/origin confirmed; tree clean; no stashes or
  unresolved operations. See [project state](PROJECT-STATE.md).

## Scope and restrictions

Allowed: `docs/brain/**`, root `AGENTS.md`, `.agents/skills/**`, minimal additions
to `CLAUDE.md` and `.gitignore`. Preserve the existing Claude visual design skill.

Do not change runtime TS/TSX, schema/migrations, application configuration,
package.json, dependencies, tests or unrelated documentation. Do not install
packages or add services, plugins, workers, symlinks or synchronization.
Do not create/switch/delete branches, reset/rebase/merge/cherry-pick, alter stashes,
commit, push or create a PR. Stop if the required baseline unexpectedly changes.

## Acceptance checklist

- [x] Navigable, meaningful Markdown vault and templates exist.
- [x] Baseline, features, risks and next steps cite inspected evidence.
- [x] Memory protocol is canonical and shared by both agents.
- [x] Codex skills have valid metadata and useful scoped workflows.
- [x] Links, public-safe content and Obsidian ignore rule are checked.
- [x] Diff contains only approved files; runtime and design skill are unchanged.
- [x] Branch/HEAD are unchanged; no commit, push or PR occurred.
- [x] Actual checks and limitations are recorded in the handoff.

Verification is structural plus local unit testing. Obsidian GUI opening,
fresh-session agent discovery/execution and GitHub connector retrieval were not
performed; those limits do not imply runtime or publication readiness.

## Work record

See [Task 001 handoff](handoffs/2026-10-15-task-001.md) for the file inventory,
verification evidence and next action. Task numbering here follows the Brain
request; it does not renumber or complete product Roadmap items.
