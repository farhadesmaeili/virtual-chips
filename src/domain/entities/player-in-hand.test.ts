import { describe, expect, it } from 'vitest';
import { InsufficientChipsError } from '../errors';
import {
  canAct,
  commit,
  createPlayerInHand,
  DEFAULT_TIME_EXTENSIONS,
  fold,
  isActive,
  markActed,
  resetForNewStreet,
  toCall,
  type PlayerInHand,
} from './player-in-hand';

function player(overrides: Partial<PlayerInHand> = {}): PlayerInHand {
  return {
    ...createPlayerInHand({ seat: 0, userId: 'u', stack: 100 }),
    ...overrides,
  };
}

describe('createPlayerInHand', () => {
  it('starts active with zeroed commitments', () => {
    const p = createPlayerInHand({ seat: 3, userId: 'alice', stack: 200 });
    expect(p).toMatchObject({
      seat: 3,
      userId: 'alice',
      stack: 200,
      committedThisStreet: 0,
      committedTotal: 0,
      state: 'active',
      hasActedThisStreet: false,
    });
  });

  it('starts with the default time-bank extensions (task 4.12)', () => {
    const p = createPlayerInHand({ seat: 0, userId: 'u', stack: 100 });
    expect(p.timeExtensionsRemaining).toBe(DEFAULT_TIME_EXTENSIONS);
  });

  it('starts with no last action (cleared at hand start)', () => {
    const p = createPlayerInHand({ seat: 0, userId: 'u', stack: 100 });
    expect(p.lastAction).toBeNull();
  });

  it('validates the starting stack', () => {
    expect(() =>
      createPlayerInHand({ seat: 0, userId: 'u', stack: -5 }),
    ).toThrow();
  });
});

describe('predicates', () => {
  it('reflects player state', () => {
    expect(isActive(player())).toBe(true);
    expect(canAct(player())).toBe(true);
    expect(canAct(player({ state: 'all_in' }))).toBe(false);
    expect(canAct(player({ state: 'folded' }))).toBe(false);
  });
});

describe('toCall', () => {
  it('is the gap to the current bet, never negative', () => {
    expect(toCall(player({ committedThisStreet: 20 }), 50)).toBe(30);
    expect(toCall(player({ committedThisStreet: 50 }), 50)).toBe(0);
    expect(toCall(player({ committedThisStreet: 80 }), 50)).toBe(0);
  });
});

describe('commit', () => {
  it('moves chips from stack to commitments and marks acted', () => {
    const p = commit(player({ stack: 100 }), 30);
    expect(p.stack).toBe(70);
    expect(p.committedThisStreet).toBe(30);
    expect(p.committedTotal).toBe(30);
    expect(p.hasActedThisStreet).toBe(true);
    expect(p.state).toBe('active');
  });

  it('accumulates across multiple commits in a street', () => {
    const p = commit(commit(player({ stack: 100 }), 20), 30);
    expect(p.stack).toBe(50);
    expect(p.committedThisStreet).toBe(50);
    expect(p.committedTotal).toBe(50);
  });

  it('marks the player all_in when the stack is emptied', () => {
    const p = commit(player({ stack: 40 }), 40);
    expect(p.stack).toBe(0);
    expect(p.state).toBe('all_in');
  });

  it('throws when committing more than the stack', () => {
    expect(() => commit(player({ stack: 30 }), 31)).toThrow(
      InsufficientChipsError,
    );
  });

  it('does not mutate the input', () => {
    const original = player({ stack: 100 });
    commit(original, 30);
    expect(original.stack).toBe(100);
    expect(original.committedThisStreet).toBe(0);
  });
});

describe('markActed / fold', () => {
  it('markActed only flips the acted flag', () => {
    const p = markActed(player({ stack: 100 }));
    expect(p.hasActedThisStreet).toBe(true);
    expect(p.stack).toBe(100);
  });

  it('fold marks folded and acted', () => {
    const p = fold(player());
    expect(p.state).toBe('folded');
    expect(p.hasActedThisStreet).toBe(true);
  });
});

describe('resetForNewStreet', () => {
  it('clears per-street fields but keeps committedTotal and state', () => {
    const p = resetForNewStreet(
      player({
        committedThisStreet: 40,
        committedTotal: 90,
        hasActedThisStreet: true,
        state: 'all_in',
      }),
    );
    expect(p.committedThisStreet).toBe(0);
    expect(p.hasActedThisStreet).toBe(false);
    expect(p.committedTotal).toBe(90);
    expect(p.state).toBe('all_in');
  });

  it('keeps lastAction across the street (persists within the hand)', () => {
    const p = resetForNewStreet(player({ lastAction: 'RAISE' }));
    expect(p.lastAction).toBe('RAISE');
  });
});
