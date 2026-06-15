import { describe, expect, it } from 'vitest';
import { createPlayerInHand } from './player-in-hand';
import { createPot } from './pot';
import {
  activePlayers,
  contenders,
  createHand,
  getPlayer,
  totalPot,
  updatePlayer,
  type Hand,
} from './hand';

function hand(): Hand {
  return createHand({
    id: 'h1',
    roomId: 'r1',
    buttonSeat: 0,
    players: [
      createPlayerInHand({ seat: 0, userId: 'a', stack: 100 }),
      {
        ...createPlayerInHand({ seat: 1, userId: 'b', stack: 100 }),
        state: 'folded',
      },
      {
        ...createPlayerInHand({ seat: 2, userId: 'c', stack: 0 }),
        state: 'all_in',
      },
    ],
  });
}

describe('createHand', () => {
  it('applies sensible defaults', () => {
    const h = hand();
    expect(h.street).toBe(0);
    expect(h.currentBet).toBe(0);
    expect(h.actingSeat).toBeNull();
    expect(h.actionDeadline).toBeNull();
    expect(h.pots).toEqual([]);
    expect(h.status).toBe('betting');
  });

  it('copies the players array', () => {
    const players = [createPlayerInHand({ seat: 0, userId: 'a', stack: 100 })];
    const h = createHand({ id: 'h', roomId: 'r', buttonSeat: 0, players });
    players.push(createPlayerInHand({ seat: 1, userId: 'b', stack: 100 }));
    expect(h.players).toHaveLength(1);
  });
});

describe('getPlayer', () => {
  it('finds by seat or returns undefined', () => {
    const h = hand();
    expect(getPlayer(h, 1)?.userId).toBe('b');
    expect(getPlayer(h, 9)).toBeUndefined();
  });
});

describe('updatePlayer', () => {
  it('updates only the matching seat, immutably', () => {
    const h = hand();
    const next = updatePlayer(h, 0, (p) => ({ ...p, stack: 42 }));
    expect(getPlayer(next, 0)?.stack).toBe(42);
    expect(getPlayer(next, 1)?.stack).toBe(100);
    // original untouched
    expect(getPlayer(h, 0)?.stack).toBe(100);
  });

  it('is a no-op when the seat is absent', () => {
    const h = hand();
    const next = updatePlayer(h, 9, (p) => ({ ...p, stack: 0 }));
    expect(next.players).toEqual(h.players);
  });
});

describe('player groupings', () => {
  it('activePlayers excludes folded and all-in', () => {
    expect(activePlayers(hand()).map((p) => p.seat)).toEqual([0]);
  });

  it('contenders include active and all-in but not folded', () => {
    expect(contenders(hand()).map((p) => p.seat)).toEqual([0, 2]);
  });
});

describe('totalPot', () => {
  it('sums all pot amounts', () => {
    const h = createHand({
      id: 'h',
      roomId: 'r',
      buttonSeat: 0,
      players: [],
      pots: [createPot(180, [0, 1, 2]), createPot(80, [0, 2])],
    });
    expect(totalPot(h)).toBe(260);
  });

  it('is zero with no pots', () => {
    expect(totalPot(hand())).toBe(0);
  });
});
