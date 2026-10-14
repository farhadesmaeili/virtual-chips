# ADR-001 — Git-versioned Markdown project memory

- **Decision ID:** ADR-001.
- **Status:** accepted for Task 001 implementation, per the user's Phase 1 scope;
  independent review is pending.
- **Date:** 2026-10-15.
- **Confidence:** DOCUMENTED task requirement; implementation checked in the
  [Task 001 handoff](../handoffs/2026-10-15-task-001.md).

## Context

Engineering context must survive conversations and be readable in Obsidian,
Codex, Claude Code and a GitHub-connected chat without changing the application.
Existing specifications remain canonical and some contain historical drift.

## Options considered

1. Plain Markdown in the repository with selective context loading and explicit
   handoffs — matches the requested Phase 1 boundary.
2. Copy all specifications into the vault — rejected because competing copies
   would drift and consume context unnecessarily.
3. Automated sync, embeddings, external memory services or plugins — excluded by
   Task 001; their future suitability has not been evaluated.

## Decision and rationale

Use `docs/brain` as an independent Markdown vault with small state/task entry
points, focused feature notes, decision records and historical handoffs. Keep
[MEMORY-PROTOCOL.md](../MEMORY-PROTOCOL.md) as the sole memory policy. Root agent
instructions and two Codex skills route to it. Use relative links inside the
vault and an [evidence index](../SOURCES.md) with repository-relative paths and
pinned public-source links for files outside the vault.

This supports ordinary Git review and both agent workflows without a new runtime,
dependency, platform-specific filesystem feature or automatic external transfer.

## Consequences

Updates depend on a developer/agent following the protocol. Notes can become stale
and must be reverified. GitHub readers cannot see local changes before authorized
publication; pinned source links deliberately retain the historical baseline.
Obsidian settings stay local. No claim of automatic synchronization, production
readiness or a feature-based architecture migration follows from this decision.

## Related files and references

[Home](../00-HOME.md), [active task](../ACTIVE-TASK.md),
[memory protocol](../MEMORY-PROTOCOL.md), [source index](../SOURCES.md).
Root `AGENTS.md`, `CLAUDE.md`, `.agents/skills/vc-brain-context/SKILL.md` and
`.agents/skills/vc-brain-handoff/SKILL.md` are the agent entry points.
