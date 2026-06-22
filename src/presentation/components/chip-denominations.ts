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

/**
 * Chooses which discs the pot pile renders when the exact breakdown has more
 * discs than the display `cap`. So the capped view reflects the pot's true
 * composition rather than only its biggest chips:
 *
 *  1. reserve one disc per denomination present (every color the pot contains
 *     is guaranteed to show), and
 *  2. distribute the remaining slots by descending count (heavier tiers get more
 *     of their extra discs).
 *
 * Returns denominations in descending order (largest first, for stacking).
 * Length is `min(totalDiscs, cap)`; never exceeds the cap; never invents a
 * denomination absent from `breakdown`. Pure — `denominationBreakdown` stays
 * exact and untouched.
 */
export function selectPotDiscs(
  breakdown: readonly DenominationCount[],
  cap: number,
): Denomination[] {
  const totalDiscs = breakdown.reduce((sum, b) => sum + b.count, 0);

  // Everything fits — render every disc, descending.
  if (totalDiscs <= cap) {
    return breakdown.flatMap(({ denom, count }) =>
      Array.from({ length: count }, () => denom),
    );
  }

  // More distinct denominations than slots — keep the largest, one disc each.
  if (breakdown.length >= cap) {
    return breakdown.slice(0, cap).map((b) => b.denom);
  }

  // Reserve one disc per denomination, then fill the rest by descending count.
  const chosen = new Map<Denomination, number>(
    breakdown.map((b) => [b.denom, 1]),
  );
  let remaining = cap - breakdown.length;
  const byCount = [...breakdown].sort(
    (a, b) => b.count - a.count || b.denom - a.denom,
  );
  for (const { denom, count } of byCount) {
    if (remaining === 0) break;
    const take = Math.min(count - 1, remaining);
    chosen.set(denom, (chosen.get(denom) ?? 1) + take);
    remaining -= take;
  }

  // Rebuild in descending denomination order (breakdown is already descending).
  return breakdown.flatMap(({ denom }) =>
    Array.from({ length: chosen.get(denom) ?? 0 }, () => denom),
  );
}
