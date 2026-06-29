import { describe, expect, it } from 'vitest';
import { validateBuyInRequest } from './buy-in';

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
