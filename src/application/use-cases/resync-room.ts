import type { HandStore, RoomRepository } from '@/application/ports';
import type { Hand } from '@/domain/entities';
import { NotRoomMemberError, RoomNotFoundError } from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface ResyncRoomInput {
  readonly userId: string;
  readonly roomId: string;
}

export interface ResyncRoomResult {
  readonly snapshot: RoomSnapshot;
  /** The current live hand, or null when no hand is in progress. */
  readonly hand: Hand | null;
}

/**
 * Returns the current room snapshot and live hand for a reconnecting client.
 * Authorization: only a member of the room may resync to it. Read-only — it
 * never mutates state or the turn timer, so it cannot create a zombie timer.
 */
export class ResyncRoom {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly hands: HandStore,
  ) {}

  async execute({
    userId,
    roomId,
  }: ResyncRoomInput): Promise<ResyncRoomResult> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);

    const members = await this.rooms.listMembers(roomId);
    if (!members.some((m) => m.userId === userId)) {
      throw new NotRoomMemberError(roomId);
    }

    const hand = await this.hands.get(roomId);
    return { snapshot: toRoomSnapshot(room, members), hand };
  }
}
