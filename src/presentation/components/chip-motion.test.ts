import { describe, expect, it } from 'vitest';
import type {
  ActionApplied,
  AppliedActionType,
  HandSettled,
} from '@/presentation/lib/socket-events';
import { chipColor, topDenomination } from './chip-denominations';
import {
  TABLE_CENTER,
  chipTint,
  commitsChips,
  flightsFor,
  planChipMotion,
  seatPoint,
  type ChipMotion,
} from './chip-motion';
import { seatChipAnchor } from './seat-layout';

function action(
  act: AppliedActionType,
  seat = 2,
  amount: number | null = null,
): ActionApplied {
  return { seat, action: act, amount };
}

function settled(awards: { seat: number; amount: number }[]): HandSettled {
  return { payouts: awards };
}

describe('commitsChips', () => {
  it('is true for chip-committing actions', () => {
    for (const a of ['CALL', 'BET', 'RAISE', 'ALL_IN'] as const) {
      expect(commitsChips(a)).toBe(true);
    }
  });

  it('is false for fold and check', () => {
    expect(commitsChips('FOLD')).toBe(false);
    expect(commitsChips('CHECK')).toBe(false);
  });
});

describe('planChipMotion — live vs hydration', () => {
  it('flies a committing live action to the pot, carrying its amount', () => {
    expect(
      planChipMotion({ type: 'action', event: action('RAISE', 5, 500) }),
    ).toEqual({ kind: 'to-pot', fromSeat: 5, amount: 500 });
  });

  it('animates call and all-in (amount may be null) too', () => {
    expect(
      planChipMotion({ type: 'action', event: action('CALL', 1) }),
    ).toEqual({ kind: 'to-pot', fromSeat: 1, amount: null });
    expect(
      planChipMotion({ type: 'action', event: action('ALL_IN', 3) }),
    ).toEqual({ kind: 'to-pot', fromSeat: 3, amount: null });
  });

  it('does not animate fold or check (no chips committed)', () => {
    expect(
      planChipMotion({ type: 'action', event: action('FOLD') }),
    ).toBeNull();
    expect(
      planChipMotion({ type: 'action', event: action('CHECK') }),
    ).toBeNull();
  });

  it('flies the pot to a single winner with its amount', () => {
    expect(
      planChipMotion({
        type: 'settled',
        event: settled([{ seat: 4, amount: 300 }]),
      }),
    ).toEqual({ kind: 'to-winners', awards: [{ seat: 4, amount: 300 }] });
  });

  it('fans the pot to every winner on a split', () => {
    expect(
      planChipMotion({
        type: 'settled',
        event: settled([
          { seat: 2, amount: 50 },
          { seat: 6, amount: 50 },
        ]),
      }),
    ).toEqual({
      kind: 'to-winners',
      awards: [
        { seat: 2, amount: 50 },
        { seat: 6, amount: 50 },
      ],
    });
  });

  it('does not animate an empty settlement', () => {
    expect(planChipMotion({ type: 'settled', event: settled([]) })).toBeNull();
  });

  it('never animates a snapshot/hydration (no ghost chips on resync)', () => {
    expect(planChipMotion({ type: 'snapshot' })).toBeNull();
  });
});

describe('chipTint', () => {
  it('derives color from the amount via the denomination source', () => {
    expect(chipTint(1000)).toBe(chipColor(topDenomination(1000)));
    expect(chipTint(25)).toBe(chipColor(topDenomination(25)));
    // Different denominations yield different colors (not always one tint).
    expect(chipTint(25)).not.toBe(chipTint(1000));
  });
});

describe('seatPoint', () => {
  it('returns the seat-ring center for the hero seat (0) at the bottom', () => {
    const p = seatPoint(0);
    expect(p.xPct).toBeCloseTo(50, 1);
    expect(p.yPct).toBeGreaterThan(80);
  });

  it('falls back to the table center for an unknown seat', () => {
    expect(seatPoint(999)).toEqual(TABLE_CENTER);
  });
});

describe('flightsFor', () => {
  it('makes one slot→center flight for a commit, tinted by its amount', () => {
    const specs = flightsFor({ kind: 'to-pot', fromSeat: 0, amount: 500 }, 0);
    expect(specs).toHaveLength(1);
    // Lifts from the in-front chip slot, not the bare seat center.
    expect(specs[0]?.from).toEqual(seatChipAnchor(0));
    expect(specs[0]?.to).toEqual(TABLE_CENTER);
    expect(specs[0]?.color).toBe(chipTint(500));
  });

  it('tints a null-amount commit (call/all-in) by the pot fallback', () => {
    const specs = flightsFor(
      { kind: 'to-pot', fromSeat: 0, amount: null },
      1000,
    );
    expect(specs[0]?.color).toBe(chipTint(1000));
  });

  it('makes one center→slot flight per winner, tinted by each award', () => {
    const motion: ChipMotion = {
      kind: 'to-winners',
      awards: [
        { seat: 1, amount: 25 },
        { seat: 3, amount: 1000 },
      ],
    };
    const specs = flightsFor(motion, 0);
    expect(specs).toHaveLength(2);
    // Lands on the in-front chip slot of each winner, not the bare seat center.
    expect(specs[0]).toEqual({
      from: TABLE_CENTER,
      to: seatChipAnchor(1),
      color: chipTint(25),
    });
    expect(specs[1]).toEqual({
      from: TABLE_CENTER,
      to: seatChipAnchor(3),
      color: chipTint(1000),
    });
  });
});
