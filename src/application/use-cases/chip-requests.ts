import type {
  ChipRequest,
  ChipRequestStore,
  Clock,
  IdGenerator,
  RoomRepository,
} from '@/application/ports';
import {
  isBanker,
  validateBuyInRequest,
  validateFundingCeiling,
} from '@/domain/entities';
import {
  BuyInLimitError,
  ChipRequestNotFoundError,
  ChipRequestPendingError,
  InvalidChipsAmountError,
  NotBankerError,
  NotRoomMemberError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface RequestChipsInput {
  readonly roomId: string;
  readonly userId: string;
  readonly amount: number;
}

/**
 * A seated player requests a buy-in. The chips are NOT granted here — the
 * request joins a queue the banker approves. One pending request per player.
 *
 * Returns the room's full pending queue so the gateway can broadcast it.
 */
export class RequestChips {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly requests: ChipRequestStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({
    roomId,
    userId,
    amount,
  }: RequestChipsInput): Promise<ChipRequest[]> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    // A buy-in must be a positive whole number of chips.
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidChipsAmountError(amount);
    }

    const members = await this.rooms.listMembers(roomId);
    const member = members.find((m) => m.userId === userId);
    if (member === undefined) throw new NotRoomMemberError(roomId);

    if (await this.requests.hasPending(roomId, userId)) {
      throw new ChipRequestPendingError();
    }

    // Enforce the table's buy-in limits against the member's current stack
    // (requests happen between hands, so chips is authoritative here).
    const limit = validateBuyInRequest({
      currentChips: member.chips,
      minBuyIn: room.settings.minBuyIn,
      maxBuyIn: room.settings.maxBuyIn,
      amount,
    });
    if (!limit.ok) throw new BuyInLimitError(limit.reason);

    await this.requests.add({
      id: this.ids.generate(),
      roomId,
      userId,
      seat: member.seat,
      username: member.username,
      amount,
      createdAt: this.clock.now(),
    });
    return this.requests.listByRoom(roomId);
  }
}

export interface ApproveChipRequestInput {
  readonly roomId: string;
  readonly requesterId: string;
  readonly requestId: string;
}

export interface ApproveChipRequestResult {
  /** The room after the buy-in is credited to the member's stack. */
  readonly snapshot: RoomSnapshot;
  /** The remaining pending queue. */
  readonly requests: ChipRequest[];
}

/**
 * The banker approves a chip request: the amount is added to the member's stack
 * and their cumulative `buyInTotal` (for net settlement), then the request is
 * cleared. Server-authoritative: only the banker may approve.
 */
export class ApproveChipRequest {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly requests: ChipRequestStore,
  ) {}

  async execute({
    roomId,
    requesterId,
    requestId,
  }: ApproveChipRequestInput): Promise<ApproveChipRequestResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const request = await this.requests.get(requestId);
    if (request === null || request.roomId !== roomId) {
      throw new ChipRequestNotFoundError(requestId);
    }

    // Re-validate against the member's CURRENT stack: the banker may have
    // adjusted chips (task 6.7) between the request and this approval, so the
    // limit must hold at the moment chips actually move — before funding.
    const members = await this.rooms.listMembers(roomId);
    const member = members.find((m) => m.userId === request.userId);
    if (member === undefined) throw new NotRoomMemberError(roomId);
    const limit = validateBuyInRequest({
      currentChips: member.chips,
      minBuyIn: room.settings.minBuyIn,
      maxBuyIn: room.settings.maxBuyIn,
      amount: request.amount,
    });
    if (!limit.ok) throw new BuyInLimitError(limit.reason);

    // Cumulative ceiling: neither chips nor the unbounded buyInTotal accumulator
    // may overflow past MAX_CHIP_AMOUNT once this funding is applied.
    validateFundingCeiling(member.chips, member.buyInTotal, request.amount);

    await this.rooms.addMemberFunding(roomId, request.userId, request.amount);
    await this.requests.remove(requestId);

    const updatedMembers = await this.rooms.listMembers(roomId);
    return {
      snapshot: toRoomSnapshot(room, updatedMembers),
      requests: await this.requests.listByRoom(roomId),
    };
  }
}

export interface RejectChipRequestInput {
  readonly roomId: string;
  readonly requesterId: string;
  readonly requestId: string;
}

/** The banker rejects (discards) a chip request without granting chips. */
export class RejectChipRequest {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly requests: ChipRequestStore,
  ) {}

  async execute({
    roomId,
    requesterId,
    requestId,
  }: RejectChipRequestInput): Promise<ChipRequest[]> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);
    if (!isBanker(room, requesterId)) throw new NotBankerError(requesterId);

    const request = await this.requests.get(requestId);
    if (request === null || request.roomId !== roomId) {
      throw new ChipRequestNotFoundError(requestId);
    }
    await this.requests.remove(requestId);
    return this.requests.listByRoom(roomId);
  }
}
