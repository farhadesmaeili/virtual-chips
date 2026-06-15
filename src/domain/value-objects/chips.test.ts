import { describe, expect, it } from 'vitest';
import { InsufficientChipsError, InvalidChipsAmountError } from '../errors';
import { Chips } from './chips';

describe('Chips.of', () => {
  it('creates a valid non-negative integer amount', () => {
    expect(Chips.of(100).value).toBe(100);
    expect(Chips.of(0).value).toBe(0);
  });

  it('rejects negative amounts', () => {
    expect(() => Chips.of(-1)).toThrow(InvalidChipsAmountError);
  });

  it('rejects non-integer amounts', () => {
    expect(() => Chips.of(1.5)).toThrow(InvalidChipsAmountError);
    expect(() => Chips.of(Number.NaN)).toThrow(InvalidChipsAmountError);
  });
});

describe('Chips arithmetic', () => {
  it('adds amounts', () => {
    expect(Chips.of(40).add(Chips.of(60)).value).toBe(100);
  });

  it('subtracts amounts', () => {
    expect(Chips.of(100).subtract(Chips.of(60)).value).toBe(40);
  });

  it('allows subtracting down to exactly zero', () => {
    expect(Chips.of(50).subtract(Chips.of(50)).isZero()).toBe(true);
  });

  it('throws when subtraction would go negative', () => {
    expect(() => Chips.of(30).subtract(Chips.of(31))).toThrow(
      InsufficientChipsError,
    );
  });

  it('does not mutate operands', () => {
    const a = Chips.of(100);
    const b = Chips.of(60);
    a.add(b);
    a.subtract(b);
    expect(a.value).toBe(100);
    expect(b.value).toBe(60);
  });
});

describe('Chips comparisons and helpers', () => {
  it('compares amounts', () => {
    expect(Chips.of(10).gt(Chips.of(5))).toBe(true);
    expect(Chips.of(10).gte(Chips.of(10))).toBe(true);
    expect(Chips.of(4).lt(Chips.of(5))).toBe(true);
    expect(Chips.of(7).equals(Chips.of(7))).toBe(true);
  });

  it('zero() is zero', () => {
    expect(Chips.zero().isZero()).toBe(true);
  });

  it('min() returns the smaller amount', () => {
    expect(Chips.min(Chips.of(60), Chips.of(100)).value).toBe(60);
    expect(Chips.min(Chips.of(100), Chips.of(60)).value).toBe(60);
  });
});
