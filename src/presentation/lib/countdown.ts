// Pure helpers for the turn countdown (task 4.9). The server is authoritative
// and sends an absolute `actionDeadline` (epoch ms); the client just renders the
// time left from it — no per-tick game state.

/** Whole seconds left until `deadlineMs`, never negative. */
export function secondsRemaining(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** Formats a seconds count as `m:ss` (e.g. 23 → "0:23", 75 → "1:15"). */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
