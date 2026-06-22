// Maps a chip amount to its representative casino denomination so bets and the
// pot are tinted by real chip colors (vc-design: chip color encodes value — it
// is information, not decoration). Pure; no DOM.

export type Denomination = 1 | 5 | 25 | 100 | 500 | 1000;

/** Casino denominations, largest first. */
export const DENOMINATIONS: readonly Denomination[] = [
  1000, 500, 100, 25, 5, 1,
];

/** The largest denomination not exceeding `amount` (the top chip of a stack). */
export function topDenomination(amount: number): Denomination {
  for (const d of DENOMINATIONS) {
    if (amount >= d) return d;
  }
  return 1;
}

/** The CSS color variable for a denomination (see globals.css `--vc-chip-*`). */
export function chipColor(denom: Denomination): string {
  return `var(--vc-chip-${denom})`;
}

/** How many chips of one denomination make up part of an amount. */
export interface DenominationCount {
  readonly denom: Denomination;
  readonly count: number;
}

/**
 * Greedy decomposition of `amount` into the existing denomination tiers, largest
 * first — e.g. 175 → [{100,1}, {25,3}]. Used to render the pot as a real mixed
 * stack instead of one color. Exact and total-preserving: the sum of
 * `denom * count` equals `floor(max(0, amount))` (chip amounts are whole, and the
 * smallest tier is 1, so any non-negative integer decomposes with no remainder).
 */
export function denominationBreakdown(amount: number): DenominationCount[] {
  let remaining = Math.max(0, Math.floor(amount));
  const breakdown: DenominationCount[] = [];
  for (const denom of DENOMINATIONS) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      breakdown.push({ denom, count });
      remaining -= denom * count;
    }
  }
  return breakdown;
}
