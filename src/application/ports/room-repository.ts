import type { Room, RoomStatus } from '@/domain/entities';

/** A member's seat and chips within a room. */
export interface RoomMemberRecord {
  readonly userId: string;
  readonly seat: number;
  readonly buyInTotal: number;
  readonly chips: number;
}

export interface AddMemberInput {
  readonly userId: string;
  readonly seat: number;
  readonly buyInTotal: number;
  readonly chips: number;
}

/**
 * Persistence port for rooms. Works in terms of the domain `Room` entity; the
 * implementation maps to/from the database representation.
 */
export interface RoomRepository {
  create(room: Room): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  updateStatus(id: string, status: RoomStatus): Promise<void>;
  addMember(roomId: string, member: AddMemberInput): Promise<RoomMemberRecord>;
  listMembers(roomId: string): Promise<RoomMemberRecord[]>;
}
