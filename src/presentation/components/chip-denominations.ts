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
