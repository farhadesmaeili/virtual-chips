import { describe, expect, it } from 'vitest';
import { MAX_SEATS, seatSlots } from './seat-layout';

describe('seatSlots', () => {
  it('returns one slot per seat up to capacity', () => {
    expect(seatSlots(6)).toHaveLength(6);
    expect(seatSlots(9)).toHaveLength(9);
  });

  it('clamps capacity to [1, MAX_SEATS]', () => {
    expect(seatSlots(0)).toHaveLength(1);
    expect(seatSlots(-3)).toHaveLength(1);
    expect(seatSlots(20)).toHaveLength(MAX_SEATS);
  });

  it('places seat 0 at the bottom center (the hero seat)', () => {
    const hero = seatSlots(9)[0];
    expect(hero).toBeDefined();
    expect(hero?.seat).toBe(0);
    expect(hero?.xPct).toBeCloseTo(50, 1);
    expect(hero?.yPct ?? 0).toBeGreaterThan(80); // toward the bottom edge
  });

  it('keeps every seat inside the table box', () => {
    for (const slot of seatSlots(MAX_SEATS)) {
      expect(slot.xPct).toBeGreaterThanOrEqual(0);
      expect(slot.xPct).toBeLessThanOrEqual(100);
      expect(slot.yPct).toBeGreaterThanOrEqual(0);
      expect(slot.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('numbers seats 0..capacity-1 in order', () => {
    expect(seatSlots(5).map((s) => s.seat)).toEqual([0, 1, 2, 3, 4]);
  });

  it('gives a unit vector pointing from the seat toward the table center', () => {
    for (const slot of seatSlots(MAX_SEATS)) {
      const { x, y } = slot.towardCenter;
      expect(Math.hypot(x, y)).toBeCloseTo(1, 2);
      // The hero at the bottom should point upward (negative y) to the center.
      if (slot.seat === 0) expect(y).toBeLessThan(0);
    }
  });

  it('places two seats on opposite sides', () => {
    const [a, b] = seatSlots(2);
    expect(a?.yPct ?? 0).toBeGreaterThan(50); // bottom
    expect(b?.yPct ?? 100).toBeLessThan(50); // top
  });
});
