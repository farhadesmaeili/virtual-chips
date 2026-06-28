/** A single player's net result for a finished game (positive = win). */
export interface SettlementRecordInput {
  readonly userId: string;
  readonly net: number;
}

/** A finished game's net for one user, for the per-user history (6.3). */
export interface UserGameSettlement {
  readonly gameId: string;
  /** From Settlement.net — read straight from persistence, never recomputed. */
  readonly net: number;
  /** The room the game was played in (Game → Room.name). */
  readonly roomName: string;
  /** When the game finished (Game.endedAt); only finished games are listed. */
  readonly endedAt: Date;
}

/**
 * Persistence port for end-of-game settlements. The net results derived at
 * end-game (from the corrected RoomMember ledgers) are written here once; this
 * is the single source the game-history feature (6.3) reads.
 */
export interface SettlementRepository {
  /** Persists the per-user net results for a finished game. */
  saveForGame(
    gameId: string,
    settlements: readonly SettlementRecordInput[],
  ): Promise<void>;

  /**
   * Finished-game settlements for one user, newest first. The single source is
   * the persisted Settlement rows — net is never recomputed and RoomMember is
   * never read. `userId` is always the authenticated session user.
   */
  listForUser(userId: string): Promise<UserGameSettlement[]>;
}
