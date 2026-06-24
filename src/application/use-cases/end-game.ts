import type {
  GameRepository,
  HandStore,
  RoomRepository,
  SettlementRepository,
} from '@/application/ports';
import { isBanker, withStatus } from '@/domain/entities';
import {
  computeNetSettlement,
  type NetResult,
  type PlayerLedger,
} from '@/domain/engine';
import {
  HandInProgressError,
  InvalidSettlementError,
  NoOpenGameError,
  NotBankerError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface EndGameInput {
  readonly roomId: string;
  readonly requesterId: string;
}

/** A player's end-of-game net result (positive = win, negative = loss). */
export interface NetResultEntry {
  readonly seat: number;
  readonly userId: string;
  readonly net: number;
}

/** The seat → user lookup `joinNetsToUsers` needs (a subset of a member). */
export interface SeatUser {
  readonly seat: number;
  readonly userId: string;
}

/**
 * Joins each net result back to its member's userId. Throws
 * {@link InvalidSettlementError} if a seat has no member — an invariant
 * violation (nets derive from the same members) that this guards defensively now
 * that the path runs live.
 */
export function joinNetsToUsers(
  nets: readonly NetResult[],
  members: readonly SeatUser[],
): NetResultEntry[] {
  const seatToUser = new Map(members.map((m) => [m.seat, m.userId]));
  return nets.map((n) => {
    const userId = seatToUser.get(n.seat);
    if (userId === undefined) {
      throw new InvalidSettlementError(`no member found for seat ${n.seat}`);
    }
    return { seat: n.seat, userId, net: n.net };
  });
}

export interface EndGameResult {
  /** The game that was closed. */
  readonly gameId: string;
  /** Net per player, ready for broadcast (PR3) and already persisted. */
  readonly nets: readonly NetResultEntry[];
  /** Rake removed from play (0 until rake is configurable). */
  readonly rake: number;
  /** The room after it is marked ended, for the fresh `room:state` broadcast. */
  readonly snapshot: RoomSnapshot;
}

/**
 * Ends the room's current game: derives each player's net result, persists the
 * settlement, closes the Game and marks the room ended.
 *
 * Single source of truth: net is computed purely (`computeNetSettlement`) from
 * the corrected, persisted RoomMember ledgers — `chips` (post-settlement) minus
 * `buyInTotal` — the same ledgers projection reads. There is no parallel
 * recompute of chips here; settlement is just a read of that one source. The
 * persisted Settlement rows are what the history feature (6.3) will later read.
 *
 * Server-authoritative: only the banker may end the game. End-game is only
 * allowed between hands — any in-flight hand must settle first.
 */
export class EndGame {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
    private readonly games: GameRepository,
    private readonly settlements: SettlementRepository,
  ) {}

  async execute({ roomId, requesterId }: EndGameInput): Promise<EndGameResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const game = await this.games.findOpenByRoom(roomId);
    if (game === null) throw new NoOpenGameError(roomId);

    // A hand mid-flight must settle before the game can close, so end-game never
    // races an unsettled pot. A settled (or absent) hand is fine.
    const hand = await this.hands.get(roomId);
    if (hand !== null && hand.status !== 'settled') {
      throw new HandInProgressError(roomId);
    }

    const members = await this.rooms.listMembers(roomId);
    const ledgers: PlayerLedger[] = members.map((m) => ({
      seat: m.seat,
      currentChips: m.chips,
      totalBuyIn: m.buyInTotal,
    }));

    // Throws InvalidSettlementError if the ledgers are not zero-sum (minus
    // rake) — we never persist inconsistent ledgers. Rake is 0 for now.
    const { nets, rake } = computeNetSettlement(ledgers);

    const enriched = joinNetsToUsers(nets, members);

    await this.settlements.saveForGame(
      game.id,
      enriched.map((n) => ({ userId: n.userId, net: n.net })),
    );
    await this.games.end(game.id);
    await this.rooms.updateStatus(roomId, 'ended');

    const snapshot = toRoomSnapshot(withStatus(room, 'ended'), members);
    return { gameId: game.id, nets: enriched, rake, snapshot };
  }
}
