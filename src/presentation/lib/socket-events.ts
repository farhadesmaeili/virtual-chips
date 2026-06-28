// Client-side view of the realtime contract (docs/REALTIME-EVENTS.md). Kept in
// the presentation layer so components never import server infrastructure; these
// types mirror the server projections (infrastructure/realtime/*-projection.ts).

export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type SettlementMode = 'banker' | 'showdown';

export interface RoomSettings {
  readonly actionTimeoutMs: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly settlementMode: SettlementMode;
}

export interface PublicRoomMember {
  readonly seat: number;
  readonly username: string;
  readonly chips: number;
  readonly buyInTotal: number;
  readonly isBanker: boolean;
  readonly sittingOut: boolean;
}

export interface PublicRoomState {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  readonly settings: RoomSettings;
  readonly members: readonly PublicRoomMember[];
}

/** A pending buy-in request, broadcast on `chips:requests` (task 4.15). */
export interface PublicChipRequest {
  readonly id: string;
  readonly seat: number;
  readonly username: string;
  readonly amount: number;
}

export interface ChipRequestList {
  readonly requests: readonly PublicChipRequest[];
}

// --- Hand state (broadcast on `hand:state`) -------------------------------
// The table renders from these; in 4.2 the wiring is partial (full socket sync
// lands in later 4.x tasks), so components must treat `hand` as possibly null.

export type PlayerState = 'active' | 'folded' | 'all_in' | 'sitting_out';
export type HandStatus =
  | 'betting'
  // Betting on the current street is done; waiting for the banker to deal the
  // next street (task 4.7).
  | 'awaiting_street'
  | 'awaiting_showdown'
  | 'settled';

export interface PublicHandPlayer {
  readonly seat: number;
  readonly stack: number;
  readonly committedThisStreet: number;
  readonly committedTotal: number;
  readonly state: PlayerState;
  readonly hasActedThisStreet: boolean;
  /**
   * The player's last action this hand (verb only, no amount), or null before
   * they act. Mirrors the server projection; consumed by the seat label (Phase
   * 2). Survives reconnect/resync since it rides the hand state.
   */
  readonly lastAction: AppliedActionType | null;
  /** Time-bank extensions left this hand (task 4.12). */
  readonly timeExtensionsRemaining: number;
  /**
   * The player's player-showdown claim (mode B, 6.1), or absent when unclaimed /
   * not at showdown. Mirrors the server projection; consumed by the claim UI in
   * PR3. Additive — present only on `hand:state`.
   */
  readonly claim?: 'win' | 'muck';
}

export interface PublicPot {
  readonly amount: number;
  readonly eligibleSeats: readonly number[];
}

export interface PublicHandState {
  readonly id: string;
  readonly roomId: string;
  readonly street: number;
  readonly buttonSeat: number;
  readonly currentBet: number;
  /** Size of the last full bet/raise this street; the min-raise increment. */
  readonly lastRaiseSize: number;
  readonly actingSeat: number | null;
  readonly actionDeadline: number | null;
  readonly status: HandStatus;
  readonly players: readonly PublicHandPlayer[];
  readonly pots: readonly PublicPot[];
  readonly totalPot: number;
}

/**
 * An action the engine applied, broadcast on `action:applied` purely for
 * animation/log (task 5.1) — the authoritative chips/pot still arrive via
 * `hand:state`. Mirrors the server's `ActionType` (domain) on the wire.
 */
export type AppliedActionType =
  | 'FOLD'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN';

export interface ActionApplied {
  readonly seat: number;
  readonly action: AppliedActionType;
  /** Raise/bet target when the client supplied one; null for call/all-in. */
  readonly amount: number | null;
}

/** Chips won per seat, broadcast on `hand:settled` after the banker settles. */
export interface HandSettled {
  readonly payouts: readonly {
    readonly seat: number;
    readonly amount: number;
  }[];
}

/**
 * End-of-game net per player, broadcast on `game:ended` when the banker ends the
 * game (6.2). Seat + net only — raw userIds are never broadcast.
 */
export interface GameEnded {
  readonly nets: readonly {
    readonly seat: number;
    readonly net: number;
  }[];
  /** Rake removed from play (0 until rake is configurable). */
  readonly rake: number;
}

export interface SocketError {
  readonly code: string;
  readonly message: string;
}

export interface SessionReady {
  readonly user: { readonly id: string; readonly username: string };
}

/** A room the user belongs to, for the lobby's "Your table" card (task 4.13). */
export interface PublicUserRoom {
  readonly roomId: string;
  readonly name: string;
  readonly status: RoomStatus;
}

/** Response to `rooms:mine` — the rooms the authenticated user is a member of. */
export interface RoomsMine {
  readonly rooms: readonly PublicUserRoom[];
}

/**
 * A finished game in the user's history (task 6.3). Mirrors the server
 * projection (`PublicGameHistoryEntry`); `endedAt` is an ISO 8601 string on the
 * wire (parse with `new Date(endedAt)` for display).
 */
export interface PublicGameHistoryEntry {
  readonly gameId: string;
  readonly net: number;
  readonly roomName: string;
  readonly endedAt: string;
}

/** Response to `history:mine` — the authenticated user's finished games. */
export interface HistoryMine {
  readonly games: readonly PublicGameHistoryEntry[];
}
