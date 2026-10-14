# Feature knowledge template

Copy into `features/short-name.md`; link it from the feature index. Follow
[MEMORY-PROTOCOL.md](../MEMORY-PROTOCOL.md).

- **Feature name:** name.
- **Purpose:** user or engineering outcome.
- **Implementation status:** implemented / partial / planned, with confidence.
- **Observed date and source revision:** YYYY-MM-DD and Git SHA.

## Architectural boundaries

Responsibilities, authoritative state and allowed dependencies.

## Important source files

Paths, symbols and the specific behavior each supports. Link canonical docs
instead of copying them; note conflicts with source code.

## Dependencies

Ports, adjacent features, libraries and operational prerequisites actually used.

## Tests

Relevant existing test files and behavior covered; link executed results in a
dated handoff. Clearly distinguish not run, historical evidence and fresh results.

## Known limitations

VERIFIED constraints, UNVERIFIED hypotheses and PROPOSED investigations separately.

## Relevant decisions

Link applicable ADRs, inherited decisions and Roadmap task IDs.
