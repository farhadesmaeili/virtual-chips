import { describe, expect, it } from 'vitest';
import { firstButtonSeat, nextButtonSeat } from './button';

describe('firstButtonSeat', () => {
  it('is the lowest occupied seat', () => {
    expect(firstButtonSeat([2, 0, 5])).toBe(0);
    expect(firstButtonSeat([3])).toBe(3);
  });

  it('throws when no seats are occupied', () => {
    expect(() => firstButtonSeat([])).toThrow();
  });
});

describe('nextButtonSeat', () => {
  it('moves clockwise to the next occupied seat', () => {
    expect(nextButtonSeat([0, 1, 2], 0)).toBe(1);
    expect(nextButtonSeat([0, 1, 2], 1)).toBe(2);
  });

  it('wraps from the highest seat back to the lowest', () => {
    expect(nextButtonSeat([0, 1, 2], 2)).toBe(0);
  });

  it('rotates by seat position even if the old button player has left', () => {
    // Seat 1 left; the button still moves to the next seat past position 1.
    expect(nextButtonSeat([0, 2, 3], 1)).toBe(2);
    // The previous (highest) button player left → wrap to the lowest.
    expect(nextButtonSeat([0, 2, 3], 4)).toBe(0);
  });

  it('alternates the button heads-up', () => {
    expect(nextButtonSeat([0, 1], 0)).toBe(1);
    expect(nextButtonSeat([0, 1], 1)).toBe(0);
  });

  it('handles unsorted and duplicate seat input', () => {
    expect(nextButtonSeat([5, 0, 2, 0], 0)).toBe(2);
    expect(nextButtonSeat([5, 0, 2], 5)).toBe(0);
  });

  it('throws when no seats are occupied', () => {
    expect(() => nextButtonSeat([], 0)).toThrow();
  });
});
