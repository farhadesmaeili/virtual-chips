---
name: vc-brain-context
description: Recover verified Virtual Chips project context before engineering work or when resuming a task. Check Git state, load relevant Brain notes and source evidence, and report stale or conflicting claims.
---

# Recover Virtual Chips context

Use the repository root as the command working directory. This workflow is
read-only; context recovery alone does not authorize edits or Git mutations.

1. Read [Brain home](../../../docs/brain/00-HOME.md) and follow
   [MEMORY-PROTOCOL.md](../../../docs/brain/MEMORY-PROTOCOL.md), the sole memory
   policy. Verify the root, configured remote, branch, HEAD and working tree with
   `git rev-parse --show-toplevel`, `git remote -v`, `git branch --show-current`,
   `git rev-parse HEAD`, `git status --short --untracked-files=all` and
   `git diff --name-status HEAD`. Sanitize credentials if present in remote URLs.
   Check unresolved operations via Git-resolved paths, rather than assuming
   `.git` is a directory. Inspect stash metadata only when required by the task.
2. Compare Git state with the current user's required baseline and restrictions.
   If it differs unexpectedly, report and stop before modifying files. Resolve
   permission/ignore-file errors before claiming a clean tree; do not repair or
   discard unrelated work. Historical Brain baselines are evidence, not a request
   to reset or switch branches.
3. Read [PROJECT-STATE.md](../../../docs/brain/PROJECT-STATE.md) and
   [ACTIVE-TASK.md](../../../docs/brain/ACTIVE-TASK.md). Select only relevant
   [feature notes](../../../docs/brain/features/README.md),
   [decisions](../../../docs/brain/decisions/README.md) and, for resumed work,
   [handoffs](../../../docs/brain/handoffs/README.md).
4. Follow the [source index](../../../docs/brain/SOURCES.md) to current local
   code, tests and canonical docs. Recheck facts that may have changed since a
   note's revision. Record contradictions explicitly; a Roadmap checkbox, schema
   model or dependency declaration alone does not prove a working feature.
5. Return a concise context summary: repository/branch/HEAD and cleanliness;
   current task and boundaries; relevant VERIFIED/DOCUMENTED facts with paths
   and symbols; PROPOSED/UNVERIFIED points, drift or missing evidence; and the
   next scoped action. Do not run the full test suite merely to load context or
   present prior tests as freshly executed.

If repository access is unavailable (for example, a remote-only conversation),
state the retrieved revision and access limits. Never infer local Git state from
GitHub. This skill does not synchronize memory or start background work.
