import { describe, expect, it } from 'vitest';
import { createHand, type Hand } from '../entities/hand';
import {
  createPlayerInHand,
  type PlayerInHand,
} from '../entities/player-in-hand';
import {
  advanceHand,
  firstActiveAfterButton,
  isHandUncontested,
  isStreetComplete,
  nextActiveSeat,
} from './street';

const MIN_BET = 2;

interface PlayerOpts {
  seat: number;
  stack?: number;
  committedThisStreet?: number;
  committedTotal?: number;
  state?: PlayerInHand['state'];
  hasActedThisStreet?: boolean;
}

function mkPlayer(o: PlayerOpts): PlayerInHand {
  return {
    ...createPlayerInHand({
      seat: o.seat,
      userId: `u${o.seat}`,
      stack: o.stack ?? 100,
    }),
    committedThisStreet: o.committedThisStreet ?? 0,
    committedTotal: o.committedTotal ?? 0,
    state: o.state ?? 'active',
    hasActedThisStreet: o.hasActedThisStreet ?? false,
  };
}

function mkHand(players: PlayerInHand[], overrides: Partial<Hand> = {}): Hand {
  return {
    ...createHand({ id: 'h1', roomId: 'r1', buttonSeat: 0, players }),
    actingSeat: 0,
    ...overrides,
  };
}

describe('nextActiveSeat', () => {
  const players = [
    mkPlayer({ seat: 0 }),
    mkPlayer({ seat: 1, state: 'folded' }),
    mkPlayer({ seat: 2, state: 'all_in' }),
    mkPlayer({ seat: 3 }),
  ];

  it('skips folded / all-in seats clockwise', () => {
    expect(nextActiveSeat(mkHand(players), 0)).toBe(3);
  });

  it('wraps around past the last seat', () => {
    expect(nextActiveSeat(mkHand(players), 3)).toBe(0);
  });

  it('skips sitting-out seats', () => {
    const ps = [
      mkPlayer({ seat: 0 }),
      mkPlayer({ seat: 1, state: 'sitting_out' }),
      mkPlayer({ seat: 2 }),
    ];
    expect(nextActiveSeat(mkHand(ps), 0)).toBe(2);
  });

  it('returns null when no other seat can act', () => {
    const ps = [
      mkPlayer({ seat: 0 }),
      mkPlayer({ seat: 1, state: 'folded' }),
      mkPlayer({ seat: 2, state: 'all_in' }),
    ];
    expect(nextActiveSeat(mkHand(ps), 0)).toBeNull();
  });
});

describe('firstActiveAfterButton', () => {
  it('is the first active seat clockwise from the button', () => {
    const hand = mkHand(
      [mkPlayer({ seat: 0 }), mkPlayer({ seat: 1 }), mkPlayer({ seat: 2 })],
      { buttonSeat: 1 },
    );
    expect(firstActiveAfterButton(hand)).toBe(2);
  });
});

describe('isHandUncontested', () => {
  it('is true with a single contender (everyone else folded)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0 }),
      mkPlayer({ seat: 1, state: 'folded' }),
      mkPlayer({ seat: 2, state: 'folded' }),
    ]);
    expect(isHandUncontested(hand)).toBe(true);
  });

  it('counts all-in players as contenders', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0, state: 'all_in' }),
      mkPlayer({ seat: 1, state: 'all_in' }),
      mkPlayer({ seat: 2, state: 'folded' }),
    ]);
    expect(isHandUncontested(hand)).toBe(false);
  });
});

describe('isStreetComplete', () => {
  it('is true when every active player acted and matched the bet', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({
          seat: 1,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
      ],
      { currentBet: 10 },
    );
    expect(isStreetComplete(hand)).toBe(true);
  });

  it('is false when someone has not acted', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({
          seat: 1,
          committedThisStreet: 0,
          hasActedThisStreet: false,
        }),
      ],
      { currentBet: 10 },
    );
    expect(isStreetComplete(hand)).toBe(false);
  });

  it('is false when an active player has not matched the bet', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({ seat: 1, committedThisStreet: 5, hasActedThisStreet: true }),
      ],
      { currentBet: 10 },
    );
    expect(isStreetComplete(hand)).toBe(false);
  });

  it('is true when no one can act (everyone all-in)', () => {
    const hand = mkHand(
      [
        mkPlayer({ seat: 0, state: 'all_in' }),
        mkPlayer({ seat: 1, state: 'all_in' }),
      ],
      { currentBet: 50 },
    );
    expect(isStreetComplete(hand)).toBe(true);
  });

  it('a lone active player facing an all-in must still match before completion', () => {
    const owing = mkHand(
      [
        mkPlayer({ seat: 0, state: 'all_in', committedThisStreet: 50 }),
        mkPlayer({
          seat: 1,
          committedThisStreet: 0,
          hasActedThisStreet: false,
        }),
      ],
      { currentBet: 50, actingSeat: 1 },
    );
    expect(isStreetComplete(owing)).toBe(false);

    const matched = mkHand(
      [
        mkPlayer({ seat: 0, state: 'all_in', committedThisStreet: 50 }),
        mkPlayer({
          seat: 1,
          committedThisStreet: 50,
          hasActedThisStreet: true,
        }),
      ],
      { currentBet: 50, actingSeat: 1 },
    );
    expect(isStreetComplete(matched)).toBe(true);
  });
});

describe('advanceHand — everyone calls (street complete, not last)', () => {
  it('resets the street and sets the first actor left of the button', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          stack: 90,
          committedThisStreet: 10,
          committedTotal: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({
          seat: 1,
          stack: 90,
          committedThisStreet: 10,
          committedTotal: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({
          seat: 2,
          stack: 90,
          committedThisStreet: 10,
          committedTotal: 10,
          hasActedThisStreet: true,
        }),
      ],
      { currentBet: 10, lastRaiseSize: 10, street: 0, buttonSeat: 0 },
    );
    const next = advanceHand(hand, { minBet: MIN_BET });
    expect(next.status).toBe('betting');
    expect(next.street).toBe(1);
    expect(next.currentBet).toBe(0);
    expect(next.lastRaiseSize).toBe(MIN_BET);
    expect(next.actingSeat).toBe(1); // first active after button (seat 0)
    for (const p of next.players) {
      expect(p.committedThisStreet).toBe(0);
      expect(p.hasActedThisStreet).toBe(false);
      expect(p.committedTotal).toBe(10); // preserved across the street
    }
  });
});

describe('advanceHand — everyone folds but one', () => {
  it('ends betting (awaiting_showdown)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0 }),
      mkPlayer({ seat: 1, state: 'folded' }),
      mkPlayer({ seat: 2, state: 'folded' }),
    ]);
    const next = advanceHand(hand, { minBet: MIN_BET });
    expect(next.status).toBe('awaiting_showdown');
    expect(next.actingSeat).toBeNull();
    expect(next.actionDeadline).toBeNull();
  });
});

describe('advanceHand — everyone all-in', () => {
  it('runs out the remaining streets and ends at showdown', () => {
    const hand = mkHand(
      [
        mkPlayer({ seat: 0, state: 'all_in', committedTotal: 100 }),
        mkPlayer({ seat: 1, state: 'all_in', committedTotal: 100 }),
      ],
      { street: 0, currentBet: 100 },
    );
    const next = advanceHand(hand, { minBet: MIN_BET });
    expect(next.status).toBe('awaiting_showdown');
    expect(next.actingSeat).toBeNull();
  });
});

describe('advanceHand — last street completes', () => {
  it('ends betting after the final street', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({
          seat: 1,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
      ],
      { currentBet: 10, street: 3 }, // last street (streetCount 4)
    );
    const next = advanceHand(hand, { minBet: MIN_BET });
    expect(next.status).toBe('awaiting_showdown');
  });
});

describe('advanceHand — mid-street (full orbit)', () => {
  it('passes the action clockwise to the next active seat', () => {
    // seat 0 just bet; seats 1 & 2 still need to act.
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({ seat: 1, hasActedThisStreet: false }),
        mkPlayer({ seat: 2, hasActedThisStreet: false }),
      ],
      { currentBet: 10, actingSeat: 0 },
    );
    const afterFirst = advanceHand(hand, { minBet: MIN_BET });
    expect(afterFirst.actingSeat).toBe(1);
    expect(afterFirst.status).toBe('betting');
  });

  it('skips a folded seat when advancing the turn', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({ seat: 1, state: 'folded' }),
        mkPlayer({ seat: 2, hasActedThisStreet: false }),
      ],
      { currentBet: 10, actingSeat: 0 },
    );
    expect(advanceHand(hand, { minBet: MIN_BET }).actingSeat).toBe(2);
  });

  it('does not mutate the input hand', () => {
    const hand = mkHand(
      [
        mkPlayer({
          seat: 0,
          committedThisStreet: 10,
          hasActedThisStreet: true,
        }),
        mkPlayer({ seat: 1 }),
      ],
      { currentBet: 10, actingSeat: 0 },
    );
    const snapshot = JSON.parse(JSON.stringify(hand));
    advanceHand(hand, { minBet: MIN_BET });
    expect(hand).toEqual(snapshot);
  });
});
