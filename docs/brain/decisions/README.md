# Architecture decisions

[Home](../00-HOME.md) · [ADR template](../templates/ADR.md)

## Inherited decisions

These are **DOCUMENTED existing choices**, inspected against the baseline on
2026-10-15. This table is an index, not a claim that historical ADRs or option
analyses existed. Original decision dates and rejected alternatives are not known.

| Choice                                                  | Documented rationale / constraint                                                | Canonical evidence and implementation                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Virtual betting only; human winner determination        | Physical cards and manual game management; no hand evaluation                    | README, betting specification; domain settlement and `SettleHand`                          |
| Layer-based Clean Architecture with inward dependencies | Pure, testable engine; application depends on ports rather than Prisma/Socket.io | Architecture, CLAUDE.md, ESLint boundaries; domain/application/infrastructure/presentation |
| Custom Next.js + Socket.io server                       | Persistent realtime connections and one backend composition point                | Architecture; `server.ts`                                                                  |
| Server owns actions, deadlines and chip movement        | Client sends intent; authorization and rules must not depend on UI controls      | CLAUDE.md, betting/realtime specs; `PlayerAct`, `SettleHand`, socket auth and schemas      |
| Banker-paced street progression                         | Humans pace physical cards, including all-in run-outs                            | Roadmap 4.7; `advanceHand`, `AdvanceStreet` (older betting spec has drift)                 |
| Framer Motion with reduced-motion support               | Consistent motion and accessible fallback                                        | Animation guide, preserved `vc-design` skill; presentation animations                      |

Evidence links: [canonical documents](../SOURCES.md#canonical-documents),
[entry points](../SOURCES.md#architecture-and-entry-points),
[domain](../SOURCES.md#domain), [application](../SOURCES.md#application),
[tooling](../SOURCES.md#tooling-and-ci), [presentation](../SOURCES.md#presentation).

**DOCUMENTED pending decision:** DG-1 evaluates feature-based structure after
Phase 6 and before Phase 7. There is no recorded go/no-go in the inspected Roadmap.
Keep current boundaries; see [next steps N4](../NEXT-STEPS.md).

## Brain decisions

- [ADR-001 — Git-versioned Markdown project memory](ADR-001-project-memory.md):
  accepted Task 001 scope, with manual/agent-guided updates and one shared protocol.

Use a new ADR for a significant new choice. Keep accepted records and add a
superseding decision with links when a choice changes; do not erase its rationale.
