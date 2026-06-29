/**
 * Display formatting for a player's chip stack. Presentation-only: this is about
 * how a number reads on the felt, not game logic, so it lives here and never in
 * `domain`.
 *
 * Small stacks stay digit-exact (grouped thousands) because precision matters
 * when the number is small. Once a stack is large enough to overflow the tight
 * seat nameplate on a narrow phone, it switches to a compact notation
 * ("100K", "1.2M") that keeps the magnitude unambiguous without truncating —
 * the exact value is still surfaced via the readout's `title` / `aria-label`.
 */
export function formatStackChips(value: number): string {
  // Defensive: non-finite or negative values fall back to plain grouping rather
  // than emitting a misleading compact string (e.g. "-1.2M").
  if (!Number.isFinite(value) || value < 0) {
    return value.toLocaleString();
  }
  if (value < 100_000) {
    return value.toLocaleString();
  }
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
