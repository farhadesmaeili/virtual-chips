import { beforeEach, describe, expect, it } from 'vitest';
import type {
  GameRecord,
  GameRepository,
  HandStore,
  RoomMemberRecord,
  RoomRepository,
  SaveHandInput,
  SettlementRecordInput,
  SettlementRepository,
  UserGameSettlement,
  UserRoomMembership,
} from '@/application/ports';
import {
  createRoom,
  type Hand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import {
  HandInProgressError,
  InvalidSettlementError,
  NoOpenGameError,
  NotBankerError,
  RoomNotFoundError,
} from '@/domain/errors';
import { EndGame, joinNetsToUsers } from './end-game';

class FakeRoomRepository implements RoomRepository {
  private readonly roomsById = new Map<string, Room>();
  private readonly membersByRoom = new Map<string, RoomMemberRecord[]>();
  readonly statusUpdates: { roomId: string; status: RoomStatus }[] = [];

  seedRoom(room: Room, members: RoomMemberRecord[]): void {
    this.roomsById.set(room.id, room);
    this.membersByRoom.set(room.id, members);
  }

  async create(room: Room): Promise<Room> {
    return room;
  }
  async findById(id: string): Promise<Room | null> {
    return this.roomsById.get(id) ?? null;
  }
  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    this.statusUpdates.push({ roomId: id, status });
    const room = this.roomsById.get(id);
    if (room) this.roomsById.set(id, { ...room, status });
  }
  async addMember(): Promise<RoomMemberRecord> {
    throw new Error('not used');
  }
  async removeMember(): Promise<void> {}
  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.membersByRoom.get(roomId) ?? [])];
  }
  async listRoomsForUser(): Promise<UserRoomMembership[]> {
    return [];
  }
  async updateMemberChips(): Promise<void> {}
  async addMemberFunding(): Promise<void> {}
  async setMemberSittingOut(): Promise<void> {}
}

class FakeHandStore implements HandStore {
  private hand: Hand | null = null;
  setHand(hand: Hand | null): void {
    this.hand = hand;
  }
  async get(): Promise<Hand | null> {
    return this.hand;
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
}

class FakeGameRepository implements GameRepository {
  private open: GameRecord | null = null;
  readonly endedIds: string[] = [];

  setOpenGame(game: GameRecord | null): void {
    this.open = game;
  }
  async create(roomId: string): Promise<GameRecord> {
    const game: GameRecord = {
      id: 'game-1',
      roomId,
      startedAt: new Date(0),
      endedAt: null,
    };
    this.open = game;
    return game;
  }
  async findById(): Promise<GameRecord | null> {
    return this.open;
  }
  async findOpenByRoom(): Promise<GameRecord | null> {
    return this.open;
  }
  async end(id: string): Promise<void> {
    this.endedIds.push(id);
    this.open = null;
  }
  async saveHand(_input: SaveHandInput): Promise<{ id: string }> {
    return { id: 'h' };
  }
}

class FakeSettlementRepository implements SettlementRepository {
  readonly saved: { gameId: string; settlements: SettlementRecordInput[] }[] =
    [];
  async saveForGame(
    gameId: string,
    settlements: readonly SettlementRecordInput[],
  ): Promise<void> {
    this.saved.push({ gameId, settlements: [...settlements] });
  }
  async listForUser(): Promise<UserGameSettlement[]> {
    return [];
  }
}

const OPEN_GAME: GameRecord = {
  id: 'game-1',
  roomId: 'r1',
  startedAt: new Date(0),
  endedAt: null,
};

function member(
  userId: string,
  seat: number,
  chips: number,
  buyInTotal: number,
): RoomMemberRecord {
  return {
    userId,
    username: userId,
    seat,
    chips,
    buyInTotal,
    sittingOut: false,
  };
}

function settledHand(): Hand {
  return { status: 'settled' } as unknown as Hand;
}

let rooms: FakeRoomRepository;
let hands: FakeHandStore;
let games: FakeGameRepository;
let settlements: FakeSettlementRepository;

const room = createRoom({
  id: 'r1',
  name: 'Table',
  bankerId: 'banker',
  settings: { smallBlind: 5, bigBlind: 10 },
});

beforeEach(() => {
  rooms = new FakeRoomRepository();
  hands = new FakeHandStore();
  games = new FakeGameRepository();
  settlements = new FakeSettlementRepository();
  games.setOpenGame(OPEN_GAME);
});

function endGame(): EndGame {
  return new EndGame(rooms, hands, games, settlements);
}

describe('EndGame', () => {
  it('derives net from the corrected member ledgers (chips - buyInTotal)', async () => {
    // Banker won 800 off the other player: zero-sum.
    rooms.seedRoom(room, [
      member('banker', 0, 1800, 1000),
      member('bob', 1, 0, 800),
    ]);

    const result = await endGame().execute({
      roomId: 'r1',
      requesterId: 'banker',
    });

    expect(result.nets).toEqual([
      { seat: 0, userId: 'banker', net: 800 },
      { seat: 1, userId: 'bob', net: -800 },
    ]);
    expect(result.gameId).toBe('game-1');
    expect(result.rake).toBe(0);
  });

  it('persists one settlement row per member for the open game', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1800, 1000),
      member('bob', 1, 0, 800),
    ]);

    await endGame().execute({ roomId: 'r1', requesterId: 'banker' });

    expect(settlements.saved).toHaveLength(1);
    expect(settlements.saved[0]).toEqual({
      gameId: 'game-1',
      settlements: [
        { userId: 'banker', net: 800 },
        { userId: 'bob', net: -800 },
      ],
    });
  });

  it('closes the game and marks the room ended', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1800, 1000),
      member('bob', 1, 0, 800),
    ]);

    await endGame().execute({ roomId: 'r1', requesterId: 'banker' });

    expect(games.endedIds).toEqual(['game-1']);
    expect(rooms.statusUpdates).toContainEqual({
      roomId: 'r1',
      status: 'ended',
    });
  });

  it('rejects a non-banker', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1000, 1000),
      member('bob', 1, 1000, 1000),
    ]);

    await expect(
      endGame().execute({ roomId: 'r1', requesterId: 'bob' }),
    ).rejects.toThrow(NotBankerError);
    expect(settlements.saved).toHaveLength(0);
    expect(games.endedIds).toEqual([]);
  });

  it('rejects when the room does not exist', async () => {
    await expect(
      endGame().execute({ roomId: 'missing', requesterId: 'banker' }),
    ).rejects.toThrow(RoomNotFoundError);
  });

  it('rejects when there is no open game for the room', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1000, 1000),
      member('bob', 1, 1000, 1000),
    ]);
    games.setOpenGame(null);

    await expect(
      endGame().execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(NoOpenGameError);
  });

  it('rejects while a hand is in play (not settled)', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1000, 1000),
      member('bob', 1, 1000, 1000),
    ]);
    hands.setHand({ status: 'betting' } as unknown as Hand);

    await expect(
      endGame().execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(HandInProgressError);
    expect(games.endedIds).toEqual([]);
  });

  it('allows ending when the last hand is settled', async () => {
    rooms.seedRoom(room, [
      member('banker', 0, 1200, 1000),
      member('bob', 1, 800, 1000),
    ]);
    hands.setHand(settledHand());

    const result = await endGame().execute({
      roomId: 'r1',
      requesterId: 'banker',
    });

    expect(result.nets).toEqual([
      { seat: 0, userId: 'banker', net: 200 },
      { seat: 1, userId: 'bob', net: -200 },
    ]);
  });

  it('throws on non-zero-sum ledgers and persists nothing', async () => {
    // +100 and -50 sum to +50: chips were not conserved.
    rooms.seedRoom(room, [
      member('banker', 0, 200, 100),
      member('bob', 1, 50, 100),
    ]);

    await expect(
      endGame().execute({ roomId: 'r1', requesterId: 'banker' }),
    ).rejects.toThrow(InvalidSettlementError);
    expect(settlements.saved).toHaveLength(0);
    expect(games.endedIds).toEqual([]);
  });
});

describe('joinNetsToUsers', () => {
  it('joins each net back to its member userId', () => {
    expect(
      joinNetsToUsers(
        [
          { seat: 0, net: 500 },
          { seat: 1, net: -500 },
        ],
        [
          { seat: 0, userId: 'alice' },
          { seat: 1, userId: 'bob' },
        ],
      ),
    ).toEqual([
      { seat: 0, userId: 'alice', net: 500 },
      { seat: 1, userId: 'bob', net: -500 },
    ]);
  });

  it('throws a typed error when a net seat has no member', () => {
    expect(() =>
      joinNetsToUsers([{ seat: 5, net: 100 }], [{ seat: 0, userId: 'alice' }]),
    ).toThrow(InvalidSettlementError);
  });
});
