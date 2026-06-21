import { describe, expect, it } from 'vitest';
import type {
  AddMemberInput,
  ChipRequestStore,
  HandStore,
  RoomMemberRecord,
  RoomRepository,
  UserRoomMembership,
} from '@/application/ports';
import {
  createHand,
  createPlayerInHand,
  createRoom,
  type Hand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import { NotRoomMemberError, RoomNotFoundError } from '@/domain/errors';
import { ResyncRoom } from './resync-room';

class FakeRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<string, RoomMemberRecord[]>();
  seed(room: Room, members: RoomMemberRecord[]): void {
    this.rooms.set(room.id, room);
    this.members.set(room.id, members);
  }
  async create(room: Room): Promise<Room> {
    return room;
  }
  async findById(id: string): Promise<Room | null> {
    return this.rooms.get(id) ?? null;
  }
  async updateStatus(_id: string, _status: RoomStatus): Promise<void> {}
  async addMember(
    _roomId: string,
    _member: AddMemberInput,
  ): Promise<RoomMemberRecord> {
    throw new Error('not used');
  }
  async removeMember(): Promise<void> {}
  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.members.get(roomId) ?? [])];
  }
  async listRoomsForUser(): Promise<UserRoomMembership[]> {
    return [];
  }
  async updateMemberChips(): Promise<void> {}
  async addMemberFunding(): Promise<void> {}
  async setMemberSittingOut(): Promise<void> {}
}

class FakeHandStore implements HandStore {
  constructor(private readonly hand: Hand | null) {}
  async get(): Promise<Hand | null> {
    return this.hand;
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
}

const emptyChipRequests: ChipRequestStore = {
  add: async () => {},
  get: async () => null,
  remove: async () => {},
  listByRoom: async () => [],
  hasPending: async () => false,
};

const room = createRoom({ id: 'r1', name: 'Table', bankerId: 'alice' });
const members: RoomMemberRecord[] = [
  { userId: 'alice', username: 'alice', seat: 0, chips: 100, buyInTotal: 100, sittingOut: false }, // prettier-ignore
  { userId: 'bob', username: 'bob', seat: 1, chips: 100, buyInTotal: 100, sittingOut: false }, // prettier-ignore
];

function liveHand(): Hand {
  const base = createHand({
    id: 'h1',
    roomId: 'r1',
    buttonSeat: 0,
    players: [
      createPlayerInHand({ seat: 0, userId: 'alice', stack: 100 }),
      createPlayerInHand({ seat: 1, userId: 'bob', stack: 100 }),
    ],
  });
  return { ...base, actingSeat: 1, actionDeadline: 1234 };
}

describe('ResyncRoom', () => {
  it('returns the room snapshot and the live hand for a member', async () => {
    const rooms = new FakeRoomRepository();
    rooms.seed(room, members);
    const result = await new ResyncRoom(
      rooms,
      new FakeHandStore(liveHand()),
      emptyChipRequests,
    ).execute({ userId: 'bob', roomId: 'r1' });
    expect(result.snapshot.members.map((m) => m.userId)).toEqual([
      'alice',
      'bob',
    ]);
    expect(result.hand?.actingSeat).toBe(1);
    expect(result.hand?.actionDeadline).toBe(1234);
  });

  it('returns a null hand when no hand is in progress', async () => {
    const rooms = new FakeRoomRepository();
    rooms.seed(room, members);
    const result = await new ResyncRoom(
      rooms,
      new FakeHandStore(null),
      emptyChipRequests,
    ).execute({
      userId: 'alice',
      roomId: 'r1',
    });
    expect(result.hand).toBeNull();
  });

  it('rejects a non-member (authorization)', async () => {
    const rooms = new FakeRoomRepository();
    rooms.seed(room, members);
    await expect(
      new ResyncRoom(rooms, new FakeHandStore(null), emptyChipRequests).execute(
        {
          userId: 'ghost',
          roomId: 'r1',
        },
      ),
    ).rejects.toThrow(NotRoomMemberError);
  });

  it('rejects an unknown room', async () => {
    const rooms = new FakeRoomRepository();
    await expect(
      new ResyncRoom(rooms, new FakeHandStore(null), emptyChipRequests).execute(
        {
          userId: 'alice',
          roomId: 'nope',
        },
      ),
    ).rejects.toThrow(RoomNotFoundError);
  });
});
