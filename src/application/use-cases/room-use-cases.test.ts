import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AddMemberInput,
  RoomMemberRecord,
  RoomRepository,
} from '@/application/ports';
import {
  AlreadyInRoomError,
  NotRoomMemberError,
  RoomFullError,
  RoomNotFoundError,
} from '@/domain/errors';
import { MAX_SEATS, type Room, type RoomStatus } from '@/domain/entities';
import { CreateRoom } from './create-room';
import { JoinRoom } from './join-room';
import { LeaveRoom } from './leave-room';

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
        chips: 0,
        buyInTotal: 0,
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
    expect(snap.members.find((m) => m.userId === 'bob')?.seat).toBe(1);
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

describe('LeaveRoom', () => {
  it('removes the member and returns the remaining snapshot', async () => {
    const created = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    await new JoinRoom(repo).execute({ userId: 'bob', roomId: created.id });

    const snap = await new LeaveRoom(repo).execute({
      userId: 'bob',
      roomId: created.id,
    });
    expect(snap.members.map((m) => m.userId)).toEqual(['banker']);
  });

  it('throws NotRoomMember when the user is not a member', async () => {
    const created = await new CreateRoom(repo, fakeIds()).execute({
      bankerId: 'banker',
      name: 'Table',
    });
    await expect(
      new LeaveRoom(repo).execute({ userId: 'ghost', roomId: created.id }),
    ).rejects.toThrow(NotRoomMemberError);
  });

  it('throws RoomNotFound for an unknown room', async () => {
    await expect(
      new LeaveRoom(repo).execute({ userId: 'bob', roomId: 'nope' }),
    ).rejects.toThrow(RoomNotFoundError);
  });
});
