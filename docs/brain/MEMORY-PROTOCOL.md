# Memory reliability protocol

This is the single authoritative policy for **project memory**. Root agent files
and skills link here rather than carrying competing copies. It does not override
the current user's task constraints, repository safety or application contracts.

## Authority and confidence

Current source code, Git history, executed tests and verified operational evidence
take precedence over stale memory. Code inspection proves implementation shape;
it does not prove runtime success, production deployment or complete test coverage.
Canonical documentation states intent and contracts; report divergences instead
of silently treating either a comment or a Roadmap checkbox as runtime evidence.

| Classification | Meaning                                                 | Required supporting detail                                   |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| VERIFIED       | Inspected code/Git fact, or directly observed result    | File/symbol and revision, or exact command, outcome and date |
| DOCUMENTED     | Stated in a specification, Roadmap or existing decision | Source and any known conflict with current code              |
| PROPOSED       | Candidate change, decision or investigation             | Rationale, scope and what would validate it                  |
| UNVERIFIED     | Unknown or not checked in this session                  | Missing evidence and how to obtain it                        |

Use these labels for important claims, grouped when they share evidence. Separate
decision status (proposed/accepted/superseded) from confidence. An inspected
non-transactional flow can be VERIFIED while a suspected failure scenario remains
UNVERIFIED until demonstrated. Do not upgrade historical test results to fresh
passes. Record source revision and observation date; version drift needs rechecking.

## Before a task

1. Read [home](00-HOME.md). Verify repository root and configured remote, current
   branch and HEAD, tracked **and untracked** changes, and unresolved Git
   operations. Inspect stash metadata when the task requires it; do not apply,
   inspect contents of, or change stashes without a reason within authorized scope.
   Resolve unreadable-ignore/config warnings before declaring the tree dirty/clean.
2. Read [project state](PROJECT-STATE.md) and [active task](ACTIVE-TASK.md). Compare
   their baseline with current Git. If an explicitly required starting baseline
   differs, stop before edits and report it. Historical notes do not authorize
   branch switching, resetting or discarding work.
3. Load only relevant [decisions](decisions/README.md),
   [feature notes](features/README.md), and the last relevant
   [handoff](handoffs/README.md). Follow [canonical sources](SOURCES.md).
4. Recheck facts that can drift: implementation, dependencies, tests, CI and
   operations. State conflicts between memory and code before relying on them.
   Do not modify runtime behavior merely to make a stale note true.
5. Establish the current task's objective, permitted files, acceptance checks and
   Git/external-service boundaries. Update the active-task record only within
   that scope; a read-only review remains read-only.

## During development

- Respect existing decisions and architecture boundaries. Record significant new
  choices using the [ADR template](templates/ADR.md), with alternatives and reasons.
  Do not represent a proposal as an approved migration or reconstruct undocumented
  historical deliberations as fact.
- Distinguish observed facts, documented intent and assumptions. Track unresolved
  issues with the evidence needed to resolve them.
- Link canonical files and relevant symbols instead of copying whole documents,
  terminal logs or conversations. Keep entry documents short and feature detail
  local to its note; avoid duplicate status and test ledgers.
- Preserve previous decisions and handoffs. Record a dated correction or a new
  superseding ADR with reciprocal links instead of silently rewriting history.
- Keep memory edits proportional to the task. If memory writes are prohibited,
  return a proposed handoff in the response and leave files untouched.

## After a task

1. Inspect actual tracked changes, staged changes and untracked files. Summarize
   what was implemented, not what was merely planned.
2. Record exact checks actually run, date, outcomes, failures, skipped checks and
   relevant environment limitations. Keep local tests distinct from remote CI;
   keep mocked repository tests distinct from live database/browser evidence.
3. List remaining risks and unresolved questions, with a concrete next action.
4. Create `handoffs/YYYY-MM-DD-task-ID.md` using the
   [handoff template](templates/HANDOFF.md), and link it from the index. Record
   starting and ending HEAD; when no commit was made, state that explicitly and
   describe the uncommitted delta. Do not invent an ending commit.
5. Update [project state](PROJECT-STATE.md) only for facts newly established or
   behavior actually changed. Update [next steps](NEXT-STEPS.md) and relevant
   feature/decision indexes when justified; preserve canonical Roadmap IDs.
6. Update [active task](ACTIVE-TASK.md). Mark ready for review only after relevant
   checks, with limitations explicit. Ready for review does not mean merged,
   independently approved or deployed.
7. Verify links, skill metadata when touched, scope and public-safe content. Leave
   ordinary diffs for review. Never commit, push or open a PR just to save memory.
   Those actions require the current task's authorization.

## Public repository and operational limits

Do not record API keys, passwords (including example/seed passwords), tokens,
authentication secrets, private personal/customer/business data, confidential
infrastructure details or unnecessary local machine paths. Record commands with
safe placeholders rather than sensitive values. Do not read environment files
just to populate memory. Sanitize remote URLs and diagnostic excerpts.

Phase 1 is manual/agent-guided maintenance of Git-versionable Markdown. Instruction
discovery and skill invocation are different from execution and synchronization.
There are no hooks, daemons, embeddings, vector databases, external AI services,
new MCP servers or automatic data transmission in this implementation. Obsidian
is optional and requires no plugin. Connector access never proves that local
uncommitted files are available remotely.
