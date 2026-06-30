import { describe, expect, it } from 'vitest';
import { MAX_SEATS } from '@/domain/entities';
import { FundingCeilingError } from '../errors';
import {
  MAX_CHIP_AMOUNT,
  MAX_CHIP_TOTAL,
  validateBuyInRequest,
  validateFundingCeiling,
} from './buy-in';

describe('validateBuyInRequest', () => {
  const MIN = 100;
  const MAX = 1000;

  describe('first buy (currentChips === 0)', () => {
    it('rejects an amount below the minimum', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 50,
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
    });

    it('accepts an amount exactly at the minimum', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: MIN,
        }),
      ).toEqual({ ok: true });
    });

    it('accepts an amount above the minimum and within space', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 500,
        }),
      ).toEqual({ ok: true });
    });

    it('rejects an amount past the maximum (space)', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 1500,
        }),
      ).toEqual({ ok: false, reason: 'exceeds_space' });
    });
  });

  describe('top-up (currentChips > 0)', () => {
    it('ignores the minimum (a small top-up is allowed)', () => {
      expect(
        validateBuyInRequest({
          currentChips: 500,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 50, // below MIN, but min does not apply to top-ups
        }),
      ).toEqual({ ok: true });
    });

    it('accepts a top-up exactly filling the remaining space', () => {
      expect(
        validateBuyInRequest({
          currentChips: 500,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 500, // 1000 - 500
        }),
      ).toEqual({ ok: true });
    });

    it('rejects a top-up over the remaining space', () => {
      expect(
        validateBuyInRequest({
          currentChips: 500,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 600,
        }),
      ).toEqual({ ok: false, reason: 'exceeds_space' });
    });
  });

  describe('full stack (currentChips >= maxBuyIn)', () => {
    it('rejects when the stack is exactly at the maximum', () => {
      expect(
        validateBuyInRequest({
          currentChips: MAX,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 1,
        }),
      ).toEqual({ ok: false, reason: 'full' });
    });

    it('rejects when the stack is over the maximum (e.g. after a banker adjust)', () => {
      expect(
        validateBuyInRequest({
          currentChips: 1200,
          minBuyIn: MIN,
          maxBuyIn: MAX,
          amount: 1,
        }),
      ).toEqual({ ok: false, reason: 'full' });
    });
  });

  describe('maxBuyIn null (no maximum)', () => {
    it('accepts an arbitrarily large amount', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: null,
          amount: 5_000_000,
        }),
      ).toEqual({ ok: true });
    });

    it('still applies the minimum to a first buy', () => {
      expect(
        validateBuyInRequest({
          currentChips: 0,
          minBuyIn: MIN,
          maxBuyIn: null,
          amount: 50,
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
    });

    it('accepts a large top-up (min not applied)', () => {
      expect(
        validateBuyInRequest({
          currentChips: 500,
          minBuyIn: MIN,
          maxBuyIn: null,
          amount: 9_999_999,
        }),
      ).toEqual({ ok: true });
    });
  });
});

describe('validateFundingCeiling', () => {
  it('accepts when chips + amount lands exactly on the ceiling', () => {
    expect(() => validateFundingCeiling(0, 0, MAX_CHIP_TOTAL)).not.toThrow();
  });

  it('accepts when chips + amount is one below the ceiling', () => {
    expect(() =>
      validateFundingCeiling(0, 0, MAX_CHIP_TOTAL - 1),
    ).not.toThrow();
  });

  it('throws FundingCeilingError when chips + amount is one over the ceiling', () => {
    expect(() => validateFundingCeiling(0, 0, MAX_CHIP_TOTAL + 1)).toThrow(
      FundingCeilingError,
    );
  });

  it('throws when buyInTotal + amount exceeds the ceiling while chips stays under', () => {
    // chips + amount is far below the ceiling, but the accumulator would overflow.
    expect(() => validateFundingCeiling(0, MAX_CHIP_TOTAL, 1)).toThrow(
      FundingCeilingError,
    );
  });

  it('throws on a cumulative op whose amount is under the per-op cap but pushes the total over', () => {
    const currentBuyInTotal = MAX_CHIP_TOTAL - 100;
    const amount = 200; // well under any per-op cap, but 100 over once applied
    expect(() =>
      validateFundingCeiling(MAX_CHIP_TOTAL - 100, currentBuyInTotal, amount),
    ).toThrow(FundingCeilingError);
  });

  it('never throws for a negative amount (cash-out) near the ceiling', () => {
    expect(() =>
      validateFundingCeiling(MAX_CHIP_TOTAL, MAX_CHIP_TOTAL, -1),
    ).not.toThrow();
  });

  it('caps chips directly, independent of any table maximum', () => {
    // The helper takes no maxBuyIn: a room with no table cap is still bounded
    // because chips + amount is checked against MAX_CHIP_TOTAL outright.
    expect(() => validateFundingCeiling(MAX_CHIP_TOTAL, 0, 1)).toThrow(
      FundingCeilingError,
    );
  });

  it('allows a No-Max cumulative total far past the old 100M product cap', () => {
    // A "No maximum buy-in" table rebuys without limit. Walk the cumulative
    // buyInTotal well past MAX_CHIP_AMOUNT (100M) up to 1.38e9 — the product cap
    // never blocks the total; only MAX_CHIP_TOTAL does, and we stay under it.
    let buyInTotal = 0;
    const buys = [
      300_000_000, // already past the old 100M product cap on the first rebuy
      300_000_000,
      300_000_000,
      300_000_000,
      180_000_000,
    ];
    let chips = 0;
    for (const amount of buys) {
      expect(() =>
        validateFundingCeiling(chips, buyInTotal, amount),
      ).not.toThrow();
      chips += amount;
      buyInTotal += amount;
    }
    expect(buyInTotal).toBe(1_380_000_000);
    expect(buyInTotal).toBeGreaterThan(MAX_CHIP_AMOUNT);
  });
});

describe('precision-safety invariant', () => {
  // Codifies the headroom MAX_CHIP_TOTAL was chosen for: the worst-case
  // cross-seat aggregate (one per-member value summed over every seat) must
  // stay exact in the number-based domain. If a future ceiling bump breaks
  // this, the gate fails loudly here instead of silently losing precision.
  it('keeps MAX_SEATS * MAX_CHIP_TOTAL below Number.MAX_SAFE_INTEGER', () => {
    expect(MAX_SEATS * MAX_CHIP_TOTAL).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});
