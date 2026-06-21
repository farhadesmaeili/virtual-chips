import type { RoomRepository, UserRoomMembership } from '@/application/ports';

export interface ListUserRoomsInput {
  readonly userId: string;
}

/**
 * Lists the rooms the requesting user belongs to, for the lobby's "Your table"
 * card (task 4.13). Read-only. The `userId` is always the authenticated session
 * user (supplied by the socket handler from `socket.data.user`), never a client
 * value — so the result can only ever be the caller's own memberships.
 */
export class ListUserRooms {
  constructor(private readonly rooms: RoomRepository) {}

  async execute({ userId }: ListUserRoomsInput): Promise<UserRoomMembership[]> {
    return this.rooms.listRoomsForUser(userId);
  }
}
