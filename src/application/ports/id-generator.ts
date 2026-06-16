/** Generates unique identifiers (injected so use-cases stay deterministic in tests). */
export interface IdGenerator {
  generate(): string;
}
