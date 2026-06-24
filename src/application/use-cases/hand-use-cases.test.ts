import { beforeEach, describe, expect, it } from 'vitest';
import type {
  GameRecord,
  GameRepository,
  HandStore,
  RoomMemberRecord,
  RoomRepository,
  SaveHandInput,
  UserRoomMembership,
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
  async listRoomsForUser(): Promise<UserRoomMembership[]> {
    return [];
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
  async setMemberSittingOut(
    roomId: string,
    userId: string,
    sittingOut: boolean,
  ): Promise<void> {
    const members = this.membersByRoom.get(roomId) ?? [];
    this.membersByRoom.set(
      roomId,
      members.map((m) => (m.userId === userId ? { ...m, sittingOut } : m)),
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

/**
 * Tracks open games per room so the lazy-on-first-hand lifecycle can be asserted:
 * `createCount` counts how many games were opened, and a game stays open until
 * `end` clears its `endedAt` (end-game lands in PR2).
 */
class FakeGameRepository implements GameRepository {
  private readonly byRoom = new Map<string, GameRecord>();
  createCount = 0;

  async create(roomId: string): Promise<GameRecord> {
    this.createCount += 1;
    const game: GameRecord = {
      id: `game-${this.createCount}`,
      roomId,
      startedAt: new Date(0),
      endedAt: null,
    };
    this.byRoom.set(roomId, game);
    return game;
  }
  async findById(id: string): Promise<GameRecord | null> {
    for (const game of this.byRoom.values()) {
      if (game.id === id) return game;
    }
    return null;
  }
  async findOpenByRoom(roomId: string): Promise<GameRecord | null> {
    return this.byRoom.get(roomId) ?? null;
  }
  async end(id: string): Promise<void> {
    for (const [roomId, game] of this.byRoom) {
      if (game.id === id) this.byRoom.delete(roomId);
    }
  }
  async saveHand(_input: SaveHandInput): Promise<{ id: string }> {
    return { id: 'hand-record' };
  }
}

const ids = () => {
  let n = 0;
  return { generate: () => `hand-${++n}` };
};

const NOW = 1000;
const clock = { now: () => NOW };

function member(
  userId: string,
  seat: number,
  chips: number,
  sittingOut = false,
): RoomMemberRecord {
  return {
    userId,
    username: userId,
    seat,
    chips,
    buyInTotal: chips,
    sittingOut,
  };
}

let rooms: FakeRoomRepository;
let store: FakeHandStore;
let games: FakeGameRepository;

const room = createRoom({
  id: 'r1',
  name: 'Table',
  bankerId: 'banker',
  settings: { smallBlind: 5, bigBlind: 10 },
});

beforeEach(() => {
  rooms = new FakeRoomRepository();
  store = new FakeHandStore();
  games = new FakeGameRepository();
});

describe('StartHand', () => {
  it('starts a hand with funded players and sets the first actor left of the button', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    const hand = await new StartHand(rooms, store, ids(), clock, games).execute(
      {
        roomId: 'r1',
        requesterId: 'banker',
      },
    );
    expect(hand.status).toBe('betting');
    expect(hand.buttonSeat).toBe(0);
    // 3-handed: SB=seat1, BB=seat2, first actor=seat0 (left of the BB).
    expect(hand.actingSeat).toBe(0);
    expect(hand.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(hand.currentBet).toBe(10); // big blind posted
    expect(hand.lastRaiseSize).toBe(10); // minBet = bigBlind
    expect(hand.players.find((p) => p.seat === 1)?.committedThisStreet).toBe(5);
    expect(hand.players.find((p) => p.seat === 2)?.committedThisStreet).toBe(
      10,
    );
    // deadline = now + actionTimeoutMs (default 30000)
    expect(hand.actionDeadline).toBe(NOW + 30000);
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    await expect(
      new StartHand(rooms, store, ids(), clock, games).execute({
        roomId: 'r1',
        requesterId: 'bob',
      }),
    ).rejects.toThrow(NotBankerError);
  });

  it('rejects when fewer than two players are funded', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 0)]);
    await expect(
      new StartHand(rooms, store, ids(), clock, games).execute({
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
    const start = new StartHand(rooms, store, ids(), clock, games);

    const h1 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h1.buttonSeat).toBe(0); // first hand: lowest seat

    // Settle each hand so the next one may start, and check the button moves.
    await store.save('r1', { ...h1, status: 'settled' });
    const h2 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h2.buttonSeat).toBe(1);
    // Button 1 → SB=seat2, BB=seat0, first actor=seat1 (left of the BB).
    expect(h2.actingSeat).toBe(1);

    await store.save('r1', { ...h2, status: 'settled' });
    const h3 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h3.buttonSeat).toBe(2);

    await store.save('r1', { ...h3, status: 'settled' });
    const h4 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h4.buttonSeat).toBe(0); // wraps back to the lowest seat
  });

  it('rejects starting while a hand is in progress', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    const start = new StartHand(rooms, store, ids(), clock, games);
    await start.execute({ roomId: 'r1', requesterId: 'banker' });
    await expect(
      start.execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(HandInProgressError);
  });

  it('does not deal in a sitting-out member, nor make them act (4.14, bug-1 case b)', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100, true), // sitting out before the hand
      member('carol', 2, 100),
    ]);
    const hand = await new StartHand(rooms, store, ids(), clock, games).execute(
      {
        roomId: 'r1',
        requesterId: 'banker',
      },
    );
    // bob (seat 1) is excluded from the hand entirely…
    expect(hand.players.map((p) => p.seat)).toEqual([0, 2]); // bob skipped
    expect(hand.players.some((p) => p.seat === 1)).toBe(false);
    // …and is never assigned the action.
    expect(hand.actingSeat).not.toBe(1);
  });

  it('deals a member back in after they sit in (task 4.14)', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100, true),
      member('carol', 2, 100),
    ]);
    // bob returns before the deal.
    await rooms.setMemberSittingOut('r1', 'bob', false);
    const hand = await new StartHand(rooms, store, ids(), clock, games).execute(
      {
        roomId: 'r1',
        requesterId: 'banker',
      },
    );
    expect(hand.players.map((p) => p.seat)).toEqual([0, 1, 2]);
  });

  it('keeps a mid-hand sit-out in the current hand but skips the next (4.14)', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    const start = new StartHand(rooms, store, ids(), clock, games);
    const h1 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    // bob is dealt into the current hand.
    expect(h1.players.map((p) => p.seat)).toContain(1);

    // bob sits out mid-hand; the live hand is unchanged.
    await rooms.setMemberSittingOut('r1', 'bob', true);
    expect(h1.players.map((p) => p.seat)).toContain(1);

    // Next hand skips bob.
    await store.save('r1', { ...h1, status: 'settled' });
    const h2 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    expect(h2.players.map((p) => p.seat)).toEqual([0, 2]);
  });

  it('opens a durable game on the first hand (lazy-on-first-hand)', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);

    expect(await games.findOpenByRoom('r1')).toBeNull();
    await new StartHand(rooms, store, ids(), clock, games).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });

    expect(games.createCount).toBe(1);
    expect(await games.findOpenByRoom('r1')).not.toBeNull();
  });

  it('reuses the open game across later hands (creates it only once)', async () => {
    rooms.seedRoom(room, [member('banker', 0, 100), member('bob', 1, 100)]);
    const start = new StartHand(rooms, store, ids(), clock, games);

    const h1 = await start.execute({ roomId: 'r1', requesterId: 'banker' });
    // Settle so the next hand may start; the open game must be reused, not reopened.
    await store.save('r1', { ...h1, status: 'settled' });
    await start.execute({ roomId: 'r1', requesterId: 'banker' });

    expect(games.createCount).toBe(1);
  });
});

describe('PlayerAct', () => {
  async function startedHand(): Promise<void> {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100),
      member('carol', 2, 100),
    ]);
    await new StartHand(rooms, store, ids(), clock, games).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
  }

  it('applies an action and advances the turn clockwise', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store, clock);
    // Preflop with blinds posted: seat 0 (button) acts first and owes the BB.
    const result = await act.execute({
      roomId: 'r1',
      userId: 'banker',
      action: { type: 'CALL' },
    });
    expect(result.applied).toEqual({
      seat: 0,
      type: 'CALL',
      amount: undefined,
    });
    expect(result.hand.actingSeat).toBe(1); // turn moved to the small blind
    expect(result.hand.actionDeadline).toBe(NOW + 30000); // deadline refreshed
  });

  it('lets a raise then a call update the bet and move the turn', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store, clock);
    // Button (seat 0) raises to 20 over the big blind of 10.
    await act.execute({
      roomId: 'r1',
      userId: 'banker',
      action: { type: 'RAISE', amount: 20 },
    });
    const afterCall = await act.execute({
      roomId: 'r1',
      userId: 'bob',
      action: { type: 'CALL' },
    });
    expect(afterCall.hand.currentBet).toBe(20);
    const bob = afterCall.hand.players.find((p) => p.seat === 1);
    expect(bob?.committedThisStreet).toBe(20);
    expect(afterCall.hand.actingSeat).toBe(2); // turn to the big blind
  });

  it('rejects acting out of turn', async () => {
    await startedHand();
    const act = new PlayerAct(rooms, store, clock);
    // seat 0 (button) is to act; carol (seat 2) tries to act.
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

  it('rejects player:act from a sitting-out member not in the hand (4.14, bug-1 case b)', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 100),
      member('bob', 1, 100, true), // sat out before the hand → excluded
      member('carol', 2, 100),
    ]);
    await new StartHand(rooms, store, ids(), clock, games).execute({
      roomId: 'r1',
      requesterId: 'banker',
    });
    // bob is not part of the active hand, so the server rejects the action with
    // a typed error (not a turn-order error — they are not in the hand at all).
    await expect(
      new PlayerAct(rooms, store, clock).execute({
        roomId: 'r1',
        userId: 'bob',
        action: { type: 'CHECK' },
      }),
    ).rejects.toThrow(InvalidActionError);
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
