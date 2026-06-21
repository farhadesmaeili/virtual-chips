import type { RoomRepository } from '@/application/ports';
import {
  ForbiddenActionError,
  NotRoomMemberError,
  RoomNotFoundError,
} from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface PresenceInput {
  /** The authenticated session user — the only user that may be affected. */
  readonly requesterId: string;
  readonly roomId: string;
  /**
   * Optional target taken from the client payload. If present it must equal
   * `requesterId`; a mismatch is rejected (IDOR guard). In practice the
   * transport never forwards a target, but enforcing it here keeps the rule in
   * the use-case, not just the UI.
   */
  readonly targetUserId?: string;
}

/**
 * Shared guards for self-only presence actions: the room must exist, the
 * requester must be a member, and any payload target must be the requester.
 */
async function authorizeSelf(
  rooms: RoomRepository,
  { requesterId, roomId, targetUserId }: PresenceInput,
): Promise<void> {
  if (targetUserId !== undefined && targetUserId !== requesterId) {
    throw new ForbiddenActionError();
  }
  const room = await rooms.findById(roomId);
  if (room === null) throw new RoomNotFoundError(roomId);
  const members = await rooms.listMembers(roomId);
  if (!members.some((m) => m.userId === requesterId)) {
    throw new NotRoomMemberError(roomId);
  }
}

async function snapshotOf(
  rooms: RoomRepository,
  roomId: string,
): Promise<RoomSnapshot> {
  const room = await rooms.findById(roomId);
  if (room === null) throw new RoomNotFoundError(roomId);
  const members = await rooms.listMembers(roomId);
  return toRoomSnapshot(room, members);
}

/**
 * Sits a player out (task 4.14). Allowed at any time, but it only takes effect
 * from the next hand: the player finishes the current hand normally and is then
 * skipped by {@link StartHand} until they sit back in. Self-only.
 */
export class SitOut {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: PresenceInput): Promise<RoomSnapshot> {
    await authorizeSelf(this.rooms, input);
    await this.rooms.setMemberSittingOut(input.roomId, input.requesterId, true);
    return snapshotOf(this.rooms, input.roomId);
  }
}

/**
 * Returns a sitting-out player to the table (task 4.14). They are dealt in
 * again from the next hand. Self-only.
 */
export class SitIn {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(input: PresenceInput): Promise<RoomSnapshot> {
    await authorizeSelf(this.rooms, input);
    await this.rooms.setMemberSittingOut(
      input.roomId,
      input.requesterId,
      false,
    );
    return snapshotOf(this.rooms, input.roomId);
  }
}
