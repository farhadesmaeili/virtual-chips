import { describe, expect, it } from 'vitest';
import type { HandStore } from '@/application/ports';
import { createHand, createPlayerInHand, type Hand } from '@/domain/entities';
import { TIME_EXTENSION_MS } from '@/domain/engine';
import { InvalidActionError, NoActiveHandError } from '@/domain/errors';
import { RequestTimeExtension } from './request-time-extension';

class FakeHandStore implements HandStore {
  private hand: Hand | null = null;
  set(hand: Hand | null): void {
    this.hand = hand;
  }
  async get(): Promise<Hand | null> {
    return this.hand;
  }
  async save(_roomId: string, hand: Hand): Promise<void> {
    this.hand = hand;
  }
  async clear(): Promise<void> {
    this.hand = null;
  }
}

const clock = { now: () => 5000 };

// Seat 1 (user 'b') is acting; deadline at 1000.
function bettingHand(): Hand {
  const base = createHand({
    id: 'h1',
    roomId: 'r1',
    players: [
      createPlayerInHand({ seat: 0, userId: 'a', stack: 100 }),
      createPlayerInHand({ seat: 1, userId: 'b', stack: 100 }),
    ],
    buttonSeat: 0,
  });
  return { ...base, actingSeat: 1, actionDeadline: 1000 };
}

describe('RequestTimeExtension', () => {
  it('throws NoActiveHand when no hand is in play', async () => {
    const store = new FakeHandStore();
    await expect(
      new RequestTimeExtension(store, clock).execute({
        roomId: 'r1',
        userId: 'b',
      }),
    ).rejects.toThrow(NoActiveHandError);
  });

  it('throws InvalidAction when the user is not in the hand', async () => {
    const store = new FakeHandStore();
    store.set(bettingHand());
    await expect(
      new RequestTimeExtension(store, clock).execute({
        roomId: 'r1',
        userId: 'ghost',
      }),
    ).rejects.toThrow(InvalidActionError);
  });

  it('extends the acting player and saves the updated hand', async () => {
    const store = new FakeHandStore();
    store.set(bettingHand());

    const out = await new RequestTimeExtension(store, clock).execute({
      roomId: 'r1',
      userId: 'b',
    });

    expect(out.actionDeadline).toBe(1000 + TIME_EXTENSION_MS);
    expect(out.players.find((p) => p.seat === 1)?.timeExtensionsRemaining).toBe(
      1,
    );
    // Persisted, not just returned.
    const saved = await store.get();
    expect(saved?.actionDeadline).toBe(1000 + TIME_EXTENSION_MS);
  });
});
