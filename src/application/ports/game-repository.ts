export interface GameRecord {
  readonly id: string;
  readonly roomId: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface SaveHandInput {
  readonly gameId: string;
  /** Serialized domain Hand snapshot (stored as JSON). */
  readonly state: unknown;
}

/** Persistence port for games and their hand snapshots. */
export interface GameRepository {
  create(roomId: string): Promise<GameRecord>;
  findById(id: string): Promise<GameRecord | null>;
  /**
   * Returns the room's currently-open game (the one with `endedAt: null`), or
   * null when no game is open. Game lifecycle is lazy-on-first-hand: the first
   * `StartHand` for a room creates a game, every later hand reuses this open
   * one, and end-game (PR2) sets `endedAt` to close it. There is at most one
   * open game per room.
   */
  findOpenByRoom(roomId: string): Promise<GameRecord | null>;
  end(id: string): Promise<void>;
  /** Persists a hand snapshot and returns its id. */
  saveHand(input: SaveHandInput): Promise<{ id: string }>;
}
