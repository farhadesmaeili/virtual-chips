import { describe, expect, it } from 'vitest';
import type {
  ActionApplied,
  AppliedActionType,
  HandSettled,
} from '@/presentation/lib/socket-events';
import {
  TABLE_CENTER,
  commitsChips,
  flightsFor,
  planChipMotion,
  seatPoint,
  type ChipMotion,
} from './chip-motion';

function action(
  act: AppliedActionType,
  seat = 2,
  amount: number | null = null,
): ActionApplied {
  return { seat, action: act, amount };
}

function settled(seats: number[]): HandSettled {
  return { payouts: seats.map((seat) => ({ seat, amount: 100 })) };
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
  it('flies a committing live action to the pot', () => {
    expect(
      planChipMotion({ type: 'action', event: action('RAISE', 5) }),
    ).toEqual({
      kind: 'to-pot',
      fromSeat: 5,
    });
  });

  it('animates call and all-in (amount may be null) too', () => {
    expect(
      planChipMotion({ type: 'action', event: action('CALL', 1) }),
    ).toEqual({
      kind: 'to-pot',
      fromSeat: 1,
    });
    expect(
      planChipMotion({ type: 'action', event: action('ALL_IN', 3) }),
    ).toEqual({ kind: 'to-pot', fromSeat: 3 });
  });

  it('does not animate fold or check (no chips committed)', () => {
    expect(
      planChipMotion({ type: 'action', event: action('FOLD') }),
    ).toBeNull();
    expect(
      planChipMotion({ type: 'action', event: action('CHECK') }),
    ).toBeNull();
  });

  it('flies the pot to a single winner', () => {
    expect(planChipMotion({ type: 'settled', event: settled([4]) })).toEqual({
      kind: 'to-winners',
      toSeats: [4],
    });
  });

  it('fans the pot to every winner on a split', () => {
    expect(planChipMotion({ type: 'settled', event: settled([2, 6]) })).toEqual(
      { kind: 'to-winners', toSeats: [2, 6] },
    );
  });

  it('does not animate an empty settlement', () => {
    expect(planChipMotion({ type: 'settled', event: settled([]) })).toBeNull();
  });

  it('never animates a snapshot/hydration (no ghost chips on resync)', () => {
    expect(planChipMotion({ type: 'snapshot' })).toBeNull();
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
  it('makes one seat→center flight for a commit', () => {
    const specs = flightsFor({ kind: 'to-pot', fromSeat: 0 });
    expect(specs).toHaveLength(1);
    expect(specs[0]?.from).toEqual(seatPoint(0));
    expect(specs[0]?.to).toEqual(TABLE_CENTER);
  });

  it('makes one center→seat flight per winner', () => {
    const motion: ChipMotion = { kind: 'to-winners', toSeats: [1, 3] };
    const specs = flightsFor(motion);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toEqual({ from: TABLE_CENTER, to: seatPoint(1) });
    expect(specs[1]).toEqual({ from: TABLE_CENTER, to: seatPoint(3) });
  });
});
