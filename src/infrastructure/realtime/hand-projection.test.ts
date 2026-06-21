import { describe, expect, it } from 'vitest';
import { createHand, createPlayerInHand, type Hand } from '@/domain/entities';
import { toPublicHandState } from './hand-projection';

function handWith(): Hand {
  const base = createHand({
    id: 'h1',
    roomId: 'r1',
    buttonSeat: 0,
    players: [
      {
        ...createPlayerInHand({ seat: 0, userId: 'user-aaa', stack: 80 }),
        committedThisStreet: 20,
        committedTotal: 20,
      },
      {
        ...createPlayerInHand({ seat: 1, userId: 'user-bbb', stack: 80 }),
        committedThisStreet: 20,
        committedTotal: 20,
      },
    ],
  });
  return { ...base, currentBet: 20, actingSeat: 0 };
}

describe('toPublicHandState', () => {
  it('exposes seat-based players and derived pots', () => {
    const state = toPublicHandState(handWith());
    expect(state.players).toEqual([
      {
        seat: 0,
        stack: 80,
        committedThisStreet: 20,
        committedTotal: 20,
        state: 'active',
        hasActedThisStreet: false,
        timeExtensionsRemaining: 2,
      },
      {
        seat: 1,
        stack: 80,
        committedThisStreet: 20,
        committedTotal: 20,
        state: 'active',
        hasActedThisStreet: false,
        timeExtensionsRemaining: 2,
      },
    ]);
    expect(state.pots).toEqual([{ amount: 40, eligibleSeats: [0, 1] }]);
    expect(state.totalPot).toBe(40);
    expect(state.currentBet).toBe(20);
    expect(state.lastRaiseSize).toBe(0);
    expect(state.actingSeat).toBe(0);
  });

  it('never leaks raw userId', () => {
    const serialized = JSON.stringify(toPublicHandState(handWith()));
    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('user-aaa');
  });
});
