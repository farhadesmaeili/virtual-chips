# Session / task handoff template

Copy into `handoffs/YYYY-MM-DD-task-ID.md`; link it from the handoff index.
Follow [MEMORY-PROTOCOL.md](../MEMORY-PROTOCOL.md). Replace every prompt with
evidence or an explicit unknown/not-applicable statement.

- **Task identifier:** ID and title.
- **Date:** YYYY-MM-DD (include timezone if timing matters).
- **Status:** in progress / blocked / ready for review; distinguish approval.
- **Branch:** actually observed branch.
- **Starting commit:** verified SHA or unavailable with reason.
- **Ending commit:** verified SHA; if unchanged, explicitly record no commit.
- **Initial/final working tree:** include tracked, staged and untracked scope.

## Objective and boundaries

Requested outcome, permitted changes and restrictions still in force.

## Files changed

Exact added/modified/deleted paths; distinguish pre-existing unrelated changes.

## Work completed

Actual changes with evidence. Separate documented intentions from implementation.

## Tests executed and results

| Command or check                                | Outcome               | Evidence / limitation                    |
| ----------------------------------------------- | --------------------- | ---------------------------------------- |
| Exact invocation, date and relevant environment | Pass / fail / not run | Counts, scoped results or reason not run |

Do not include credentials or raw sensitive logs. Distinguish local tests, remote
CI, mocked adapters, live database checks and browser checks.

## Unresolved issues

Known risks, unverified claims, access limits and steps needed to resolve them.

## Decisions made

Link ADRs or explain why no new architectural decision was needed.

## Recommended next action

One concrete scoped action and any authorization needed. Do not imply commit,
push, PR, deployment or external synchronization occurred without evidence.
