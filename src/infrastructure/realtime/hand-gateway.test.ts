import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HandStore,
  RoomMemberRecord,
  RoomRepository,
  UserRoomMembership,
} from '@/application/ports';
import {
  AdvanceStreet,
  PlayerAct,
  RequestTimeExtension,
  SettleHand,
  StartHand,
} from '@/application/use-cases';
import {
  createRoom,
  type Hand,
  type Room,
  type RoomStatus,
} from '@/domain/entities';
import { TIME_EXTENSION_MS } from '@/domain/engine';
import { HandGateway } from './hand-gateway';
import type { AppServer } from './socket-auth';

// Minimal room repository: only what the hand use-cases and the gateway touch.
class FakeRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();
  private readonly members = new Map<string, RoomMemberRecord[]>();

  seed(room: Room, members: RoomMemberRecord[]): void {
    this.rooms.set(room.id, room);
    this.members.set(room.id, members);
  }

  async create(room: Room): Promise<Room> {
    this.rooms.set(room.id, room);
    return room;
  }
  async findById(id: string): Promise<Room | null> {
    return this.rooms.get(id) ?? null;
  }
  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    const r = this.rooms.get(id);
    if (r) this.rooms.set(id, { ...r, status });
  }
  async addMember(): Promise<RoomMemberRecord> {
    throw new Error('unused');
  }
  async removeMember(): Promise<void> {}
  async listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return [...(this.members.get(roomId) ?? [])];
  }
  async listRoomsForUser(): Promise<UserRoomMembership[]> {
    return [];
  }
  async updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void> {
    const l = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      l.map((m) => (m.userId === userId ? { ...m, chips } : m)),
    );
  }
  async addMemberFunding(): Promise<void> {}
  async setMemberSittingOut(
    roomId: string,
    userId: string,
    sittingOut: boolean,
  ): Promise<void> {
    const l = this.members.get(roomId) ?? [];
    this.members.set(
      roomId,
      l.map((m) => (m.userId === userId ? { ...m, sittingOut } : m)),
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

// The gateway only broadcasts through io.to(room).emit(...); swallow it.
const noopIo = {
  to: () => ({ emit: () => undefined }),
} as unknown as AppServer;

const clock = { now: () => 1000 };
const ids = () => {
  let n = 0;
  return { generate: () => `h${++n}` };
};

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

const room = createRoom({
  id: 'r1',
  name: 'Table',
  bankerId: 'alice',
  settings: { smallBlind: 5, bigBlind: 10 },
});

let rooms: FakeRoomRepository;
let store: FakeHandStore;
let gateway: HandGateway;

beforeEach(() => {
  // Freeze time so the normal turn timer is armed far in the future and never
  // fires during a test — isolating the *immediate* sitting-out resolution.
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  rooms = new FakeRoomRepository();
  store = new FakeHandStore();
  gateway = new HandGateway(
    noopIo,
    new StartHand(rooms, store, ids(), clock),
    new PlayerAct(rooms, store, clock),
    new AdvanceStreet(rooms, store, clock),
    new SettleHand(rooms, store),
    new RequestTimeExtension(store, clock),
    store,
    rooms,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Three-handed table, blinds 5/10. After start: button=seat0, SB=seat1 (bob, 5),
 * BB=seat2 (carol, 10), first to act preflop = seat0 (alice), currentBet=10.
 */
async function startThreeHanded(): Promise<void> {
  rooms.seed(room, [
    member('alice', 0, 100),
    member('bob', 1, 100),
    member('carol', 2, 100),
  ]);
  await gateway.start('r1', 'alice');
}

describe('HandGateway — sitting-out turns (task 4.14 mid-hand refinement)', () => {
  it('reversible: sit out then sit back in before your turn → you act normally', async () => {
    await startThreeHanded();
    await rooms.setMemberSittingOut('r1', 'bob', true);
    await rooms.setMemberSittingOut('r1', 'bob', false); // changed their mind

    await gateway.act('r1', 'alice', { type: 'CALL' }); // turn passes to bob

    const hand = await store.get('r1');
    expect(hand?.actingSeat).toBe(1); // the table waits on bob — not auto-resolved
    expect(hand?.status).toBe('betting');
    expect(hand?.players.find((p) => p.seat === 1)?.state).toBe('active');
    expect(hand?.players.find((p) => p.seat === 1)?.hasActedThisStreet).toBe(
      false,
    );
  });

  it('turn with chips owed → auto-folds, the turn moves on, and stays out next hand', async () => {
    await startThreeHanded();
    await rooms.setMemberSittingOut('r1', 'bob', true); // bob (SB) owes 5 to call

    await gateway.act('r1', 'alice', { type: 'CALL' });

    const hand = await store.get('r1');
    // bob's turn resolved immediately via the normal fold path…
    expect(hand?.players.find((p) => p.seat === 1)?.state).toBe('folded');
    // …and the turn did NOT hang on bob — it advanced to carol.
    expect(hand?.actingSeat).toBe(2);
    // sittingOut stays set, so StartHand excludes bob from the next deal.
    const members = await rooms.listMembers('r1');
    expect(members.find((m) => m.userId === 'bob')?.sittingOut).toBe(true);
  });

  it('turn with nothing owed → auto-checks and stays in the current hand', async () => {
    await startThreeHanded();
    await rooms.setMemberSittingOut('r1', 'carol', true); // carol is the BB

    await gateway.act('r1', 'alice', { type: 'CALL' }); // → bob to act
    await gateway.act('r1', 'bob', { type: 'CALL' }); // → carol (BB) auto-checks

    const hand = await store.get('r1');
    // carol stayed in the hand (a check keeps her eligible)…
    expect(hand?.players.find((p) => p.seat === 2)?.state).toBe('active');
    // …the street closed without hanging on her.
    expect(hand?.actingSeat).toBeNull();
    expect(hand?.status).toBe('awaiting_street');
    // still sitting out → excluded from the next hand's deal.
    const members = await rooms.listMembers('r1');
    expect(members.find((m) => m.userId === 'carol')?.sittingOut).toBe(true);
  });

  it('never hangs: consecutive sitting-out seats all resolve in one pass', async () => {
    await startThreeHanded();
    await rooms.setMemberSittingOut('r1', 'bob', true);
    await rooms.setMemberSittingOut('r1', 'carol', true);

    await gateway.act('r1', 'alice', { type: 'CALL' });

    const hand = await store.get('r1');
    expect(hand?.players.find((p) => p.seat === 1)?.state).toBe('folded'); // bob owed 5
    expect(hand?.players.find((p) => p.seat === 2)?.state).toBe('active'); // carol checked
    // No turn left stranded on a sitting-out seat.
    expect(hand?.actingSeat).toBeNull();
    expect(hand?.status).toBe('awaiting_street');
  });
});

describe('HandGateway — time bank (task 4.12)', () => {
  it('reschedules the auto-action to the new deadline; the old timer never fires', async () => {
    await startThreeHanded();
    const before = await store.get('r1');
    const d0 = before?.actionDeadline ?? 0;
    expect(before?.actingSeat).toBe(0); // alice to act

    await gateway.requestTime('r1', 'alice');

    const extended = await store.get('r1');
    expect(extended?.actionDeadline).toBe(d0 + TIME_EXTENSION_MS);
    expect(
      extended?.players.find((p) => p.seat === 0)?.timeExtensionsRemaining,
    ).toBe(1);
    expect(extended?.actingSeat).toBe(0); // still alice's turn

    // Advance to the ORIGINAL deadline: the old timer was cleared on reschedule,
    // so nothing fires — alice is still up. This is the race-condition guard.
    await vi.advanceTimersByTimeAsync(d0 - Date.now());
    let hand = await store.get('r1');
    expect(hand?.actingSeat).toBe(0);
    expect(hand?.status).toBe('betting');

    // Past the NEW deadline: the rescheduled auto-action fires and the turn moves.
    await vi.advanceTimersByTimeAsync(TIME_EXTENSION_MS);
    hand = await store.get('r1');
    expect(hand?.players.find((p) => p.seat === 0)?.state).toBe('folded'); // alice owed the BB
    expect(hand?.actingSeat).not.toBe(0);
  });

  it('rejects a non-acting player (only the acting seat can extend)', async () => {
    await startThreeHanded(); // alice (seat 0) is acting
    await expect(gateway.requestTime('r1', 'bob')).rejects.toThrow();
    // bob's request changed nothing.
    const hand = await store.get('r1');
    expect(
      hand?.players.find((p) => p.seat === 1)?.timeExtensionsRemaining,
    ).toBe(2);
  });
});
