# Virtual Chips Brain

Persistent engineering context for Virtual Chips. This folder is a plain Markdown
Obsidian vault, intended for Git versioning. It summarizes evidence; it does not
replace the source code or canonical product documentation.

## Load only what the task needs

1. Read the [memory protocol](MEMORY-PROTOCOL.md) and verify repository identity,
   branch and working tree before work.
2. Read [project state](PROJECT-STATE.md) and [active task](ACTIVE-TASK.md).
3. Select the relevant [feature note](features/README.md) and
   [decisions](decisions/README.md); follow their source references to current code.
4. Read a [handoff](handoffs/README.md) only when continuing that work. Consult
   [next steps](NEXT-STEPS.md) when choosing a task. Do not load the whole vault.

## Navigation

| Need                                              | Start here                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Current capabilities, baseline and limitations    | [Project state](PROJECT-STATE.md)                                                                                                  |
| Scope and acceptance criteria                     | [Active task](ACTIVE-TASK.md)                                                                                                      |
| Prioritized investigation and delivery candidates | [Next steps](NEXT-STEPS.md)                                                                                                        |
| Evidence, authority and update rules              | [Memory protocol](MEMORY-PROTOCOL.md)                                                                                              |
| Existing choices and new rationale                | [Decisions](decisions/README.md)                                                                                                   |
| Implementation boundaries and tests               | [Feature knowledge](features/README.md)                                                                                            |
| Session continuity                                | [Handoffs](handoffs/README.md)                                                                                                     |
| Reusable records                                  | [Task](templates/TASK.md), [ADR](templates/ADR.md), [feature](templates/FEATURE.md), [handoff](templates/HANDOFF.md)               |
| Canonical documentation and code                  | [Source index](SOURCES.md), including [architecture](SOURCES.md#canonical-documents) and [Roadmap](SOURCES.md#canonical-documents) |

## Open in Obsidian

Choose **Open folder as vault** and select `docs/brain`. Open `00-HOME.md`.
No plugins, symlinks, special URI schemes or generated indexes are needed.
Local `.obsidian/` settings are ignored; Markdown remains versionable.

Vault-local navigation uses relative Markdown links. Canonical files live outside
the vault: the [source index](SOURCES.md) pairs repository-relative paths (GitHub
and ordinary editors) with revision-pinned browser links for Obsidian. Obsidian
may not resolve parent-directory files outside its vault; use those browser
links, or inspect the current checkout in an editor. Pinned links are historical
evidence, not a claim about the latest branch. The vault itself remains readable
offline; browsing external sources requires their availability.

## Agent entry points

- **Codex:** root `AGENTS.md` directs context loading. Repository skills live in
  `.agents/skills/`; invoke `$vc-brain-context` or `$vc-brain-handoff` explicitly,
  or let Codex select them when their descriptions match. Discovery does not mean
  a skill has run. If they are missing from the selector, reload/start a new
  session and confirm the repository root. See official
  [instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
  and [skills documentation](https://learn.chatgpt.com/docs/build-skills)
  (consulted 2026-10-15).
- **Claude Code:** the existing root `CLAUDE.md` points to this same protocol.
  The existing `vc-design` skill remains intact. The new `.agents` skills are
  Codex entry points; do not assume Claude discovers them. Ask Claude to read the
  protocol and handoff template directly when needed.
- **ChatGPT with GitHub access:** request `docs/brain/00-HOME.md` from a named
  repository revision, then the relevant linked notes and sources. State which
  branch/revision was actually retrieved and which files were inaccessible.
  Local uncommitted/unpushed changes are unavailable through GitHub. This task
  does not publish them, configure a connector or verify connector visibility.

These files guide agents when loaded. There is no background updater, automatic
Git synchronization or guaranteed context injection into every chat.
