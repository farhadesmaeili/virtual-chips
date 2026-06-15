import { describe, expect, it } from 'vitest';
import {
  createPlayerInHand,
  type PlayerInHand,
} from '../entities/player-in-hand';
import type { Pot } from '../entities/pot';
import {
  calculateSidePots,
  calculateSidePotsForPlayers,
  type PotContribution,
} from './side-pot';

function contribution(
  seat: number,
  committed: number,
  folded = false,
): PotContribution {
  return { seat, committed, folded };
}

const totalAmount = (pots: readonly Pot[]): number =>
  pots.reduce((sum, p) => sum + p.amount, 0);

const totalCommitted = (cs: readonly PotContribution[]): number =>
  cs.reduce((sum, c) => sum + c.committed, 0);

describe('calculateSidePots — documented example (§4)', () => {
  // A=100 (seat 0), B=60 (seat 1), C=200 (seat 2), none folded.
  const cs = [contribution(0, 100), contribution(1, 60), contribution(2, 200)];

  it('produces main=180{0,1,2}, side1=80{0,2}, side2=100{2}', () => {
    expect(calculateSidePots(cs)).toEqual([
      { amount: 180, eligibleSeats: [0, 1, 2] },
      { amount: 80, eligibleSeats: [0, 2] },
      { amount: 100, eligibleSeats: [2] },
    ]);
  });

  it('conserves chips', () => {
    expect(totalAmount(calculateSidePots(cs))).toBe(totalCommitted(cs));
  });
});

describe('calculateSidePots — simple cases', () => {
  it('single pot when everyone commits the same (no all-in)', () => {
    const cs = [contribution(0, 50), contribution(1, 50), contribution(2, 50)];
    expect(calculateSidePots(cs)).toEqual([
      { amount: 150, eligibleSeats: [0, 1, 2] },
    ]);
  });

  it('uncontested: a single contributor gets one pot eligible only to them', () => {
    expect(calculateSidePots([contribution(3, 120)])).toEqual([
      { amount: 120, eligibleSeats: [3] },
    ]);
  });

  it('two equal all-ins plus a caller make a single layer (no spurious side pot)', () => {
    const cs = [
      contribution(0, 100),
      contribution(1, 100),
      contribution(2, 100),
    ];
    expect(calculateSidePots(cs)).toEqual([
      { amount: 300, eligibleSeats: [0, 1, 2] },
    ]);
  });

  it('returns no pots for empty input', () => {
    expect(calculateSidePots([])).toEqual([]);
  });

  it('ignores zero contributions', () => {
    expect(
      calculateSidePots([contribution(0, 0), contribution(1, 40)]),
    ).toEqual([{ amount: 40, eligibleSeats: [1] }]);
  });
});

describe('calculateSidePots — multiple simultaneous all-ins', () => {
  it('peels four distinct levels into layered pots', () => {
    // A=50, B=100, C=100, D=200 (seats 0..3), none folded.
    const cs = [
      contribution(0, 50),
      contribution(1, 100),
      contribution(2, 100),
      contribution(3, 200),
    ];
    const pots = calculateSidePots(cs);
    expect(pots).toEqual([
      { amount: 200, eligibleSeats: [0, 1, 2, 3] },
      { amount: 150, eligibleSeats: [1, 2, 3] },
      { amount: 100, eligibleSeats: [3] },
    ]);
    expect(totalAmount(pots)).toBe(totalCommitted(cs));
  });
});

describe('calculateSidePots — folded contributor', () => {
  it('keeps folded chips in the pot but excludes the seat from winning', () => {
    // A=100 (seat 0), B=60 folded (seat 1), C=200 (seat 2).
    const cs = [
      contribution(0, 100),
      contribution(1, 60, true),
      contribution(2, 200),
    ];
    const pots = calculateSidePots(cs);
    expect(pots).toEqual([
      { amount: 260, eligibleSeats: [0, 2] },
      { amount: 100, eligibleSeats: [2] },
    ]);
    // The folded seat's 60 chips are absorbed into the contested pot.
    expect(totalAmount(pots)).toBe(totalCommitted(cs));
    expect(pots.every((p) => !p.eligibleSeats.includes(1))).toBe(true);
  });

  it('handles a folded player whose chips fold into a multi-layer split', () => {
    // A=40 (0), B=100 folded (1), C=100 (2). Folded B funds layers 1 & 2.
    const cs = [
      contribution(0, 40),
      contribution(1, 100, true),
      contribution(2, 100),
    ];
    const pots = calculateSidePots(cs);
    // level 40: 40*3 = 120 eligible {0,2}; level 60 remaining for B(folded),C:
    // 60*2 = 120 eligible {2}.
    expect(pots).toEqual([
      { amount: 120, eligibleSeats: [0, 2] },
      { amount: 120, eligibleSeats: [2] },
    ]);
    expect(totalAmount(pots)).toBe(totalCommitted(cs));
  });
});

describe('calculateSidePots — purity', () => {
  it('does not mutate the input', () => {
    const cs = [contribution(0, 100), contribution(1, 60)];
    const snapshot = JSON.parse(JSON.stringify(cs));
    calculateSidePots(cs);
    expect(cs).toEqual(snapshot);
  });

  it('rejects negative contributions', () => {
    expect(() => calculateSidePots([contribution(0, -1)])).toThrow();
  });
});

describe('calculateSidePotsForPlayers', () => {
  function player(
    seat: number,
    committedTotal: number,
    state: PlayerInHand['state'],
  ): PlayerInHand {
    return {
      ...createPlayerInHand({ seat, userId: `u${seat}`, stack: 0 }),
      committedTotal,
      state,
    };
  }

  it('treats active and all-in as eligible, folded as not', () => {
    const players = [
      player(0, 100, 'active'),
      player(1, 60, 'folded'),
      player(2, 200, 'all_in'),
    ];
    expect(calculateSidePotsForPlayers(players)).toEqual([
      { amount: 260, eligibleSeats: [0, 2] },
      { amount: 100, eligibleSeats: [2] },
    ]);
  });

  it('excludes sitting-out players from eligibility', () => {
    const players = [player(0, 100, 'active'), player(1, 50, 'sitting_out')];
    const pots = calculateSidePotsForPlayers(players);
    expect(pots.every((p) => !p.eligibleSeats.includes(1))).toBe(true);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(150);
  });
});
