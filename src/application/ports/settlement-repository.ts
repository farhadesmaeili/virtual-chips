/** A single player's net result for a finished game (positive = win). */
export interface SettlementRecordInput {
  readonly userId: string;
  readonly net: number;
}

/**
 * Persistence port for end-of-game settlements. The net results derived at
 * end-game (from the corrected RoomMember ledgers) are written here once; this
 * is the single source the game-history feature (6.3) will later read.
 */
export interface SettlementRepository {
  /** Persists the per-user net results for a finished game. */
  saveForGame(
    gameId: string,
    settlements: readonly SettlementRecordInput[],
  ): Promise<void>;
}
