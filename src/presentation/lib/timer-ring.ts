// Pure helpers for the active-seat countdown ring (task 5.2). The server is
// authoritative and sends an absolute `actionDeadline` (epoch ms) plus the
// configured turn length `actionTimeoutMs`; these helpers turn that into the
// ring's fill fraction and warning state. No timing clock of their own — they
// are pure functions of (deadline/remaining, total, now).

/** Fraction of the turn's total duration used as the warning threshold. */
export const WARNING_THRESHOLD_RATIO = 0.25;

/**
 * Hard floor for the warning threshold, in ms. Guarantees a real human reaction
 * window even on very short timers (e.g. a 10s turn would otherwise only warn at
 * 2.5s left).
 */
export const WARNING_THRESHOLD_FLOOR_MS = 5_000;

/** Remaining ms until `deadlineMs`, clamped so it never goes negative. */
export function remainingMs(deadlineMs: number, nowMs: number): number {
  return Math.max(0, deadlineMs - nowMs);
}

/**
 * Remaining time at which the ring switches to its warning look (red + pulse).
 *
 * `max(25% of total, 5s)` — the larger of the two is the *earlier* moment in a
 * countdown, so warning is shown at whichever comes first. The ratio scales the
 * warning with a configurable `actionTimeoutMs`; the floor keeps a usable
 * reaction window on short timers.
 */
export function warningThresholdMs(totalMs: number): number {
  return Math.max(
    totalMs * WARNING_THRESHOLD_RATIO,
    WARNING_THRESHOLD_FLOOR_MS,
  );
}

/**
 * Fraction of the ring that should be drawn (1 = full, 0 = empty) for the time
 * left out of the turn's total. Clamped to [0, 1] so an expired or extended
 * (time-bank) turn never over/under-draws.
 */
export function ringFillFraction(remaining: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  const fraction = remaining / totalMs;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * Whether the turn is in its warning window. Inclusive at the threshold so the
 * boundary tick is already "warning".
 */
export function isWarning(remaining: number, totalMs: number): boolean {
  return remaining <= warningThresholdMs(totalMs);
}
