/** Wall-clock time source (injected so deadlines are deterministic in tests). */
export interface Clock {
  /** Current time in epoch milliseconds. */
  now(): number;
}
