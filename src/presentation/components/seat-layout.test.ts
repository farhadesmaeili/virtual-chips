import { describe, expect, it } from 'vitest';
import {
  BET_CHIP_OFFSET_PX,
  CHIP_ANCHOR_INSET_PCT,
  MAX_SEATS,
  TABLE_CENTER,
  seatBetChipOffset,
  seatChipAnchor,
  seatSlots,
  type SeatSlot,
} from './seat-layout';

/** Euclidean distance between two overlay-% points. */
function dist(
  a: { xPct: number; yPct: number },
  b: { xPct: number; yPct: number },
): number {
  return Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
}

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

describe('seatChipAnchor', () => {
  const slotsBySeat = new Map(seatSlots(MAX_SEATS).map((s) => [s.seat, s]));

  it('matches the slot center nudged along towardCenter by the inset', () => {
    for (const seat of [0, 3, 4, 2, 7]) {
      const slot = slotsBySeat.get(seat)!;
      const anchor = seatChipAnchor(seat);
      expect(anchor.xPct).toBeCloseTo(
        slot.xPct + slot.towardCenter.x * CHIP_ANCHOR_INSET_PCT,
        6,
      );
      expect(anchor.yPct).toBeCloseTo(
        slot.yPct + slot.towardCenter.y * CHIP_ANCHOR_INSET_PCT,
        6,
      );
    }
  });

  it('lies strictly between the seat and the table center (closer to center)', () => {
    // The table is an oval (RADIUS_X ≠ RADIUS_Y), so towardCenter is not exactly
    // the radial direction; moving along it still strictly reduces the distance
    // to center, but by slightly less than the raw inset — so assert "closer",
    // not an exact delta.
    for (const seat of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const slot = slotsBySeat.get(seat)!;
      const anchor = seatChipAnchor(seat);
      expect(dist(anchor, TABLE_CENTER)).toBeLessThan(dist(slot, TABLE_CENTER));
    }
  });

  it('flips the offset sign with the seat quadrant (the regression)', () => {
    // Bottom seat: chips move UP toward the center.
    const bottom = slotsBySeat.get(0)!;
    expect(seatChipAnchor(0).yPct).toBeLessThan(bottom.yPct);

    // Top-half seats: chips move DOWN toward the center (this is what broke —
    // reveal chips used to land on the nameplate above the proper slot).
    for (const seat of [3, 4]) {
      const top = slotsBySeat.get(seat)!;
      expect(seatChipAnchor(seat).yPct).toBeGreaterThan(top.yPct);
    }

    // Left-side seat: chips move RIGHT toward the center.
    const left = slotsBySeat.get(2)!;
    expect(seatChipAnchor(2).xPct).toBeGreaterThan(left.xPct);

    // Right-side seat: chips move LEFT toward the center.
    const right = slotsBySeat.get(7)!;
    expect(seatChipAnchor(7).xPct).toBeLessThan(right.xPct);
  });

  it('falls back to the table center for an unknown seat', () => {
    expect(seatChipAnchor(999)).toEqual(TABLE_CENTER);
    expect(seatChipAnchor(-1)).toEqual(TABLE_CENTER);
  });
});

describe('seatBetChipOffset', () => {
  const slots = seatSlots(MAX_SEATS);
  // Representative seats derived from geometry (y grows downward), not hardcoded
  // indices: bottom = largest yPct, top = smallest yPct, left/right = the x rails.
  const bottom = slots.reduce((a, b) => (b.yPct > a.yPct ? b : a));
  const top = slots.reduce((a, b) => (b.yPct < a.yPct ? b : a));
  const left = slots.reduce((a, b) => (b.xPct < a.xPct ? b : a));
  const right = slots.reduce((a, b) => (b.xPct > a.xPct ? b : a));

  it('is a positive scalar multiple of the seat towardCenter (points to center)', () => {
    for (const slot of slots) {
      const off = seatBetChipOffset(slot);
      expect(off.x).toBeCloseTo(slot.towardCenter.x * BET_CHIP_OFFSET_PX, 6);
      expect(off.y).toBeCloseTo(slot.towardCenter.y * BET_CHIP_OFFSET_PX, 6);
    }
  });

  it('nudges in the correct direction per quadrant', () => {
    expect(seatBetChipOffset(bottom).y).toBeLessThan(0); // bottom seat: chips move up
    expect(seatBetChipOffset(top).y).toBeGreaterThan(0); // top seat: chips move down
    expect(seatBetChipOffset(left).x).toBeGreaterThan(0); // left rail: chips move right
    expect(seatBetChipOffset(right).x).toBeLessThan(0); // right rail: chips move left
  });

  it('has magnitude equal to BET_CHIP_OFFSET_PX (towardCenter is a unit vector)', () => {
    for (const slot of slots) {
      const off = seatBetChipOffset(slot);
      expect(Math.hypot(off.x, off.y)).toBeCloseTo(BET_CHIP_OFFSET_PX, 4);
    }
  });

  it('mirrors x for the two horizontally-mirrored rail seats', () => {
    expect(seatBetChipOffset(left).x).toBeCloseTo(
      -seatBetChipOffset(right).x,
      4,
    );
  });

  it('returns no offset for a degenerate (zero) towardCenter', () => {
    const degenerate: SeatSlot = {
      seat: 99,
      xPct: 50,
      yPct: 50,
      towardCenter: { x: 0, y: 0 },
    };
    expect(seatBetChipOffset(degenerate)).toEqual({ x: 0, y: 0 });
  });
});
