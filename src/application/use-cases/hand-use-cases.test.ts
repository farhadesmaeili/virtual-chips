import { beforeEach, describe, expect, it } from 'vitest';
import type {
  HandStore,
  RoomMemberRecord,
  RoomRepository,
} from '@/application/ports';
import {
  createHand,
  createPlayerInHand,
  createRoom,
  type Hand,
  type PlayerInHand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import {
  HandInProgressError,
  InvalidActionError,
  InvalidSettlementError,
  NoActiveHandError,
  NotBankerError,
  NotEnoughPlayersError,
  NotYourTurnError,
} from '@/domain/errors';
import { AdvanceStreet } from './advance-street';
import { PlayerAct } from './player-act';
import { SettleHand } from './settle-hand';
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
  async updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void> {
    const members = this.membersByRoom.get(roomId) ?? [];
    this.membersByRoom.set(
      roomId,
      members.map((m) => (m.userId === userId ? { ...m, chips } : m)),
    );
  }
  async addMemberFunding(
    roomId: string,
    userId: string,
    amount: number,
  ): Promise<void> {
    const members = this.membersByRoom.get(roomId) ?? [];
    this.membersByRoom.set(
      roomId,
      members.map((m) =>
        m.userId === userId
          ? { ...m, chips: m.chips + amount, buyInTotal: m.buyInTotal + amount }
          : m,
      ),
    );
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

const NOW = 1000;
const clock = { now: () => NOW };

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
    const hand = await new StartHand(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
    expect(hand.status).toBe('betting');
    expect(hand.buttonSeat).toBe(0);
    expect(hand.actingSeat).toBe(1); // first active left of button
    expect(hand.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(hand.lastRaiseSize).toBe(10); // minBet = bigBlind
    // deadline = now + actionTimeoutMs (default 30000)
    expect(hand.actionDeadline).toBe(NOW + 30000);
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await expect(
      new StartHand(rooms, store, ids(), clock).execute({
        roomId: 'r1',
        requesterId: 'bob',
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects when fewer than two players are funded', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 0)]);
    await expect(
      new StartHand(rooms, store, ids(), clock).execute({
        roomId: 'r1',
        requesterId: 'banker',
      }),
    ).rejects.toThrow(NotEnoughPlayersError);
  });

  it('rotates the dealer button clockwise across settled hands', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    const start = new StartHand(rooms, store, ids(), clock);

    const h1 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h1.buttonSeat).toBe(0); // first hand: lowest seat

    // Settle each hand so the next one may start, and check the button moves.
    await store.save('r1', { ...h1, status: 'settled' });
    const h2 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h2.buttonSeat).toBe(1);
    expect(h2.actingSeat).toBe(2); // first active left of the new button

    await store.save('r1', { ...h2, status: 'settled' });
    const h3 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h3.buttonSeat).toBe(2);

    await store.save('r1', { ...h3, status: 'settled' });
    const h4 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h4.buttonSeat).toBe(0); // wraps back to the lowest seat
  });

  it('rejects starting while a hand is in progress', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    const start = new StartHand(rooms, store, ids(), clock);
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
    await new StartHand(rooms, store, ids(), clock).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
  }

  it('applies an action and advances the turn clockwise', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store, clock);
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
    expect(result.hand.actionDeadline).toBe(NOW + 30000); // deadline refreshed
  });

  it('lets a bet then a call update the pot and move the turn', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store, clock);
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
    const act = new PlayerAct(rooms, store, clock);
    // seat 1 is to act; carol (seat 2) tries to act.
    await expect(
      act.execute({ roomId: 'r1', userId: 'carol', action: { type: 'CHECK' } }),
    ).rejects.toThrow(NotYourTurnError);
  });

  it('rejects acting when there is no hand', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100)]);
    await expect(
      new PlayerAct(rooms, store, clock).execute({
        roomId: 'r1',
        userId: 'banker',
        action: { type: 'CHECK' },
      }),
    ).rejects.toThrow(NoActiveHandError);
  });
});

describe('SettleHand', () => {
  // A player at showdown: committed `committedTotal` over the hand, `stack` left.
  function showdownPlayer(
    seat: number,
    userId: string,
    stack: number,
    committedTotal: number,
    state: PlayerInHand['state'] = 'active',
  ): PlayerInHand {
    return {
      ...createPlayerInHand({ seat, userId, stack }),
      committedTotal,
      committedThisStreet: 0,
      state,
      hasActedThisStreet: true,
    };
  }

  function awaitingHand(players: PlayerInHand[]): Hand {
    const base = createHand({ id: 'h1', roomId: 'r1', buttonSeat: 0, players });
    return { ...base, status: 'awaiting_showdown', actingSeat: null };
  }

  it('auto-awards an uncontested pot and persists final stacks', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingHand([
        showdownPlayer(0, 'banker', 80, 20, 'active'),
        showdownPlayer(1, 'bob', 80, 20, 'folded'),
      ]),
    );

    const result = await new SettleHand(rooms, store).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });

    expect(result.hand.status).toBe('settled');
    expect(result.payouts.get(0)).toBe(40); // pot 20 + 20 → only contender
    expect(result.snapshot.members.find((m) => m.seat === 0)?.chips).toBe(120);
    expect(result.snapshot.members.find((m) => m.seat === 1)?.chips).toBe(80);
  });

  it('awards a contested pot to the banker-declared winner', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingHand([
        showdownPlayer(0, 'banker', 80, 20, 'active'),
        showdownPlayer(1, 'bob', 80, 20, 'active'),
      ]),
    );

    const result = await new SettleHand(rooms, store).execute({
      roomId: 'r1',
      requesterId: 'banker',
      declarations: [[1]], // bob wins the single pot
    });

    expect(result.payouts.get(1)).toBe(40);
    expect(result.snapshot.members.find((m) => m.seat === 1)?.chips).toBe(120);
    expect(result.snapshot.members.find((m) => m.seat === 0)?.chips).toBe(80);
  });

  it('rejects a contested pot with no declaration', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingHand([
        showdownPlayer(0, 'banker', 80, 20, 'active'),
        showdownPlayer(1, 'bob', 80, 20, 'active'),
      ]),
    );
    await expect(
      new SettleHand(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
      }),
    ).rejects.toThrow(InvalidSettlementError);
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingHand([
        showdownPlayer(0, 'banker', 80, 20, 'active'),
        showdownPlayer(1, 'bob', 80, 20, 'folded'),
      ]),
    );
    await expect(
      new SettleHand(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'bob',
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects when there is no hand', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100)]);
    await expect(
      new SettleHand(rooms, store).execute({
        roomId: 'r1',
        requesterId: 'banker',
      }),
    ).rejects.toThrow(NoActiveHandError);
  });
});

describe('AdvanceStreet', () => {
  function player(
    seat: number,
    userId: string,
    state: PlayerInHand['state'] = 'active',
  ): PlayerInHand {
    return {
      ...createPlayerInHand({ seat, userId, stack: 100 }),
      committedThisStreet: 0,
      committedTotal: 20,
      state,
      hasActedThisStreet: true,
    };
  }

  function awaitingStreetHand(players: PlayerInHand[], street = 0): Hand {
    const base = createHand({
      id: 'h1',
      roomId: 'r1',
      buttonSeat: 0,
      players,
      street,
    });
    return { ...base, status: 'awaiting_street', actingSeat: null };
  }

  const advance = (): AdvanceStreet => new AdvanceStreet(rooms, store, clock);

  it('deals the next street and sets the next actor (banker only)', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingStreetHand([player(0, 'banker'), player(1, 'bob')]),
    );

    const hand = await advance().execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
    expect(hand.status).toBe('betting');
    expect(hand.street).toBe(1);
    expect(hand.actingSeat).toBe(1); // first active left of the button (seat 0)
    expect(hand.actionDeadline).toBe(NOW + 30000);
  });

  it('paces an all-in run-out — pauses again with no actor', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingStreetHand([
        player(0, 'banker', 'all_in'),
        player(1, 'bob', 'all_in'),
      ]),
    );

    const hand = await advance().execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
    expect(hand.status).toBe('awaiting_street');
    expect(hand.street).toBe(1);
    expect(hand.actingSeat).toBeNull();
    expect(hand.actionDeadline).toBeNull();
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await store.save(
      'r1',
      awaitingStreetHand([player(0, 'banker'), player(1, 'bob')]),
    );
    await expect(
      advance().execute({ roomId: 'r1', requesterId: 'bob' }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects when the hand is not awaiting a street', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    const base = createHand({
      id: 'h1',
      roomId: 'r1',
      buttonSeat: 0,
      players: [player(0, 'banker'), player(1, 'bob')],
    });
    await store.save('r1', { ...base, status: 'betting', actingSeat: 1 });
    await expect(
      advance().execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(InvalidActionError);
  });

  it('rejects when there is no hand', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100)]);
    await expect(
      advance().execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(NoActiveHandError);
  });
});
