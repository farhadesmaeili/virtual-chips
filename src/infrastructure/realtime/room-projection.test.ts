import { describe, expect, it } from 'vitest';
import type { EndGameResult, RoomSnapshot } from '@/application/use-cases';
import { toPublicGameEnded, toPublicRoomState } from './room-projection';

const snapshot: RoomSnapshot = {
  id: 'r1',
  name: 'Table',
  status: 'waiting',
  settings: {
    actionTimeoutMs: 30000,
    smallBlind: 1,
    bigBlind: 2,
    minBuyIn: 20,
    maxBuyIn: 40,
    settlementMode: 'banker',
  },
  bankerId: 'banker-user-id',
  members: [
    {
      userId: 'banker-user-id',
      username: 'alice',
      seat: 0,
      chips: 100,
      buyInTotal: 100,
      sittingOut: false,
    },
    {
      userId: 'other-user-id',
      username: 'bob',
      seat: 1,
      chips: 50,
      buyInTotal: 50,
      sittingOut: true,
    },
  ],
};

describe('toPublicRoomState', () => {
  it('marks the banker and keeps display fields', () => {
    const state = toPublicRoomState(snapshot);
    expect(state.members).toEqual([
      {
        seat: 0,
        username: 'alice',
        chips: 100,
        buyInTotal: 100,
        isBanker: true,
        sittingOut: false,
      },
      {
        seat: 1,
        username: 'bob',
        chips: 50,
        buyInTotal: 50,
        isBanker: false,
        sittingOut: true,
      },
    ]);
  });

  it('never leaks raw userId or bankerId', () => {
    const serialized = JSON.stringify(toPublicRoomState(snapshot));
    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('banker-user-id');
    expect(serialized).not.toContain('other-user-id');
  });
});

describe('chip-value serialization guard', () => {
  // The boundary converts bigint -> number on read, so a chip value reaching a
  // socket payload is always a number. JSON.stringify throws on a bigint, so
  // these assertions prove no raw bigint leaks into a broadcast.
  it('toPublicRoomState serializes and round-trips chip values', () => {
    const json = JSON.stringify(toPublicRoomState(snapshot));
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as ReturnType<typeof toPublicRoomState>;
    expect(parsed.members[0]?.chips).toBe(100);
    expect(parsed.settings.bigBlind).toBe(2);
  });

  it('toPublicGameEnded serializes and round-trips net/rake', () => {
    const result: EndGameResult = {
      gameId: 'game-1',
      nets: [
        { seat: 0, userId: 'banker-user-id', net: 800 },
        { seat: 1, userId: 'other-user-id', net: -800 },
      ],
      rake: 0,
      snapshot,
    };
    const json = JSON.stringify(toPublicGameEnded(result));
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).not.toContain('banker-user-id');
    expect(json).not.toContain('other-user-id');
    const parsed = JSON.parse(json) as ReturnType<typeof toPublicGameEnded>;
    expect(parsed.nets[0]?.net).toBe(800);
    expect(parsed.rake).toBe(0);
  });
});
