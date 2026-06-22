import { describe, expect, it } from 'vitest';
import {
  chipColor,
  denominationBreakdown,
  selectPotDiscs,
  topDenomination,
  type DenominationCount,
} from './chip-denominations';

describe('topDenomination', () => {
  it('rounds down to the largest denomination not exceeding the amount', () => {
    expect(topDenomination(0)).toBe(1);
    expect(topDenomination(3)).toBe(1);
    expect(topDenomination(5)).toBe(5);
    expect(topDenomination(24)).toBe(5);
    expect(topDenomination(25)).toBe(25);
    expect(topDenomination(99)).toBe(25);
    expect(topDenomination(100)).toBe(100);
    expect(topDenomination(499)).toBe(100);
    expect(topDenomination(500)).toBe(500);
    expect(topDenomination(1000)).toBe(1000);
    expect(topDenomination(7500)).toBe(1000);
  });
});

describe('chipColor', () => {
  it('maps a denomination to its CSS variable', () => {
    expect(chipColor(25)).toBe('var(--vc-chip-25)');
    expect(chipColor(1000)).toBe('var(--vc-chip-1000)');
  });
});

describe('denominationBreakdown', () => {
  it('represents an exact tier as a single denomination', () => {
    expect(denominationBreakdown(25)).toEqual([{ denom: 25, count: 1 }]);
    expect(denominationBreakdown(100)).toEqual([{ denom: 100, count: 1 }]);
    expect(denominationBreakdown(1000)).toEqual([{ denom: 1000, count: 1 }]);
  });

  it('decomposes a multi-tier amount, largest first', () => {
    expect(denominationBreakdown(175)).toEqual([
      { denom: 100, count: 1 },
      { denom: 25, count: 3 },
    ]);
    expect(denominationBreakdown(6)).toEqual([
      { denom: 5, count: 1 },
      { denom: 1, count: 1 },
    ]);
  });

  it('uses the smallest tier for an amount below the next denomination', () => {
    // 4 is below the 5 tier, so it is four 1-chips.
    expect(denominationBreakdown(4)).toEqual([{ denom: 1, count: 4 }]);
  });

  it('is empty for zero and for negatives', () => {
    expect(denominationBreakdown(0)).toEqual([]);
    expect(denominationBreakdown(-50)).toEqual([]);
  });

  it('decomposes a large amount across every tier it needs', () => {
    expect(denominationBreakdown(1234)).toEqual([
      { denom: 1000, count: 1 },
      { denom: 100, count: 2 },
      { denom: 25, count: 1 },
      { denom: 5, count: 1 },
      { denom: 1, count: 4 },
    ]);
  });

  it('is in strictly descending denomination order', () => {
    const denoms = denominationBreakdown(1989).map((d) => d.denom);
    for (let i = 1; i < denoms.length; i += 1) {
      expect(denoms[i - 1]).toBeGreaterThan(denoms[i] ?? 0);
    }
  });

  it('is total-preserving: sum of denom*count equals the (floored) amount', () => {
    for (const amount of [0, 1, 4, 6, 25, 175, 999, 1234, 53_217]) {
      const sum = denominationBreakdown(amount).reduce(
        (acc, { denom, count }) => acc + denom * count,
        0,
      );
      expect(sum).toBe(amount);
    }
  });
});

describe('selectPotDiscs', () => {
  const isDescending = (denoms: readonly number[]): boolean =>
    denoms.every((d, i) => i === 0 || (denoms[i - 1] ?? 0) >= d);

  it('shows every disc when the pot fits within the cap', () => {
    // 175 → [100×1, 25×3] = 4 discs ≤ cap, unchanged.
    expect(selectPotDiscs(denominationBreakdown(175), 12)).toEqual([
      100, 25, 25, 25,
    ]);
  });

  it('reflects the full composition for a large pot (the 999 case)', () => {
    // 999 → [100×9, 25×3, 5×4, 1×4] = 20 discs > cap 12.
    const discs = selectPotDiscs(denominationBreakdown(999), 12);
    expect(discs).toHaveLength(12);
    // Every denomination present in the pot shows at least once.
    for (const denom of [100, 25, 5, 1]) {
      expect(discs).toContain(denom);
    }
    expect(isDescending(discs)).toBe(true);
  });

  it('sends the remaining slots to the higher counts', () => {
    // Few distinct denominations, huge top count: 100 keeps its extras, 5 still
    // shows once (reserved).
    const breakdown: DenominationCount[] = [
      { denom: 100, count: 20 },
      { denom: 5, count: 1 },
    ];
    const discs = selectPotDiscs(breakdown, 12);
    expect(discs).toHaveLength(12);
    expect(discs.filter((d) => d === 100)).toHaveLength(11);
    expect(discs.filter((d) => d === 5)).toHaveLength(1);
  });

  it('keeps one disc per denomination when distinct === cap', () => {
    const breakdown: DenominationCount[] = [
      { denom: 1000, count: 2 },
      { denom: 500, count: 1 },
      { denom: 100, count: 1 },
      { denom: 25, count: 1 },
    ];
    // 5 discs > cap 4, and 4 distinct denoms === cap → one each, largest first.
    expect(selectPotDiscs(breakdown, 4)).toEqual([1000, 500, 100, 25]);
  });

  it('keeps the largest denominations when distinct > cap', () => {
    const breakdown: DenominationCount[] = [
      { denom: 1000, count: 1 },
      { denom: 500, count: 1 },
      { denom: 100, count: 1 },
      { denom: 25, count: 1 },
    ];
    const discs = selectPotDiscs(breakdown, 3);
    expect(discs).toEqual([1000, 500, 100]);
  });

  it('never exceeds the cap and never invents an absent denomination', () => {
    const cases: { amount: number; cap: number }[] = [
      { amount: 999, cap: 12 },
      { amount: 53_217, cap: 12 },
      { amount: 6, cap: 2 },
      { amount: 1234, cap: 5 },
    ];
    for (const { amount, cap } of cases) {
      const breakdown = denominationBreakdown(amount);
      const present = new Set(breakdown.map((b) => b.denom));
      const discs = selectPotDiscs(breakdown, cap);
      expect(discs.length).toBeLessThanOrEqual(cap);
      expect(isDescending(discs)).toBe(true);
      for (const denom of discs) expect(present.has(denom)).toBe(true);
    }
  });
});
