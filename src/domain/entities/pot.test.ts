import { describe, expect, it } from 'vitest';
import { addToPot, createPot, isEligible } from './pot';

describe('createPot', () => {
  it('defaults to an empty pot', () => {
    const pot = createPot();
    expect(pot.amount).toBe(0);
    expect(pot.eligibleSeats).toEqual([]);
  });

  it('copies the eligible seats (no shared reference)', () => {
    const seats = [1, 2, 3];
    const pot = createPot(100, seats);
    seats.push(4);
    expect(pot.eligibleSeats).toEqual([1, 2, 3]);
  });

  it('validates the amount', () => {
    expect(() => createPot(-1)).toThrow();
  });
});

describe('isEligible', () => {
  it('checks seat membership', () => {
    const pot = createPot(100, [1, 2]);
    expect(isEligible(pot, 1)).toBe(true);
    expect(isEligible(pot, 3)).toBe(false);
  });
});

describe('addToPot', () => {
  it('adds chips immutably', () => {
    const pot = createPot(100, [1, 2]);
    const bigger = addToPot(pot, 50);
    expect(bigger.amount).toBe(150);
    expect(pot.amount).toBe(100);
    expect(bigger.eligibleSeats).toEqual([1, 2]);
  });
});
