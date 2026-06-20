import type { Room, RoomStatus } from '@/domain/entities';

/** A member's seat and chips within a room. */
export interface RoomMemberRecord {
  readonly userId: string;
  readonly username: string;
  readonly seat: number;
  readonly buyInTotal: number;
  readonly chips: number;
  /**
   * When true, the member keeps their seat and chips but is not dealt into new
   * hands (task 4.14). Persisted at the membership level so it carries across
   * hands; the in-hand PlayerInHand `'sitting_out'` state is separate.
   */
  readonly sittingOut: boolean;
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
  removeMember(roomId: string, userId: string): Promise<void>;
  listMembers(roomId: string): Promise<RoomMemberRecord[]>;
  /** Sets a member's current chip stack (e.g. persisting settlement results). */
  updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void>;
  /**
   * Adds an approved buy-in: increases both the member's stack and their
   * cumulative `buyInTotal` (the latter feeds end-of-game net settlement).
   */
  addMemberFunding(
    roomId: string,
    userId: string,
    amount: number,
  ): Promise<void>;
  /** Sets a member's sitting-out flag (task 4.14 sit out / sit in). */
  setMemberSittingOut(
    roomId: string,
    userId: string,
    sittingOut: boolean,
  ): Promise<void>;
}
