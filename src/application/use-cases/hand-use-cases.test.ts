import { beforeEach, describe, expect, it } from 'vitest';
import type {
  HandStore,
  RoomMemberRecord,
  RoomRepository,
} from '@/application/ports';
import {
  createRoom,
  type Hand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import {
  HandInProgressError,
  NoActiveHandError,
  NotBankerError,
  NotEnoughPlayersError,
  NotYourTurnError,
} from '@/domain/errors';
import { PlayerAct } from './player-act';
import { StartHand } from './start-hand';

class FakeRoomRepository implements RoomRepository {
  private readonly roomsById = new Map<string, Room>();
  private readonly membersByRoom = new Map<string, RoomMemberRecord[]>();

  seedRoom(room: Room, members: RoomMemberRecord[]): void {
    this.roomsById.set(room.id, room);
    this.membersByRoom.set(room.id, members);
  }

  async create(room: Room): Promise<Room> {
    this.roomsById.set(room.id, room);
    return room;
  }
  async findById(id: string): Promise<Room | null> {
    return this.roomsById.get(id) ?? null;
  }
  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    const room = this.roomsById.get(id);
    if (room) this.roomsById.set(id, { ...room, status });
  }
  async addMember(): Promise<RoomMemberRecord> {
    throw new Error('not used');
  }
  async removeMember(): Promise<void> {
    throw new Error('not used');
  }
  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.membersByRoom.get(roomId) ?? [])];
  }
}

class FakeHandStore implements HandStore {
  private readonly hands = new Map<string, Hand>();
  async get(roomId: string): Promise<Hand | null> {
    return this.hands.get(roomId) ?? null;
  }
  async save(roomId: string, hand: Hand): Promise<void> {
    this.hands.set(roomId, hand);
  }
  async clear(roomId: string): Promise<void> {
    this.hands.delete(roomId);
  }
}

const ids = () => {
  let n = 0;
  return { generate: () => `hand-${++n}` };
};

function member(userId: string, seat: number, chips: number): RoomMemberRecord {
  return { userId, username: userId, seat, chips, buyInTotal: chips };
}

let rooms: FakeRoomRepository;
let store: FakeHandStore;

const room = createRoom({
  id: 'r1',
  name: 'Table',
  bankerId: 'banker',
  settings: { smallBlind: 5, bigBlind: 10 },
});

beforeEach(() => {
  rooms = new FakeRoomRepository();
  store = new FakeHandStore();
});

describe('StartHand', () => {
  it('starts a hand with funded players and sets the first actor left of the button', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    const hand = await new StartHand(rooms, store, ids()).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
    expect(hand.status).toBe('betting');
    expect(hand.buttonSeat).toBe(0);
    expect(hand.actingSeat).toBe(1); // first active left of button
    expect(hand.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(hand.lastRaiseSize).toBe(10); // minBet = bigBlind
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await expect(
      new StartHand(rooms, store, ids()).execute({
        roomId: 'r1',
        requesterId: 'bob',
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects when fewer than two players are funded', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 0)]);
    await expect(
      new StartHand(rooms, store, ids()).execute({
        roomId: 'r1',
        requesterId: 'banker',
      }),
    ).rejects.toThrow(NotEnoughPlayersError);
  });

  it('rejects starting while a hand is in progress', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    const start = new StartHand(rooms, store, ids());
    await start.execute({ roomId: 'r1', requesterId: 'banker' });
    await expect(
      start.execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(HandInProgressError);
  });
});

describe('PlayerAct', () => {
  async function startedHand(): Promise<void> {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    await new StartHand(rooms, store, ids()).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
  }

  it('applies an action and advances the turn clockwise', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store);
    // seat 1 acts first (left of button); check is allowed (currentBet 0).
    const result = await act.execute({
      roomId: 'r1',
      userId: 'bob',
      action: { type: 'CHECK' },
    });
    expect(result.applied).toEqual({
      seat: 1,
      type: 'CHECK',
      amount: undefined,
    });
    expect(result.hand.actingSeat).toBe(2); // turn moved to seat 2
  });

  it('lets a bet then a call update the pot and move the turn', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store);
    await act.execute({
      roomId: 'r1',
      userId: 'bob',
      action: { type: 'BET', amount: 20 },
    });
    const afterCall = await act.execute({
      roomId: 'r1',
      userId: 'carol',
      action: { type: 'CALL' },
    });
    expect(afterCall.hand.currentBet).toBe(20);
    const carol = afterCall.hand.players.find((p) => p.seat === 2);
    expect(carol?.committedThisStreet).toBe(20);
    expect(afterCall.hand.actingSeat).toBe(0); // back to the button player
  });

  it('rejects acting out of turn', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store);
    // seat 1 is to act; carol (seat 2) tries to act.
    await expect(
      act.execute({ roomId: 'r1', userId: 'carol', action: { type: 'CHECK' } }),
    ).rejects.toThrow(NotYourTurnError);
  });

  it('rejects acting when there is no hand', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100)]);
    await expect(
      new PlayerAct(rooms, store).execute({
        roomId: 'r1',
        userId: 'banker',
        action: { type: 'CHECK' },
      }),
    ).rejects.toThrow(NoActiveHandError);
  });
});
