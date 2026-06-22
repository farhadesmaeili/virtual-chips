import { describe, expect, it } from 'vitest';
import {
  createHand,
  getPlayer,
  updatePlayer,
  type Hand,
} from '../entities/hand';
import {
  createPlayerInHand,
  resetForNewStreet,
  type PlayerInHand,
} from '../entities/player-in-hand';
import {
  HandNotInBettingError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidRaiseError,
  NotYourTurnError,
} from '../errors';
import { applyAction } from './apply-action';

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

function mkHand(overrides: Partial<Hand> = {}): Hand {
  return {
    ...createHand({
      id: 'h1',
      roomId: 'r1',
      buttonSeat: 0,
      players: [
        mkPlayer({ seat: 0 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    }),
    actingSeat: 0,
    lastRaiseSize: MIN_BET,
    ...overrides,
  };
}

const act = (hand: Hand, action: Parameters<typeof applyAction>[1]): Hand =>
  applyAction(hand, action, MIN_BET);

describe('applyAction — guards', () => {
  it('throws if the hand is not in the betting phase', () => {
    const hand = mkHand({ status: 'settled' });
    expect(() => act(hand, { seat: 0, type: 'CHECK' })).toThrow(
      HandNotInBettingError,
    );
  });

  it('throws when acting out of turn', () => {
    const hand = mkHand({ actingSeat: 0 });
    expect(() => act(hand, { seat: 1, type: 'CHECK' })).toThrow(
      NotYourTurnError,
    );
  });

  it('throws when the acting seat is not an active player', () => {
    const hand = mkHand({
      actingSeat: 0,
      players: [
        mkPlayer({ seat: 0, state: 'folded' }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    expect(() => act(hand, { seat: 0, type: 'CHECK' })).toThrow(
      InvalidActionError,
    );
  });

  it('does not mutate the input hand', () => {
    const hand = mkHand();
    const snapshot = JSON.parse(JSON.stringify(hand));
    act(hand, { seat: 0, type: 'BET', amount: 10 });
    expect(hand).toEqual(snapshot);
  });
});

describe('FOLD', () => {
  it('marks the player folded and acted', () => {
    const next = act(mkHand(), { seat: 0, type: 'FOLD' });
    const p = getPlayer(next, 0)!;
    expect(p.state).toBe('folded');
    expect(p.hasActedThisStreet).toBe(true);
  });
});

describe('CHECK', () => {
  it('is allowed when nothing is owed', () => {
    const next = act(mkHand({ currentBet: 0 }), { seat: 0, type: 'CHECK' });
    expect(getPlayer(next, 0)!.hasActedThisStreet).toBe(true);
    expect(getPlayer(next, 0)!.stack).toBe(100);
  });

  it('is rejected when facing a bet', () => {
    const hand = mkHand({ currentBet: 10 });
    expect(() => act(hand, { seat: 0, type: 'CHECK' })).toThrow(
      InvalidActionError,
    );
  });
});

describe('CALL', () => {
  it('commits exactly the amount owed', () => {
    const hand = mkHand({ currentBet: 30 });
    const next = act(hand, { seat: 0, type: 'CALL' });
    const p = getPlayer(next, 0)!;
    expect(p.stack).toBe(70);
    expect(p.committedThisStreet).toBe(30);
    expect(next.currentBet).toBe(30); // unchanged
  });

  it('accounts for chips already committed this street', () => {
    const hand = mkHand({
      currentBet: 30,
      players: [
        mkPlayer({ seat: 0, stack: 90, committedThisStreet: 10 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    const p = getPlayer(act(hand, { seat: 0, type: 'CALL' }), 0)!;
    expect(p.committedThisStreet).toBe(30);
    expect(p.stack).toBe(70); // owed 20, had 90
  });

  it('is rejected when nothing is owed', () => {
    expect(() =>
      act(mkHand({ currentBet: 0 }), { seat: 0, type: 'CALL' }),
    ).toThrow(InvalidActionError);
  });

  it('throws InsufficientChips when the stack cannot cover the call (must all-in)', () => {
    const hand = mkHand({
      currentBet: 50,
      players: [
        mkPlayer({ seat: 0, stack: 40 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    expect(() => act(hand, { seat: 0, type: 'CALL' })).toThrow(
      InsufficientChipsError,
    );
  });

  it('a call that empties the stack makes the player all-in', () => {
    const hand = mkHand({
      currentBet: 40,
      players: [
        mkPlayer({ seat: 0, stack: 40 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    expect(getPlayer(act(hand, { seat: 0, type: 'CALL' }), 0)!.state).toBe(
      'all_in',
    );
  });
});

describe('BET', () => {
  it('opens a bet, sets currentBet and lastRaiseSize, and reopens action', () => {
    const hand = mkHand({
      currentBet: 0,
      players: [
        mkPlayer({ seat: 0 }),
        mkPlayer({ seat: 1, hasActedThisStreet: true }),
        mkPlayer({ seat: 2, hasActedThisStreet: true }),
      ],
    });
    const next = act(hand, { seat: 0, type: 'BET', amount: 10 });
    expect(next.currentBet).toBe(10);
    expect(next.lastRaiseSize).toBe(10);
    expect(getPlayer(next, 0)!.committedThisStreet).toBe(10);
    expect(getPlayer(next, 0)!.hasActedThisStreet).toBe(true);
    // other active players must respond again
    expect(getPlayer(next, 1)!.hasActedThisStreet).toBe(false);
    expect(getPlayer(next, 2)!.hasActedThisStreet).toBe(false);
  });

  it('is rejected when a bet already exists', () => {
    expect(() =>
      act(mkHand({ currentBet: 10 }), { seat: 0, type: 'BET', amount: 20 }),
    ).toThrow(InvalidActionError);
  });

  it('is rejected below the minimum bet', () => {
    expect(() =>
      act(mkHand({ currentBet: 0 }), { seat: 0, type: 'BET', amount: 1 }),
    ).toThrow(InvalidActionError);
  });

  it('accepts a bet exactly at the minimum', () => {
    const next = act(mkHand({ currentBet: 0 }), {
      seat: 0,
      type: 'BET',
      amount: MIN_BET,
    });
    expect(next.currentBet).toBe(MIN_BET);
  });

  it('throws InsufficientChips when betting more than the stack', () => {
    const hand = mkHand({
      currentBet: 0,
      players: [
        mkPlayer({ seat: 0, stack: 30 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    expect(() => act(hand, { seat: 0, type: 'BET', amount: 31 })).toThrow(
      InsufficientChipsError,
    );
  });
});

describe('RAISE', () => {
  // currentBet 10, lastRaiseSize 10 → min raise-to is 20.
  const raiseHand = (): Hand =>
    mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 100, committedThisStreet: 0 }),
        mkPlayer({ seat: 1, hasActedThisStreet: true }),
        mkPlayer({ seat: 2, hasActedThisStreet: true }),
      ],
    });

  it('raises to the target, sets lastRaiseSize to the increment, and reopens action', () => {
    const next = act(raiseHand(), { seat: 0, type: 'RAISE', amount: 30 });
    expect(next.currentBet).toBe(30);
    expect(next.lastRaiseSize).toBe(20); // 30 - 10
    expect(getPlayer(next, 0)!.committedThisStreet).toBe(30);
    expect(getPlayer(next, 1)!.hasActedThisStreet).toBe(false);
    expect(getPlayer(next, 2)!.hasActedThisStreet).toBe(false);
  });

  it('accepts a raise exactly at the min-raise', () => {
    const next = act(raiseHand(), { seat: 0, type: 'RAISE', amount: 20 });
    expect(next.currentBet).toBe(20);
    expect(next.lastRaiseSize).toBe(10);
  });

  it('rejects a raise below the min-raise', () => {
    expect(() =>
      act(raiseHand(), { seat: 0, type: 'RAISE', amount: 19 }),
    ).toThrow(InvalidRaiseError);
  });

  it('rejects a raise when there is no bet to raise', () => {
    expect(() =>
      act(mkHand({ currentBet: 0 }), { seat: 0, type: 'RAISE', amount: 20 }),
    ).toThrow(InvalidActionError);
  });

  it('throws InsufficientChips when the raise is unaffordable', () => {
    const hand = mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 25, committedThisStreet: 0 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    // raiseTo 30 needs 30 chips but the player only has 25.
    expect(() => act(hand, { seat: 0, type: 'RAISE', amount: 30 })).toThrow(
      InsufficientChipsError,
    );
  });
});

describe('ALL_IN', () => {
  it('a full-size all-in raise sets the new raise size and reopens action', () => {
    const hand = mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 30, committedThisStreet: 0 }),
        mkPlayer({ seat: 1, hasActedThisStreet: true }),
        mkPlayer({ seat: 2, hasActedThisStreet: true }),
      ],
    });
    const next = act(hand, { seat: 0, type: 'ALL_IN' });
    expect(getPlayer(next, 0)!.state).toBe('all_in');
    expect(next.currentBet).toBe(30);
    expect(next.lastRaiseSize).toBe(20); // increment 30 - 10 >= 10
    expect(getPlayer(next, 1)!.hasActedThisStreet).toBe(false);
  });

  it('a short all-in raise raises the bet but does NOT reopen or change lastRaiseSize', () => {
    const hand = mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 15, committedThisStreet: 0 }),
        mkPlayer({ seat: 1, hasActedThisStreet: true }),
        mkPlayer({ seat: 2, hasActedThisStreet: true }),
      ],
    });
    const next = act(hand, { seat: 0, type: 'ALL_IN' });
    expect(getPlayer(next, 0)!.state).toBe('all_in');
    expect(next.currentBet).toBe(15); // bet level rises
    expect(next.lastRaiseSize).toBe(10); // unchanged (short of a full raise)
    // players who already acted are NOT reopened
    expect(getPlayer(next, 1)!.hasActedThisStreet).toBe(true);
    expect(getPlayer(next, 2)!.hasActedThisStreet).toBe(true);
  });

  it('an all-in for at most the current bet does not change the bet level', () => {
    const hand = mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 6, committedThisStreet: 0 }),
        mkPlayer({ seat: 1, hasActedThisStreet: true }),
        mkPlayer({ seat: 2 }),
      ],
    });
    const next = act(hand, { seat: 0, type: 'ALL_IN' });
    expect(getPlayer(next, 0)!.state).toBe('all_in');
    expect(getPlayer(next, 0)!.committedThisStreet).toBe(6);
    expect(next.currentBet).toBe(10); // unchanged
    expect(getPlayer(next, 1)!.hasActedThisStreet).toBe(true); // not reopened
  });

  it('rejects an all-in with no chips', () => {
    const hand = updatePlayer(mkHand(), 0, (p) => ({ ...p, stack: 0 }));
    expect(() => act(hand, { seat: 0, type: 'ALL_IN' })).toThrow(
      InvalidActionError,
    );
  });
});

describe('lastAction (verb stamping)', () => {
  const lastActionAfter = (
    hand: Hand,
    action: Parameters<typeof applyAction>[1],
  ): PlayerInHand['lastAction'] =>
    getPlayer(act(hand, action), action.seat)!.lastAction;

  it('stamps the validated verb for each action type', () => {
    expect(
      lastActionAfter(mkHand({ currentBet: 0 }), { seat: 0, type: 'CHECK' }),
    ).toBe('CHECK');
    expect(lastActionAfter(mkHand(), { seat: 0, type: 'FOLD' })).toBe('FOLD');
    expect(
      lastActionAfter(mkHand({ currentBet: 30 }), { seat: 0, type: 'CALL' }),
    ).toBe('CALL');
    expect(
      lastActionAfter(mkHand({ currentBet: 0 }), {
        seat: 0,
        type: 'BET',
        amount: 10,
      }),
    ).toBe('BET');
    expect(
      lastActionAfter(mkHand({ currentBet: 10, lastRaiseSize: 10 }), {
        seat: 0,
        type: 'RAISE',
        amount: 30,
      }),
    ).toBe('RAISE');
    const allInHand = mkHand({
      currentBet: 10,
      lastRaiseSize: 10,
      players: [
        mkPlayer({ seat: 0, stack: 30 }),
        mkPlayer({ seat: 1 }),
        mkPlayer({ seat: 2 }),
      ],
    });
    expect(lastActionAfter(allInHand, { seat: 0, type: 'ALL_IN' })).toBe(
      'ALL_IN',
    );
  });

  it('stores only the verb — no amount on the player record', () => {
    const p = getPlayer(
      act(mkHand({ currentBet: 0 }), { seat: 0, type: 'BET', amount: 10 }),
      0,
    )!;
    expect(p.lastAction).toBe('BET');
    expect(Object.keys(p)).not.toContain('amount');
    expect(Object.keys(p)).not.toContain('lastAmount');
  });

  it('persists across a street reset (until the player acts again)', () => {
    const next = act(mkHand({ currentBet: 30 }), { seat: 0, type: 'CALL' });
    expect(resetForNewStreet(getPlayer(next, 0)!).lastAction).toBe('CALL');
  });

  it('leaves non-acting players null', () => {
    const next = act(mkHand({ currentBet: 0 }), { seat: 0, type: 'CHECK' });
    expect(getPlayer(next, 1)!.lastAction).toBeNull();
    expect(getPlayer(next, 2)!.lastAction).toBeNull();
  });
});
