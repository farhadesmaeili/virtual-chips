import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '@/application/use-cases';
import { toPublicRoomState } from './room-projection';

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
