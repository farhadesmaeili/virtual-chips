import { beforeEach, describe, expect, it } from 'vitest';
import type { RoomMemberRecord, RoomRepository } from '@/application/ports';
import { createRoom, type Room } from '@/domain/entities';
import {
  ChipRequestNotFoundError,
  ChipRequestPendingError,
  InvalidChipsAmountError,
  NotBankerError,
  NotRoomMemberError,
} from '@/domain/errors';
import { InMemoryChipRequestStore } from '@/infrastructure/persistence/in-memory-chip-request-store';
import {
  ApproveChipRequest,
  RejectChipRequest,
  RequestChips,
} from './chip-requests';

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
  async updateStatus(): Promise<void> {}
  async addMember(): Promise<RoomMemberRecord> {
    throw new Error('not used');
  }
  async removeMember(): Promise<void> {}
  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.members.get(roomId) ?? [])];
  }
  async updateMemberChips(): Promise<void> {}
  async addMemberFunding(
    roomId: string,
    userId: string,
    amount: number,
  ): Promise<void> {
    const list = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      list.map((m) =>
        m.userId === userId
          ? { ...m, chips: m.chips + amount, buyInTotal: m.buyInTotal + amount }
          : m,
      ),
    );
  }
}

const ids = () => {
  let n = 0;
  return { generate: () => `req-${++n}` };
};
const clock = { now: () => 1000 };

function member(userId: string, seat: number): RoomMemberRecord {
  return { userId, username: userId, seat, chips: 0, buyInTotal: 0 };
}

const room = createRoom({ id: 'r1', name: 'Table', bankerId: 'banker' });

let rooms: FakeRoomRepository;
let store: InMemoryChipRequestStore;

beforeEach(() => {
  rooms = new FakeRoomRepository();
  store = new InMemoryChipRequestStore();
  rooms.seed(room, [member('banker', 0), member('bob', 1)]);
});

describe('RequestChips', () => {
  it('queues a pending request for a seated player', async () => {
    const requests = await new RequestChips(rooms, store, ids(), clock).execute(
      {
        roomId: 'r1',
        userId: 'bob',
        amount: 500,
      },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      userId: 'bob',
      seat: 1,
      username: 'bob',
      amount: 500,
    });
  });

  it('rejects a non-member', async () => {
    await expect(
      new RequestChips(rooms, store, ids(), clock).execute({
        roomId: 'r1',
        userId: 'ghost',
        amount: 500,
      }),
    ).rejects.toThrow(NotRoomMemberError);
  });

  it('rejects a second pending request from the same player', async () => {
    const request = new RequestChips(rooms, store, ids(), clock);
    await request.execute({ roomId: 'r1', userId: 'bob', amount: 500 });
    await expect(
      request.execute({ roomId: 'r1', userId: 'bob', amount: 200 }),
    ).rejects.toThrow(ChipRequestPendingError);
  });

  it('rejects a non-positive amount', async () => {
    await expect(
      new RequestChips(rooms, store, ids(), clock).execute({
        roomId: 'r1',
        userId: 'bob',
        amount: 0,
      }),
    ).rejects.toThrow(InvalidChipsAmountError);
  });
});

describe('ApproveChipRequest', () => {
  async function queued(userId: string, amount: number): Promise<string> {
    const list = await new RequestChips(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      userId,
      amount,
    });
    return list[0]!.id;
  }

  it('credits the stack and buy-in total, then clears the request', async () => {
    const requestId = await queued('bob', 500);
    const { snapshot, requests } = await new ApproveChipRequest(
      rooms,
      store,
    ).execute({ roomId: 'r1', requesterId: 'banker', requestId });

    const bob = snapshot.members.find((m) => m.seat === 1);
    expect(bob?.chips).toBe(500);
    expect(bob?.buyInTotal).toBe(500);
    expect(requests).toHaveLength(0);
    expect(await store.hasPending('r1', 'bob')).toBe(false);
  });

  it('rejects a non-banker', async () => {
    const requestId = await queued('bob', 500);
    await expect(
      new ApproveChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'bob',
        requestId,
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects an unknown request', async () => {
    await expect(
      new ApproveChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
        requestId: 'nope',
      }),
    ).rejects.toThrow(ChipRequestNotFoundError);
  });
});

describe('RejectChipRequest', () => {
  it('discards the request without granting chips', async () => {
    const list = await new RequestChips(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      userId: 'bob',
      amount: 500,
    });
    const requestId = list[0]!.id;

    const remaining = await new RejectChipRequest(rooms, store).execute({
      roomId: 'r1',
      requesterId: 'banker',
      requestId,
    });
    expect(remaining).toHaveLength(0);
    const members = await rooms.listMembers('r1');
    expect(members.find((m) => m.seat === 1)?.chips).toBe(0);
  });

  it('rejects a non-banker', async () => {
    const list = await new RequestChips(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      userId: 'bob',
      amount: 500,
    });
    await expect(
      new RejectChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'bob',
        requestId: list[0]!.id,
      }),
    ).rejects.toThrow(NotBankerError);
  });
});
