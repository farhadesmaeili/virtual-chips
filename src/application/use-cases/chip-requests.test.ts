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
  MAX_CHIP_TOTAL,
  type Hand,
  type Room,
} from '@/domain/entities';
import {
  BuyInLimitError,
  ChipRequestNotFoundError,
  ChipRequestPendingError,
  FundingCeilingError,
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

// Generous buy-in bounds so the baseline request/approve tests stay valid; the
// limit-specific tests below seed their own rooms with tight bounds.
const room = createRoom({
  id: 'r1',
  name: 'Table',
  bankerId: 'banker',
  settings: { minBuyIn: 100, maxBuyIn: 100_000 },
});

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

describe('RequestChips buy-in limits', () => {
  // A table with tight bounds: first buy in [100, max stack 1000].
  const limited = createRoom({
    id: 'r1',
    name: 'Table',
    bankerId: 'banker',
    settings: { minBuyIn: 100, maxBuyIn: 1000 },
  });

  function seatedWith(chips: number): RoomMemberRecord {
    return {
      userId: 'bob',
      username: 'bob',
      seat: 1,
      chips,
      buyInTotal: chips,
      sittingOut: false,
    };
  }

  function request(amount: number): Promise<unknown> {
    return new RequestChips(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      userId: 'bob',
      amount,
    });
  }

  it('rejects a first buy below the minimum', async () => {
    rooms.seed(limited, [member('banker', 0), seatedWith(0)]);
    await expect(request(50)).rejects.toThrow(BuyInLimitError);
  });

  it('rejects a first buy that exceeds the maximum stack', async () => {
    rooms.seed(limited, [member('banker', 0), seatedWith(0)]);
    await expect(request(1500)).rejects.toThrow(BuyInLimitError);
  });

  it('allows a top-up that is below the minimum (min not applied to top-ups)', async () => {
    rooms.seed(limited, [member('banker', 0), seatedWith(500)]);
    await expect(request(50)).resolves.toHaveLength(1);
  });

  it('rejects a top-up that would exceed the maximum stack', async () => {
    rooms.seed(limited, [member('banker', 0), seatedWith(500)]);
    await expect(request(600)).rejects.toThrow(BuyInLimitError);
  });

  it('rejects any request once the stack is already full', async () => {
    rooms.seed(limited, [member('banker', 0), seatedWith(1000)]);
    await expect(request(1)).rejects.toThrow(BuyInLimitError);
  });

  it('allows any large amount when there is no maximum', async () => {
    const noMax = createRoom({
      id: 'r1',
      name: 'Table',
      bankerId: 'banker',
      settings: { minBuyIn: 100, maxBuyIn: null },
    });
    rooms.seed(noMax, [member('banker', 0), seatedWith(0)]);
    await expect(request(900_000)).resolves.toHaveLength(1);
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

  it('re-validates at approve time against the current stack, without moving chips', async () => {
    // Tight table: max stack 1000.
    const limited = createRoom({
      id: 'r1',
      name: 'Table',
      bankerId: 'banker',
      settings: { minBuyIn: 100, maxBuyIn: 1000 },
    });
    rooms.seed(limited, [member('banker', 0), member('bob', 1)]);

    // Bob queues a valid first buy of 600 (chips 0 → within [100, 1000]).
    const requestId = await queued('bob', 600);

    // Between request and approval the banker tops bob up to 600 (task 6.7),
    // so funding the 600 now would overshoot the 1000 cap.
    await rooms.addMemberFunding('r1', 'bob', 600);

    await expect(
      new ApproveChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
        requestId,
      }),
    ).rejects.toThrow(BuyInLimitError);

    // No chips moved on the rejected approval; the request stays pending.
    const bob = (await rooms.listMembers('r1')).find((m) => m.seat === 1);
    expect(bob?.chips).toBe(600);
    expect(await store.hasPending('r1', 'bob')).toBe(true);
  });

  describe('cumulative funding ceiling', () => {
    // A table with no maximum stack, so only the global ceiling can bind.
    const noMax = createRoom({
      id: 'r1',
      name: 'Table',
      bankerId: 'banker',
      settings: { minBuyIn: 100, maxBuyIn: null },
    });

    /** Seats bob with explicit chips/buyInTotal at an otherwise-uncapped table. */
    function seedBob(chips: number, buyInTotal: number): void {
      rooms.seed(noMax, [
        member('banker', 0),
        {
          userId: 'bob',
          username: 'bob',
          seat: 1,
          chips,
          buyInTotal,
          sittingOut: false,
        },
      ]);
    }

    it('approves a first buy landing exactly on the ceiling', async () => {
      seedBob(0, 0);
      const requestId = await queued('bob', MAX_CHIP_TOTAL);
      const { snapshot } = await new ApproveChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
        requestId,
      });
      expect(snapshot.members.find((m) => m.seat === 1)?.chips).toBe(
        MAX_CHIP_TOTAL,
      );
    });

    it('approves a first buy one below the ceiling', async () => {
      seedBob(0, 0);
      const requestId = await queued('bob', MAX_CHIP_TOTAL - 1);
      const { snapshot } = await new ApproveChipRequest(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
        requestId,
      });
      expect(snapshot.members.find((m) => m.seat === 1)?.chips).toBe(
        MAX_CHIP_TOTAL - 1,
      );
    });

    it('rejects a first buy one over the ceiling with FUNDING_CEILING', async () => {
      seedBob(0, 0);
      const requestId = await queued('bob', MAX_CHIP_TOTAL + 1);
      const error = await new ApproveChipRequest(rooms, store)
        .execute({ roomId: 'r1', requesterId: 'banker', requestId })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FundingCeilingError);
      expect((error as FundingCeilingError).code).toBe('FUNDING_CEILING');
      // No chips moved; the request stays pending.
      expect(
        (await rooms.listMembers('r1')).find((m) => m.seat === 1)?.chips,
      ).toBe(0);
      expect(await store.hasPending('r1', 'bob')).toBe(true);
    });

    it('rejects a cumulative op whose amount is under the per-op cap but overflows buyInTotal', async () => {
      // chips is low, but buyInTotal already near the ceiling: a small buy-in
      // that is fine per-op would push the unbounded accumulator over.
      seedBob(0, MAX_CHIP_TOTAL - 100);
      const requestId = await queued('bob', 200);
      await expect(
        new ApproveChipRequest(rooms, store).execute({
          roomId: 'r1',
          requesterId: 'banker',
          requestId,
        }),
      ).rejects.toThrow(FundingCeilingError);
    });

    it('rejects an over-ceiling approval even when the table has no maximum', async () => {
      seedBob(0, 0);
      const requestId = await queued('bob', MAX_CHIP_TOTAL + 1);
      await expect(
        new ApproveChipRequest(rooms, store).execute({
          roomId: 'r1',
          requesterId: 'banker',
          requestId,
        }),
      ).rejects.toThrow(FundingCeilingError);
    });
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

  describe('cumulative funding ceiling', () => {
    it('adjusts a credit landing exactly on the ceiling', async () => {
      rooms.seed(room, funded({ bobChips: 0, bobBuyIn: 0 }));
      await new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: MAX_CHIP_TOTAL,
      });
      expect((await bob()).chips).toBe(MAX_CHIP_TOTAL);
    });

    it('adjusts a credit one below the ceiling', async () => {
      rooms.seed(room, funded({ bobChips: 0, bobBuyIn: 0 }));
      await new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: MAX_CHIP_TOTAL - 1,
      });
      expect((await bob()).chips).toBe(MAX_CHIP_TOTAL - 1);
    });

    it('rejects a credit one over the ceiling with FUNDING_CEILING', async () => {
      rooms.seed(room, funded({ bobChips: 0, bobBuyIn: 0 }));
      const error = await new AdjustMemberChips(rooms, hands)
        .execute({
          roomId: 'r1',
          requesterId: 'banker',
          targetSeat: 1,
          amount: MAX_CHIP_TOTAL + 1,
        })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FundingCeilingError);
      expect((error as FundingCeilingError).code).toBe('FUNDING_CEILING');
      // No chips moved on the rejected adjust.
      expect((await bob()).chips).toBe(0);
    });

    it('rejects a cumulative credit whose total pushes past the ceiling', async () => {
      rooms.seed(
        room,
        funded({
          bobChips: MAX_CHIP_TOTAL - 100,
          bobBuyIn: MAX_CHIP_TOTAL - 100,
        }),
      );
      await expect(
        new AdjustMemberChips(rooms, hands).execute({
          roomId: 'r1',
          requesterId: 'banker',
          targetSeat: 1,
          amount: 200,
        }),
      ).rejects.toThrow(FundingCeilingError);
    });

    it('still allows a negative adjust at the ceiling (cash-out is a no-op for the guard)', async () => {
      rooms.seed(
        room,
        funded({ bobChips: MAX_CHIP_TOTAL, bobBuyIn: MAX_CHIP_TOTAL }),
      );
      await new AdjustMemberChips(rooms, hands).execute({
        roomId: 'r1',
        requesterId: 'banker',
        targetSeat: 1,
        amount: -200,
      });
      expect((await bob()).chips).toBe(MAX_CHIP_TOTAL - 200);
    });
  });
});
