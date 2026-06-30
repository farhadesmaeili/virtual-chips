/**
 * Display formatting for a player's chip stack. Presentation-only: this is about
 * how a number reads on the felt, not game logic, so it lives here and never in
 * `domain`.
 *
 * Small stacks stay digit-exact (grouped thousands) because precision matters
 * when the number is small. Once a stack is large enough to overflow the tight
 * seat nameplate on a narrow phone, it switches to a compact notation
 * ("100.5K", "1.5M", "999.9B") that keeps the magnitude readable without
 * overflowing the plate — the exact value is still surfaced via the readout's
 * `title` / `aria-label`.
 *
 * The compact path is a pure, locale-independent, TRUNCATING formatter (no
 * `Intl`): every tier (K/M/B/T) keeps a single decimal, always rounding toward
 * zero so a balance never reads higher than it is (e.g. 999_999 → the honest
 * "999.9K", never a flattering "1M"). The decimal separator is always ".", and
 * a trailing zero (and a bare trailing ".") is trimmed.
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
  // 1-decimal compaction across every tier (K/M/B/T) keeps the string at most 6
  // chars (e.g. "999.9B"), so it fits the fixed-width seat nameplate at every
  // screen size; the exact value is still surfaced via the title/aria-label at
  // the call site, so the lost precision is display-only.
  if (value < 1_000_000) {
    return compactTruncated(value, 1_000, 1, 'K');
  }
  if (value < 1_000_000_000) {
    return compactTruncated(value, 1_000_000, 1, 'M');
  }
  if (value < 1_000_000_000_000) {
    return compactTruncated(value, 1_000_000_000, 1, 'B');
  }
  return compactTruncated(value, 1_000_000_000_000, 1, 'T');
}

/**
 * Truncate `value / unit` to at most `decimals` places (toward zero) and render
 * it with `suffix`, trimming trailing zeros and a trailing dot. Integer math
 * throughout to avoid float drift: `value` is a whole chip count, and
 * `unit / 10 ** decimals` is an exact small integer for the K/M cases.
 */
function compactTruncated(
  value: number,
  unit: number,
  decimals: number,
  suffix: string,
): string {
  const factor = 10 ** decimals;
  // Smallest representable step, in chips, for the chosen precision.
  const step = unit / factor;
  // Total count of those steps (truncated), then split into whole + fraction.
  const scaled = Math.floor(value / step);
  const whole = Math.floor(scaled / factor);
  const frac = scaled % factor;

  if (frac === 0) {
    return `${whole}${suffix}`;
  }
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}${suffix}`;
}
