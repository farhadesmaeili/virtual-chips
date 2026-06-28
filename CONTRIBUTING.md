# CONTRIBUTING — Contribution rules

## ⛔️ Mandatory Git rules

1. **Never** work directly on `main` or `develop`.
2. Before any work: run `git branch` and check the current branch.
3. Every change is made on a **feature branch**.

The pre-commit hook (`scripts/check-branch.sh`) blocks commits on `main`/`develop`, but that is no substitute for your own care.

## Branching model

```
main      ← stable releases only (protected)
  ▲
develop   ← integration branch (protected)
  ▲
feature/* ← day-to-day work
fix/*     ← bug fixes
chore/*   ← tooling/docs
```

Naming pattern: `feature/<phase>.<task>-<slug>` — example: `feature/3.4-turn-timer`.

## Workflow

```bash
git switch develop && git pull
git switch -c feature/3.4-turn-timer
# ... code + commit ...
git push -u origin feature/3.4-turn-timer
# then a PR toward develop
```

## Conventional Commits

Format: `type(scope): subject`

types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`.

Examples:

- `feat(engine): add side-pot layer peeling`
- `fix(realtime): prevent acting out of turn`
- `test(engine): cover multi all-in side pots`

The commit-msg hook enforces this format with commitlint.

## Before pushing

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Pull Request

- Open it toward `develop`.
- Fill in the PR template.
- CI must be green and at least one review is required (per branch protection).
