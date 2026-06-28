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
 * A room the user is a member of, for the lobby's "Your table" card (task 4.13).
 * Carries only room identity + status — the card needs no member detail.
 */
export interface UserRoomMembership {
  readonly roomId: string;
  readonly name: string;
  readonly status: RoomStatus;
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
  /**
   * Lists the rooms the given user is a member of, most-recently-joined first
   * (task 4.13). Returns an array — a user is in at most one table today, but
   * the boundary stays forward-compatible with future multi-table play.
   */
  listRoomsForUser(userId: string): Promise<UserRoomMembership[]>;
  /** Sets a member's current chip stack (e.g. persisting settlement results). */
  updateMemberChips(
    roomId: string,
    userId: string,
    chips: number,
  ): Promise<void>;
  /**
   * Applies a signed funding delta to a member, moving their stack and their
   * cumulative `buyInTotal` in lockstep (positive = buy-in/top-up, negative =
   * correction/cash-out). Because both move together the member's net
   * (`chips - buyInTotal`) is preserved, so end-of-game settlement stays
   * zero-sum. Callers must guard the floor — this does not prevent a negative
   * delta from driving either field below zero.
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
