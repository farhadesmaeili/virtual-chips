---
name: vc-brain-handoff
description: Prepare an evidence-based Virtual Chips task or session handoff after engineering work. Inspect actual changes and available test results, record open issues, and propose or make scoped Brain updates without publishing.
---

# Prepare a Virtual Chips handoff

Follow [MEMORY-PROTOCOL.md](../../../docs/brain/MEMORY-PROTOCOL.md). Read
[ACTIVE-TASK.md](../../../docs/brain/ACTIVE-TASK.md) and the relevant existing
handoff before writing; preserve the user's current task and mutation limits.

1. From the repository root, inspect branch and HEAD,
   `git status --short --untracked-files=all`, `git diff`, `git diff --cached` and untracked files
   relevant to the task. Check unresolved operations. Compare against the recorded
   starting state; distinguish your changes from unrelated pre-existing work.
   Never use `git diff` alone as the file inventory.
2. Gather actual command results from this session or explicitly attributed
   prior evidence. Record command, outcome, counts if available, date and relevant
   environment limits. If results are unavailable, say UNVERIFIED or not run;
   test files and CI configuration are not proof of a pass. Do not rerun expensive
   or externally mutating checks merely to fill a handoff field.
3. Use the [handoff template](../../../docs/brain/templates/HANDOFF.md) to write
   `docs/brain/handoffs/YYYY-MM-DD-task-ID.md` when memory writes are in scope.
   Include start/end HEAD, objective, exact changed paths, completed work,
   executed tests/results, unresolved issues, decisions and next action. With no
   commit, both HEADs may be identical; record the uncommitted delta explicitly.
   Preserve older records, using dated corrections for newly discovered errors.
4. Identify justified changes to project state, active task, next steps and
   feature/decision notes. Make only authorized, evidence-supported updates and
   link the handoff from its index. If the task is read-only or memory writes are
   excluded, provide the handoff and suggested updates in the response instead.
   Separate VERIFIED implementation from DOCUMENTED intent, PROPOSED work and
   UNVERIFIED hypotheses.
5. Validate changed Markdown links, public-safe content and scope; inspect the
   final diff including untracked files. Confirm the ending branch/HEAD and
   report remaining limitations. Mark ready for review only after verification;
   never imply independent approval, deployment or remote visibility.

Never commit, push, open a PR or start synchronization automatically. This skill
grants no authority to publish, read secrets or expand runtime/database scope.
