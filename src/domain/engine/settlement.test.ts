import { describe, expect, it } from 'vitest';
import { createHand, type Hand } from '../entities/hand';
import {
  createPlayerInHand,
  type PlayerInHand,
} from '../entities/player-in-hand';
import { createPot } from '../entities/pot';
import { InvalidSettlementError } from '../errors';
import {
  computeNetSettlement,
  distributePot,
  orderLeftOfButton,
  settleHand,
  type PlayerLedger,
} from './settlement';

interface PlayerOpts {
  seat: number;
  stack?: number;
  committedTotal?: number;
  state?: PlayerInHand['state'];
}

function mkPlayer(o: PlayerOpts): PlayerInHand {
  return {
    ...createPlayerInHand({
      seat: o.seat,
      userId: `u${o.seat}`,
      stack: o.stack ?? 0,
    }),
    committedTotal: o.committedTotal ?? 0,
    state: o.state ?? 'all_in',
  };
}

function mkHand(players: PlayerInHand[], overrides: Partial<Hand> = {}): Hand {
  return {
    ...createHand({ id: 'h1', roomId: 'r1', buttonSeat: 0, players }),
    status: 'awaiting_showdown',
    ...overrides,
  };
}

describe('orderLeftOfButton', () => {
  it('orders clockwise starting left of the button (button seat last)', () => {
    expect(orderLeftOfButton([0, 1, 2, 3], 1)).toEqual([2, 3, 0, 1]);
  });

  it('puts the button seat last', () => {
    expect(orderLeftOfButton([0, 2], 2)).toEqual([0, 2]);
  });
});

describe('distributePot', () => {
  const pot = createPot(100, [0, 1, 2]);

  it('splits evenly between winners', () => {
    expect(distributePot(pot, [0, 2], 0)).toEqual(
      new Map([
        [2, 50],
        [0, 50],
      ]),
    );
  });

  it('gives the odd chip to the winner nearest left of the button', () => {
    // button 2 → clockwise winners order [0, 1]; seat 0 gets the extra chip.
    const result = distributePot(createPot(101, [0, 1, 2]), [0, 1], 2);
    expect(result.get(0)).toBe(51);
    expect(result.get(1)).toBe(50);
  });

  it('distributes multiple odd chips left-of-button first', () => {
    // 100 / 3 = 33 r1; button 0 → order [1, 2, 0]; seat 1 gets the extra.
    const result = distributePot(createPot(100, [0, 1, 2]), [0, 1, 2], 0);
    expect(result.get(1)).toBe(34);
    expect(result.get(2)).toBe(33);
    expect(result.get(0)).toBe(33);
    expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('awards the whole pot to a single winner', () => {
    expect(distributePot(pot, [1], 0)).toEqual(new Map([[1, 100]]));
  });

  it('rejects an empty winner list', () => {
    expect(() => distributePot(pot, [], 0)).toThrow(InvalidSettlementError);
  });

  it('rejects a winner that is not eligible', () => {
    expect(() => distributePot(pot, [5], 0)).toThrow(InvalidSettlementError);
  });

  it('rejects duplicate winners', () => {
    expect(() => distributePot(pot, [1, 1], 0)).toThrow(InvalidSettlementError);
  });
});

describe('settleHand — uncontested', () => {
  it('auto-awards the whole hand to the lone contender, no declaration', () => {
    // seats 1 and 2 folded; seat 0 is the only contender.
    const hand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 30, state: 'active', stack: 70 }),
      mkPlayer({ seat: 1, committedTotal: 20, state: 'folded' }),
      mkPlayer({ seat: 2, committedTotal: 10, state: 'folded' }),
    ]);
    const { hand: settled, payouts } = settleHand(hand);
    expect(settled.status).toBe('settled');
    expect(payouts.get(0)).toBe(60); // 30 + 20 + 10
    expect(settled.players.find((p) => p.seat === 0)!.stack).toBe(70 + 60);
  });
});

describe('settleHand — banker-declared, multiple pots', () => {
  // The §4 example: A=100 (0), B=60 (1), C=200 (2), all all-in.
  // pots: main 180 {0,1,2}, side1 80 {0,2}, side2 100 {2}.
  const hand = (): Hand =>
    mkHand([
      mkPlayer({ seat: 0, committedTotal: 100, stack: 0 }),
      mkPlayer({ seat: 1, committedTotal: 60, stack: 0 }),
      mkPlayer({ seat: 2, committedTotal: 200, stack: 0 }),
    ]);

  it('awards each pot to the declared winner; side2 is uncontested', () => {
    // main → seat 1, side1 → seat 0, side2 → auto (only seat 2 eligible).
    const { payouts, pots } = settleHand(hand(), [[1], [0]]);
    expect(payouts.get(1)).toBe(180);
    expect(payouts.get(0)).toBe(80);
    expect(payouts.get(2)).toBe(100);
    // chips conserved
    const totalPaid = [...payouts.values()].reduce((a, b) => a + b, 0);
    const totalPots = pots.reduce((a, p) => a + p.amount, 0);
    expect(totalPaid).toBe(totalPots);
    expect(totalPaid).toBe(360);
  });

  it('credits the winnings to the players stacks', () => {
    const { hand: settled } = settleHand(hand(), [[1], [0]]);
    expect(settled.players.find((p) => p.seat === 0)!.stack).toBe(80);
    expect(settled.players.find((p) => p.seat === 1)!.stack).toBe(180);
    expect(settled.players.find((p) => p.seat === 2)!.stack).toBe(100);
  });

  it('supports splitting a pot between several declared winners', () => {
    // Single 100 pot, three equal contenders, banker splits between 0 and 1.
    const splitHand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 40 }),
      mkPlayer({ seat: 1, committedTotal: 40 }),
      mkPlayer({ seat: 2, committedTotal: 40 }),
    ]);
    const { payouts } = settleHand(splitHand, [[0, 1]]);
    expect(payouts.get(0)).toBe(60);
    expect(payouts.get(1)).toBe(60);
    expect(payouts.has(2)).toBe(false);
  });

  it('throws when a contested pot has no declaration', () => {
    expect(() => settleHand(hand(), [])).toThrow(InvalidSettlementError);
  });

  it('throws when the hand is not awaiting showdown', () => {
    expect(() =>
      settleHand(mkHand([mkPlayer({ seat: 0 })], { status: 'betting' })),
    ).toThrow(InvalidSettlementError);
  });
});

describe('settleHand — one-player-capped all-in run-out', () => {
  it('settles the capped run-out money-correctly and zero-sum', () => {
    // Heads-up: seat 0 started 1000 and has 200 behind (committed 800); seat 1
    // started 800 and is all-in (committed 800). Both committed equally, so it
    // is a single 1600 pot eligible to both; the banker awards seat 0.
    const hand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 800, state: 'active', stack: 200 }),
      mkPlayer({ seat: 1, committedTotal: 800, state: 'all_in', stack: 0 }),
    ]);
    const { hand: settled, payouts, pots } = settleHand(hand, [[0]]);

    expect(pots).toHaveLength(1);
    expect(payouts.get(0)).toBe(1600);
    expect(payouts.has(1)).toBe(false);
    // Winner's stack: 200 behind + 1600 pot.
    expect(settled.players.find((p) => p.seat === 0)!.stack).toBe(1800);
    expect(settled.players.find((p) => p.seat === 1)!.stack).toBe(0);

    // Zero-sum against buy-ins (seat 0 bought 1000, seat 1 bought 800).
    const { nets } = computeNetSettlement([
      { seat: 0, currentChips: 1800, totalBuyIn: 1000 },
      { seat: 1, currentChips: 0, totalBuyIn: 800 },
    ]);
    expect(nets).toEqual([
      { seat: 0, net: 800 },
      { seat: 1, net: -800 },
    ]);
    expect(nets.reduce((a, n) => a + n.net, 0)).toBe(0);
  });
});

describe('computeNetSettlement', () => {
  const ledgers: PlayerLedger[] = [
    { seat: 0, currentChips: 150, totalBuyIn: 100 },
    { seat: 1, currentChips: 50, totalBuyIn: 100 },
    { seat: 2, currentChips: 100, totalBuyIn: 100 },
  ];

  it('computes net = currentChips - totalBuyIn', () => {
    const { nets } = computeNetSettlement(ledgers);
    expect(nets).toEqual([
      { seat: 0, net: 50 },
      { seat: 1, net: -50 },
      { seat: 2, net: 0 },
    ]);
  });

  it('is zero-sum (nets sum to zero) with no rake', () => {
    const { nets } = computeNetSettlement(ledgers);
    expect(nets.reduce((a, n) => a + n.net, 0)).toBe(0);
  });

  it('nets sum to -rake when rake is enabled', () => {
    // 5 chips raked out of play: one player ends 5 short.
    const raked: PlayerLedger[] = [
      { seat: 0, currentChips: 145, totalBuyIn: 100 },
      { seat: 1, currentChips: 50, totalBuyIn: 100 },
      { seat: 2, currentChips: 100, totalBuyIn: 100 },
    ];
    const { nets, rake } = computeNetSettlement(raked, 5);
    expect(rake).toBe(5);
    expect(nets.reduce((a, n) => a + n.net, 0)).toBe(-5);
  });

  it('throws when chips are not conserved (not zero-sum)', () => {
    const bad: PlayerLedger[] = [
      { seat: 0, currentChips: 200, totalBuyIn: 100 },
      { seat: 1, currentChips: 50, totalBuyIn: 100 },
    ];
    expect(() => computeNetSettlement(bad)).toThrow(InvalidSettlementError);
  });
});
