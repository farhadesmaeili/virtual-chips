import { describe, expect, it } from 'vitest';
import { createHand, createPlayerInHand, type Hand } from '../entities';
import { autoActionType } from './auto-action';

function hand(overrides: Partial<Hand>): Hand {
  const base = createHand({
    id: 'h1',
    roomId: 'r1',
    buttonSeat: 0,
    players: [
      createPlayerInHand({ seat: 0, userId: 'a', stack: 100 }),
      createPlayerInHand({ seat: 1, userId: 'b', stack: 100 }),
    ],
  });
  return { ...base, ...overrides };
}

describe('autoActionType', () => {
  it('checks when nothing is owed', () => {
    expect(autoActionType(hand({ actingSeat: 0, currentBet: 0 }))).toBe(
      'CHECK',
    );
  });

  it('folds when chips are owed', () => {
    const h = hand({ actingSeat: 0, currentBet: 20 });
    expect(autoActionType(h)).toBe('FOLD');
  });

  it('checks when the player has already matched the bet', () => {
    const base = hand({ actingSeat: 0, currentBet: 20 });
    const players = base.players.map((p) =>
      p.seat === 0 ? { ...p, committedThisStreet: 20 } : p,
    );
    expect(autoActionType({ ...base, players })).toBe('CHECK');
  });

  it('returns null when no one is acting', () => {
    expect(autoActionType(hand({ actingSeat: null }))).toBeNull();
  });
});
