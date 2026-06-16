import type { RoomRepository } from '@/application/ports';
import { NotRoomMemberError, RoomNotFoundError } from '@/domain/errors';
import { toRoomSnapshot, type RoomSnapshot } from './room-snapshot';

export interface LeaveRoomInput {
  readonly userId: string;
  readonly roomId: string;
}

/**
 * Removes a member from a room and returns the remaining snapshot.
 *
 * NOTE: transferring the banker role when the banker leaves is handled later
 * (roadmap task 7.3); here we simply remove the member.
 */
export class LeaveRoom {
  constructor(private readonly rooms: RoomRepository) {}

  async execute({ userId, roomId }: LeaveRoomInput): Promise<RoomSnapshot> {
    const room = await this.rooms.findById(roomId);
    if (room === null) throw new RoomNotFoundError(roomId);

    const members = await this.rooms.listMembers(roomId);
    if (!members.some((m) => m.userId === userId)) {
      throw new NotRoomMemberError(roomId);
    }

    await this.rooms.removeMember(roomId, userId);
    const remaining = await this.rooms.listMembers(roomId);
    return toRoomSnapshot(room, remaining);
  }
}
