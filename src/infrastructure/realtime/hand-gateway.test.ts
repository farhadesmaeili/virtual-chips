import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  AdvanceStreet,
  EndGame,
  PlayerAct,
  RecordClaim,
  RequestTimeExtension,
  ResetHand,
  SettleHand,
  StartHand,
} from '@/application/use-cases';
import { NotBankerError } from '@/domain/errors';
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

// Minimal game store: StartHand opens one game per room (lazy-on-first-hand).
// The gateway tests don't assert on games, so this just satisfies the port.
class FakeGameRepository implements GameRepository {
  private readonly byRoom = new Map<string, GameRecord>();
  async create(roomId: string): Promise<GameRecord> {
    const game: GameRecord = {
      id: `g-${roomId}`,
      roomId,
      startedAt: new Date(0),
      endedAt: null,
    };
    this.byRoom.set(roomId, game);
    return game;
  }
  async findById(): Promise<GameRecord | null> {
    return null;
  }
  async findOpenByRoom(roomId: string): Promise<GameRecord | null> {
    return this.byRoom.get(roomId) ?? null;
  }
  async end(): Promise<void> {}
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

// The gateway only broadcasts through io.to(room).emit(...); swallow it.
const noopIo = {
  to: () => ({ emit: () => undefined }),
} as unknown as AppServer;

/** Records every io.to(room).emit(event, payload) for assertions. */
interface Emission {
  readonly room: string;
  readonly event: string;
  readonly payload: unknown;
}
function recordingIo(): { io: AppServer; emissions: Emission[] } {
  const emissions: Emission[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) =>
        emissions.push({ room, event, payload }),
    }),
  } as unknown as AppServer;
  return { io, emissions };
}

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
let games: FakeGameRepository;
let settlements: FakeSettlementRepository;
let gateway: HandGateway;

beforeEach(() => {
  // Freeze time so the normal turn timer is armed far in the future and never
  // fires during a test — isolating the *immediate* sitting-out resolution.
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  rooms = new FakeRoomRepository();
  store = new FakeHandStore();
  games = new FakeGameRepository();
  settlements = new FakeSettlementRepository();
  gateway = new HandGateway(
    noopIo,
    new StartHand(rooms, store, ids(), clock, games),
    new PlayerAct(rooms, store, clock),
    new AdvanceStreet(rooms, store, clock),
    new ResetHand(rooms, store, ids(), clock),
    new SettleHand(rooms, store),
    new RecordClaim(rooms, store),
    new RequestTimeExtension(store, clock),
    new EndGame(rooms, store, games, settlements),
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

describe('HandGateway — endGame (6.2)', () => {
  // alice won 500 off bob over the game; zero-sum (chips - buyInTotal).
  function seedEndable(): void {
    rooms.seed(room, [
      { userId: 'alice', username: 'alice', seat: 0, chips: 1500, buyInTotal: 1000, sittingOut: false }, // prettier-ignore
      { userId: 'bob', username: 'bob', seat: 1, chips: 500, buyInTotal: 1000, sittingOut: false }, // prettier-ignore
    ]);
  }

  function endGameGateway(io: AppServer): HandGateway {
    return new HandGateway(
      io,
      new StartHand(rooms, store, ids(), clock, games),
      new PlayerAct(rooms, store, clock),
      new AdvanceStreet(rooms, store, clock),
      new ResetHand(rooms, store, ids(), clock),
      new SettleHand(rooms, store),
      new RecordClaim(rooms, store),
      new RequestTimeExtension(store, clock),
      new EndGame(rooms, store, games, settlements),
      store,
      rooms,
    );
  }

  it('emits a projected game:ended (seat + net only, no userId) and a fresh ended room:state', async () => {
    seedEndable();
    await games.create('r1'); // open a game; no live hand → endable

    const { io, emissions } = recordingIo();
    await endGameGateway(io).endGame('r1', 'alice');

    const ended = emissions.find((e) => e.event === 'game:ended');
    expect(ended?.payload).toEqual({
      nets: [
        { seat: 0, net: 500 },
        { seat: 1, net: -500 },
      ],
      rake: 0,
    });
    // No raw userId may leak in the broadcast.
    const payload = ended?.payload as { nets: Record<string, unknown>[] };
    for (const n of payload.nets) {
      expect(Object.keys(n).sort()).toEqual(['net', 'seat']);
    }

    const roomState = emissions.find((e) => e.event === 'room:state');
    expect((roomState?.payload as { status: string }).status).toBe('ended');
  });

  it('cancels the turn timer and deletes the hand snapshot on success', async () => {
    seedEndable();
    await games.create('r1');
    // A settled snapshot lingers in the store; end-game must delete it so a
    // reconnect resync returns no stale hand.
    await store.save('r1', { status: 'settled' } as unknown as Hand);

    const gw = endGameGateway(noopIo);
    const timerClear = vi.spyOn(gw, 'clear');
    const handsClear = vi.spyOn(store, 'clear');

    await gw.endGame('r1', 'alice');

    expect(timerClear).toHaveBeenCalledWith('r1');
    expect(handsClear).toHaveBeenCalledWith('r1');
    expect(await store.get('r1')).toBeNull();
  });

  it('rejects a non-banker and changes nothing', async () => {
    seedEndable();
    await games.create('r1');

    const { io, emissions } = recordingIo();
    await expect(endGameGateway(io).endGame('r1', 'bob')).rejects.toThrow(
      NotBankerError,
    );
    expect(emissions).toHaveLength(0);
    expect(settlements.saved).toHaveLength(0);
  });
});
