/** A player's pending request for chips, awaiting the banker's approval. */
export interface ChipRequest {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  /** The requester's seat and name, captured so the banker's list is self-contained. */
  readonly seat: number;
  readonly username: string;
  readonly amount: number;
  /** Epoch ms, for stable ordering of the banker's queue. */
  readonly createdAt: number;
}

/**
 * Store of pending chip requests (one queue per room). In-memory for now — like
 * the live hand, a pending request is transient and not part of game history;
 * the *approved* result is persisted to the member instead.
 */
export interface ChipRequestStore {
  add(request: ChipRequest): Promise<void>;
  get(id: string): Promise<ChipRequest | null>;
  remove(id: string): Promise<void>;
  /** Pending requests for a room, oldest first. */
  listByRoom(roomId: string): Promise<ChipRequest[]>;
  /** Whether `userId` already has a pending request in `roomId`. */
  hasPending(roomId: string, userId: string): Promise<boolean>;
}
