import type { HandStore, RoomRepository } from '@/application/ports';
import { isBanker } from '@/domain/entities';
import {
  BankerCannotLeaveError,
  CannotLeaveMidHandError,
  ForbiddenActionError,
  NotRoomMemberError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface LeaveRoomInput {
  /** The authenticated session user — the only user that may leave. */
  readonly requesterId: string;
  readonly roomId: string;
  /** Optional payload target; must equal `requesterId` (IDOR guard). */
  readonly targetUserId?: string;
}

/**
 * Removes a member from a room, freeing their seat (task 4.14).
 *
 * Guards (server-authoritative):
 * - Self-only: a user may only leave themselves; a mismatched payload target is
 *   rejected.
 * - No leaving mid-hand: while a hand is in progress a seat cannot be vacated.
 *   A player may fold and stay; the seat frees between hands.
 * - The banker cannot leave mid-game (role transfer is roadmap task 7.3); here
 *   we only guard against it.
 */
export class LeaveRoom {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    requesterId,
    roomId,
    targetUserId,
  }: LeaveRoomInput): Promise<RoomSnapshot> {
    if (targetUserId !== undefined && targetUserId !== requesterId) {
      throw new ForbiddenActionError();
    }

    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);

    const members = await this.rooms.listMembers(roomId);
    if (!members.some((m) => m.userId === requesterId)) {
      throw new NotRoomMemberError(roomId);
    }

    // The banker holds the game together; leaving mid-game is blocked until role
    // transfer exists (task 7.3).
    if (isBanker(room, requesterId) && room.status === 'playing') {
      throw new BankerCannotLeaveError(roomId);
    }

    // A seat cannot be vacated while a hand is live (an unsettled hand exists).
    const hand = await this.hands.get(roomId);
    if (hand !== null && hand.status !== 'settled') {
      throw new CannotLeaveMidHandError(roomId);
    }

    await this.rooms.removeMember(roomId, requesterId);
    const remaining = await this.rooms.listMembers(roomId);
    return toRoomSnapshot(room, remaining);
  }
}
