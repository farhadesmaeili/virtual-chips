import { beforeEach, describe, expect, it } from 'vitest';
import type {
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
} from '@/domain/entities';
import {
  ChipRequestNotFoundError,
  ChipRequestPendingError,
  HandInProgressError,
  InsufficientChipsError,
  InvalidChipsAmountError,
  NotBankerError,
  NotRoomMemberError,
} from '@/domain/errors';
import { InMemoryChipRequestStore } from '@/infrastructure/persistence/in-memory-chip-request-store';
import { AdjustMemberChips } from './adjust-member-chips';
import {
  ApproveChipRequest,
  RejectChipRequest,
  RequestChips,
} from './chip-requests';

/** Minimal HandStore for the between-hands gate; `hand` is settable per test. */
class FakeHandStore implements HandStore {
  hand: Hand | null = null;
  async get(): Promise<Hand | null> {
    return this.hand;
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
}

/** A live (betting) hand for the in-progress gate test. */
function liveHand(): Hand {
  return createHand({
    id: 'h1',
    roomId: 'r1',
    buttonSeat: 0,
    players: [
      createPlayerInHand({ seat: 0, userId: 'banker', stack: 100 }),
      createPlayerInHand({ seat: 1, userId: 'bob', stack: 100 }),
    ],
  });
}

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
  async listRoomsForUser(): Promise<UserRoomMembership[]> {
    return [];
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
  async setMemberSittingOut(): Promise<void> {}
}

const ids = () => {
  let n = 0;
  return { generate: () => `req-${++n}` };
};
const clock = { now: () => 1000 };

function member(userId: string, seat: number): RoomMemberRecord {
  return {
    userId,
    username: userId,
    seat,
    chips: 0,
    buyInTotal: 0,
    sittingOut: false,
  };
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

describe('AdjustMemberChips', () => {
  let hands: FakeHandStore;

  // A funded two-handed table; banker seat 0, bob seat 1.
  const funded = (
    over: Partial<{ bobChips: number; bobBuyIn: number }> = {},
  ): RoomMemberRecord[] => [
    {
      userId: 'banker',
      username: 'banker',
      seat: 0,
      chips: 1000,
      buyInTotal: 1000,
      sittingOut: false,
    },
    {
      userId: 'bob',
      username: 'bob',
      seat: 1,
      chips: over.bobChips ?? 500,
      buyInTotal: over.bobBuyIn ?? 500,
      sittingOut: false,
    },
  ];

  const bob = async (): Promise<RoomMemberRecord> => {
    const members = await rooms.listMembers('r1');
    return members.find((m) => m.seat === 1)!;
  };

  beforeEach(() => {
    hands = new FakeHandStore();
  });

  it('rejects a non-banker', async () => {
    rooms.seed(room, funded());
    await expect(
      new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'bob',
        targetSeat: 1,
        amount: 100,
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('increases chips and buyInTotal in lockstep (net unchanged)', async () => {
    rooms.seed(room, funded());
    await new AdjustMemberChips(rooms, hands).execute({
      roomId: 'r1',
      requesterId: 'banker',
      targetSeat: 1,
      amount: 200,
    });
    const m = await bob();
    expect(m.chips).toBe(700);
    expect(m.buyInTotal).toBe(700);
    expect(m.chips - m.buyInTotal).toBe(0); // net preserved
  });

  it('decreases chips and buyInTotal in lockstep (net unchanged)', async () => {
    rooms.seed(room, funded());
    await new AdjustMemberChips(rooms, hands).execute({
      roomId: 'r1',
      requesterId: 'banker',
      targetSeat: 1,
      amount: -200,
    });
    const m = await bob();
    expect(m.chips).toBe(300);
    expect(m.buyInTotal).toBe(300);
    expect(m.chips - m.buyInTotal).toBe(0);
  });

  it('rejects a decrease that would drive chips below zero', async () => {
    // chips 100 < buyInTotal 1000, so only the chips floor can trip first.
    rooms.seed(room, funded({ bobChips: 100, bobBuyIn: 1000 }));
    await expect(
      new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: -500,
      }),
    ).rejects.toThrow(InsufficientChipsError);
  });

  it('rejects a decrease that would drive buyInTotal below zero', async () => {
    // chips 1000 passes the first floor; buyInTotal 100 trips the second.
    rooms.seed(room, funded({ bobChips: 1000, bobBuyIn: 100 }));
    await expect(
      new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: -500,
      }),
    ).rejects.toThrow(InsufficientChipsError);
  });

  it('rejects a zero or non-integer amount', async () => {
    rooms.seed(room, funded());
    const adjust = new AdjustMemberChips(rooms, hands);
    await expect(
      adjust.execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: 0,
      }),
    ).rejects.toThrow(InvalidChipsAmountError);
    await expect(
      adjust.execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: 1.5,
      }),
    ).rejects.toThrow(InvalidChipsAmountError);
  });

  it('rejects an unknown target seat', async () => {
    rooms.seed(room, funded());
    await expect(
      new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 99,
        amount: 100,
      }),
    ).rejects.toThrow(NotRoomMemberError);
  });

  it('rejects an adjustment while a hand is in progress, allows it once settled', async () => {
    rooms.seed(room, funded());
    const adjust = new AdjustMemberChips(rooms, hands);

    hands.hand = liveHand(); // status 'betting' → blocked
    await expect(
      adjust.execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: 100,
      }),
    ).rejects.toThrow(HandInProgressError);

    // A settled hand is not "in progress" — the adjustment goes through.
    hands.hand = { ...liveHand(), status: 'settled' };
    await adjust.execute({
      roomId: 'r1',
      requesterId: 'banker',
      targetSeat: 1,
      amount: 100,
    });
    expect((await bob()).chips).toBe(600);
  });
});
