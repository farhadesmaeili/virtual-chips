import { describe, expect, it } from 'vitest';
import {
  defaultMaxBuyIn,
  defaultMinBuyIn,
  isBuyInValid,
  recomputeBuyInPrefill,
} from './buy-in-defaults';

describe('defaultMinBuyIn / defaultMaxBuyIn', () => {
  it('derives 10x/20x of the big blind', () => {
    expect(defaultMinBuyIn(2)).toBe(20);
    expect(defaultMaxBuyIn(2)).toBe(40);
    expect(defaultMinBuyIn(20)).toBe(200);
    expect(defaultMaxBuyIn(20)).toBe(400);
  });
});

describe('recomputeBuyInPrefill', () => {
  it('recomputes both fields from BB when neither is dirty', () => {
    expect(
      recomputeBuyInPrefill({
        bigBlind: 20,
        minDirty: false,
        maxDirty: false,
        currentMin: '20',
        currentMax: '40',
      }),
    ).toEqual({ min: '200', max: '400' });
  });

  it('preserves min and recomputes max when only min is dirty', () => {
    expect(
      recomputeBuyInPrefill({
        bigBlind: 20,
        minDirty: true,
        maxDirty: false,
        currentMin: '150',
        currentMax: '40',
      }),
    ).toEqual({ min: '150', max: '400' });
  });

  it('preserves max and recomputes min when only max is dirty', () => {
    expect(
      recomputeBuyInPrefill({
        bigBlind: 20,
        minDirty: false,
        maxDirty: true,
        currentMin: '20',
        currentMax: '999',
      }),
    ).toEqual({ min: '200', max: '999' });
  });

  it('preserves both fields when both are dirty', () => {
    expect(
      recomputeBuyInPrefill({
        bigBlind: 20,
        minDirty: true,
        maxDirty: true,
        currentMin: '150',
        currentMax: '999',
      }),
    ).toEqual({ min: '150', max: '999' });
  });

  it('returns current values unchanged for a NaN / 0 / negative / non-integer big blind', () => {
    const current = { currentMin: '20', currentMax: '40' };
    const flags = { minDirty: false, maxDirty: false };
    for (const bigBlind of [Number.NaN, 0, -5, 1.5]) {
      expect(recomputeBuyInPrefill({ bigBlind, ...flags, ...current })).toEqual(
        { min: '20', max: '40' },
      );
    }
  });
});

describe('isBuyInValid', () => {
  it('accepts an integer min with a max >= min when maxed', () => {
    expect(isBuyInValid({ min: '200', max: '400', noMax: false })).toBe(true);
  });

  it('rejects a non-positive, non-integer, or empty min', () => {
    expect(isBuyInValid({ min: '0', max: '400', noMax: false })).toBe(false);
    expect(isBuyInValid({ min: '-5', max: '400', noMax: false })).toBe(false);
    expect(isBuyInValid({ min: '1.5', max: '400', noMax: false })).toBe(false);
    expect(isBuyInValid({ min: '', max: '400', noMax: false })).toBe(false);
  });

  it('rejects a max below the min, or an empty max, when not no-max', () => {
    expect(isBuyInValid({ min: '400', max: '200', noMax: false })).toBe(false);
    expect(isBuyInValid({ min: '200', max: '', noMax: false })).toBe(false);
  });

  it('ignores the max (even empty) when no-max is on, given a valid min', () => {
    expect(isBuyInValid({ min: '200', max: '', noMax: true })).toBe(true);
    expect(isBuyInValid({ min: '200', max: '50', noMax: true })).toBe(true);
  });
});
