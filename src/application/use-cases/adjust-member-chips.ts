import type { HandStore, RoomRepository } from '@/application/ports';
import { isBanker, validateFundingCeiling } from '@/domain/entities';
import {
  HandInProgressError,
  InsufficientChipsError,
  InvalidChipsAmountError,
  NotBankerError,
  NotRoomMemberError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface AdjustMemberChipsInput {
  readonly roomId: string;
  /** The acting user — always the authenticated session user, never the payload. */
  readonly requesterId: string;
  /**
   * The seat of the member whose chips are adjusted (from the banker's payload).
   * Targeting is by seat, not userId: the public projection never exposes raw
   * userIds, so seat is the only member identifier the client has; it is resolved
   * to the member server-side here.
   */
  readonly targetSeat: number;
  /** Signed delta: positive = buy-in/top-up, negative = correction/cash-out. */
  readonly amount: number;
}

export interface AdjustMemberChipsResult {
  /** The room after the member's chips + buyInTotal move in lockstep. */
  readonly snapshot: RoomSnapshot;
}

/**
 * The banker directly adjusts a member's chips (task 6.7): a banker-initiated
 * buy-in (positive) or a correction / cash-out (negative). The sibling of the
 * player-requested 4.15 flow, but banker-initiated.
 *
 * Chips and `buyInTotal` move in **lockstep** (signed `addMemberFunding`), so the
 * member's net (`chips - buyInTotal`) is unchanged and the end-of-game zero-sum
 * invariant (`computeNetSettlement`) holds. This is a buy-in/cash-out correction,
 * NOT a net-changing penalty/bonus — those are deliberately out of scope.
 *
 * Server-authoritative: only the banker may adjust, and only between hands (a
 * mid-hand change to RoomMember.chips would not reach the live hand and would be
 * clobbered by settlement). Both floors are guarded so a decrease can drive
 * neither chips nor buyInTotal below zero (which would corrupt net).
 */
export class AdjustMemberChips {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    roomId,
    requesterId,
    targetSeat,
    amount,
  }: AdjustMemberChipsInput): Promise<AdjustMemberChipsResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    // Between-hands only (mirrors EndGame): a live, unsettled hand blocks the
    // adjustment so it cannot be silently overwritten by settlement.
    const hand = await this.hands.get(roomId);
    if (hand !== null && hand.status !== 'settled') {
      throw new HandInProgressError(roomId);
    }

    // A signed, nonzero whole number of chips (sign carries the direction).
    if (!Number.isInteger(amount) || amount === 0) {
      throw new InvalidChipsAmountError(amount);
    }

    const members = await this.rooms.listMembers(roomId);
    const member = members.find((m) => m.seat === targetSeat);
    if (member === undefined) throw new NotRoomMemberError(roomId);

    // A decrease must not drive either field below zero — both feed net, so
    // letting buyInTotal go negative would corrupt the zero-sum settlement too.
    if (member.chips + amount < 0) {
      throw new InsufficientChipsError(member.chips, -amount);
    }
    if (member.buyInTotal + amount < 0) {
      throw new InsufficientChipsError(member.buyInTotal, -amount);
    }

    // Cumulative ceiling: a positive adjust may not push chips or the unbounded
    // buyInTotal accumulator past MAX_CHIP_TOTAL, the technical precision-safe
    // limit (a negative adjust is a no-op).
    validateFundingCeiling(member.chips, member.buyInTotal, amount);

    // Lockstep: positive credits both, negative debits both — net is preserved.
    await this.rooms.addMemberFunding(roomId, member.userId, amount);

    const updated = await this.rooms.listMembers(roomId);
    return { snapshot: toRoomSnapshot(room, updated) };
  }
}
