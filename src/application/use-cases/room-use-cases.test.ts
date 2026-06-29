import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AddMemberInput,
  HandStore,
  RoomMemberRecord,
  RoomRepository,
  UserRoomMembership,
} from '@/application/ports';
import {
  AlreadyInRoomError,
  BankerCannotLeaveError,
  CannotLeaveMidHandError,
  ForbiddenActionError,
  NotRoomMemberError,
  RoomFullError,
  RoomNotFoundError,
} from '@/domain/errors';
import {
  createHand,
  MAX_SEATS,
  type Hand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import { CreateRoom } from './create-room';
import { JoinRoom } from './join-room';
import { LeaveRoom } from './leave-room';
import { ListUserRooms } from './list-user-rooms';
import { SitIn, SitOut } from './presence';

class FakeRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<string, RoomMemberRecord[]>();
  readonly usernames: Record<string, string> = {};

  async create(room: Room): Promise<Room> {
    this.rooms.set(room.id, room);
    this.members.set(room.id, []);
    return room;
  }

  async findById(id: string): Promise<Room | null> {
    return this.rooms.get(id) ?? null;
  }

  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    const room = this.rooms.get(id);
    if (room !== undefined) this.rooms.set(id, { ...room, status });
  }

  async addMember(
    roomId: string,
    member: AddMemberInput,
  ): Promise<RoomMemberRecord> {
    const record: RoomMemberRecord = {
      userId: member.userId,
      username: this.usernames[member.userId] ?? member.userId,
      seat: member.seat,
      buyInTotal: member.buyInTotal,
      chips: member.chips,
      sittingOut: false,
    };
    const list = this.members.get(roomId) ?? [];
    list.push(record);
    this.members.set(roomId, list);
    return record;
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    const list = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      list.filter((m) => m.userId !== userId),
    );
  }

  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.members.get(roomId) ?? [])];
  }

  async listRoomsForUser(userId: string): Promise<UserRoomMembership[]> {
    const out: UserRoomMembership[] = [];
    for (const [roomId, members] of this.members) {
      if (!members.some((m) => m.userId === userId)) continue;
      const room = this.rooms.get(roomId);
      if (room === undefined) continue;
      out.push({ roomId, name: room.name, status: room.status });
    }
    return out;
  }

  async updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void> {
    const list = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      list.map((m) => (m.userId === userId ? { ...m, chips } : m)),
    );
  }

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

  async setMemberSittingOut(
    roomId: string,
    userId: string,
    sittingOut: boolean,
  ): Promise<void> {
    const list = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      list.map((m) => (m.userId === userId ? { ...m, sittingOut } : m)),
    );
  }
}

/** A hand store stub for LeaveRoom: reports an active (or no) hand. */
class FakeHandStore implements HandStore {
  constructor(private hand: Hand | null = null) {}
  setHand(hand: Hand | null): void {
    this.hand = hand;
  }
  async get(): Promise<Hand | null> {
    return this.hand;
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
}

const fakeIds = () => {
  let n = 0;
  return { generate: () => `id-${++n}` };
};

let repo: FakeRoomRepository;

beforeEach(() => {
  repo = new FakeRoomRepository();
  Object.assign(repo.usernames, { banker: 'bankerName', bob: 'bobName' });
});

describe('CreateRoom', () => {
  it('creates a room and seats the banker at seat 0', async () => {
    const snapshot = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    expect(snapshot.id).toBe('id-1');
    expect(snapshot.bankerId).toBe('banker');
    expect(snapshot.status).toBe('waiting');
    expect(snapshot.members).toEqual([
      {
        userId: 'banker',
        username: 'bankerName',
        seat: 0,
        chips: 0, // unfunded until the banker approves a chip request (4.15)
        buyInTotal: 0,
        sittingOut: false,
      },
    ]);
  });

  it('applies custom settings (validated by the domain)', async () => {
    const snapshot = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
      settings: { smallBlind: 5, bigBlind: 10 },
    });
    expect(snapshot.settings.bigBlind).toBe(10);
  });

  it('derives buy-in bounds (10x/20x BB) when the creator omits them', async () => {
    const snapshot = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
      settings: { smallBlind: 5, bigBlind: 10 },
    });
    expect(snapshot.settings.minBuyIn).toBe(100); // 10 * 10
    expect(snapshot.settings.maxBuyIn).toBe(200); // 20 * 10
  });

  it('derives buy-in bounds from the default BB when no settings are given', async () => {
    const snapshot = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    expect(snapshot.settings.minBuyIn).toBe(20); // 10 * default BB 2
    expect(snapshot.settings.maxBuyIn).toBe(40); // 20 * default BB 2
  });

  it('respects supplied buy-in bounds, including an explicit null maximum', async () => {
    const snapshot = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
      settings: { bigBlind: 10, minBuyIn: 300, maxBuyIn: null },
    });
    expect(snapshot.settings.minBuyIn).toBe(300);
    expect(snapshot.settings.maxBuyIn).toBeNull();
  });
});

describe('JoinRoom', () => {
  async function seededRoom(): Promise<string> {
    const snap = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    return snap.id;
  }

  it('seats a new member at the next free seat', async () => {
    const roomId = await seededRoom();
    const snap = await new JoinRoom(repo).execute({ userId: 'bob', roomId });
    expect(snap.members.map((m) => m.seat)).toEqual([0, 1]);
    const bob = snap.members.find((m) => m.userId === 'bob');
    expect(bob?.seat).toBe(1);
    // Players sit unfunded; the banker funds them via chip requests (4.15).
    expect(bob?.chips).toBe(0);
  });

  it('fills the lowest free seat (gaps first)', async () => {
    const roomId = await seededRoom();
    // banker at 0; manually occupy seat 2, leaving seat 1 free.
    await repo.addMember(roomId, {
      userId: 'x',
      seat: 2,
      buyInTotal: 0,
      chips: 0,
    });
    const snap = await new JoinRoom(repo).execute({ userId: 'bob', roomId });
    expect(snap.members.find((m) => m.userId === 'bob')?.seat).toBe(1);
  });

  it('throws RoomNotFound for an unknown room', async () => {
    await expect(
      new JoinRoom(repo).execute({ userId: 'bob', roomId: 'nope' }),
    ).rejects.toThrow(RoomNotFoundError);
  });

  it('throws AlreadyInRoom when the user is already a member', async () => {
    const roomId = await seededRoom();
    await expect(
      new JoinRoom(repo).execute({ userId: 'banker', roomId }),
    ).rejects.toThrow(AlreadyInRoomError);
  });

  it('throws RoomFull when every seat is taken', async () => {
    const roomId = await seededRoom();
    // banker occupies seat 0; fill the rest.
    for (let seat = 1; seat < MAX_SEATS; seat++) {
      await repo.addMember(roomId, {
        userId: `u${seat}`,
        seat,
        buyInTotal: 0,
        chips: 0,
      });
    }
    await expect(
      new JoinRoom(repo).execute({ userId: 'bob', roomId }),
    ).rejects.toThrow(RoomFullError);
  });
});

// A minimal live (unsettled) hand for the mid-hand leave guard.
function liveHand(roomId: string): Hand {
  return createHand({ id: 'h1', roomId, players: [], buttonSeat: 0 });
}

describe('LeaveRoom', () => {
  let hands: FakeHandStore;

  beforeEach(() => {
    hands = new FakeHandStore();
  });

  async function tableWithBob(): Promise<string> {
    const created = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    await new JoinRoom(repo).execute({ userId: 'bob', roomId: created.id });
    return created.id;
  }

  it('frees the seat when no hand is in progress', async () => {
    const roomId = await tableWithBob();
    const snap = await new LeaveRoom(repo, hands).execute({
      requesterId: 'bob',
      roomId,
    });
    expect(snap.members.map((m) => m.userId)).toEqual(['banker']);
  });

  it('rejects leaving mid-hand (a live hand exists)', async () => {
    const roomId = await tableWithBob();
    hands.setHand(liveHand(roomId));
    await expect(
      new LeaveRoom(repo, hands).execute({ requesterId: 'bob', roomId }),
    ).rejects.toThrow(CannotLeaveMidHandError);
    // The seat is untouched.
    expect((await repo.listMembers(roomId)).map((m) => m.userId)).toContain(
      'bob',
    );
  });

  it('allows leaving once the hand is settled', async () => {
    const roomId = await tableWithBob();
    hands.setHand({ ...liveHand(roomId), status: 'settled' });
    const snap = await new LeaveRoom(repo, hands).execute({
      requesterId: 'bob',
      roomId,
    });
    expect(snap.members.map((m) => m.userId)).toEqual(['banker']);
  });

  it('rejects the banker leaving mid-game (status playing)', async () => {
    const roomId = await tableWithBob();
    await repo.updateStatus(roomId, 'playing');
    await expect(
      new LeaveRoom(repo, hands).execute({ requesterId: 'banker', roomId }),
    ).rejects.toThrow(BankerCannotLeaveError);
  });

  it('lets the banker leave when the game is not running', async () => {
    const roomId = await tableWithBob();
    // status stays 'waiting'; no hand in play.
    const snap = await new LeaveRoom(repo, hands).execute({
      requesterId: 'banker',
      roomId,
    });
    expect(snap.members.map((m) => m.userId)).toEqual(['bob']);
  });

  it('rejects leaving on behalf of another user (IDOR)', async () => {
    const roomId = await tableWithBob();
    await expect(
      new LeaveRoom(repo, hands).execute({
        requesterId: 'bob',
        targetUserId: 'banker',
        roomId,
      }),
    ).rejects.toThrow(ForbiddenActionError);
  });

  it('throws NotRoomMember when the user is not a member', async () => {
    const roomId = await tableWithBob();
    await expect(
      new LeaveRoom(repo, hands).execute({ requesterId: 'ghost', roomId }),
    ).rejects.toThrow(NotRoomMemberError);
  });

  it('throws RoomNotFound for an unknown room', async () => {
    await expect(
      new LeaveRoom(repo, hands).execute({
        requesterId: 'bob',
        roomId: 'nope',
      }),
    ).rejects.toThrow(RoomNotFoundError);
  });
});

describe('SitOut / SitIn', () => {
  async function tableWithBob(): Promise<string> {
    const created = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    await new JoinRoom(repo).execute({ userId: 'bob', roomId: created.id });
    return created.id;
  }

  it('flags the requester as sitting out, then sitting in', async () => {
    const roomId = await tableWithBob();
    let snap = await new SitOut(repo).execute({ requesterId: 'bob', roomId });
    expect(snap.members.find((m) => m.userId === 'bob')?.sittingOut).toBe(true);
    // The banker is unaffected.
    expect(snap.members.find((m) => m.userId === 'banker')?.sittingOut).toBe(
      false,
    );

    snap = await new SitIn(repo).execute({ requesterId: 'bob', roomId });
    expect(snap.members.find((m) => m.userId === 'bob')?.sittingOut).toBe(
      false,
    );
  });

  it('rejects sitting out another user (IDOR)', async () => {
    const roomId = await tableWithBob();
    await expect(
      new SitOut(repo).execute({
        requesterId: 'bob',
        targetUserId: 'banker',
        roomId,
      }),
    ).rejects.toThrow(ForbiddenActionError);
  });

  it('throws NotRoomMember for a non-member', async () => {
    const roomId = await tableWithBob();
    await expect(
      new SitOut(repo).execute({ requesterId: 'ghost', roomId }),
    ).rejects.toThrow(NotRoomMemberError);
  });
});

describe('ListUserRooms', () => {
  it('returns the room a user belongs to', async () => {
    const created = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Friday game',
    });
    const rooms = await new ListUserRooms(repo).execute({ userId: 'banker' });
    expect(rooms).toEqual([
      { roomId: created.id, name: 'Friday game', status: 'waiting' },
    ]);
  });

  it('returns an empty array when the user is in no room', async () => {
    await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Friday game',
    });
    const rooms = await new ListUserRooms(repo).execute({ userId: 'nobody' });
    expect(rooms).toEqual([]);
  });

  it("returns only the requester's own rooms, never another user's (IDOR)", async () => {
    // banker owns table A; bob owns table B. Each must see only their own —
    // a user must never read a room they are not a member of. One shared id
    // generator so the two rooms get distinct ids (id-1, id-2).
    const ids = fakeIds();
    const a = await new CreateRoom(repo, ids).execute({
      bankerId: 'banker',
      name: 'A table',
    });
    const b = await new CreateRoom(repo, ids).execute({
      bankerId: 'bob',
      name: 'B table',
    });

    const bankerRooms = await new ListUserRooms(repo).execute({
      userId: 'banker',
    });
    const bobRooms = await new ListUserRooms(repo).execute({ userId: 'bob' });

    expect(bankerRooms.map((r) => r.roomId)).toEqual([a.id]);
    expect(bankerRooms.map((r) => r.roomId)).not.toContain(b.id);
    expect(bobRooms.map((r) => r.roomId)).toEqual([b.id]);
  });
});
