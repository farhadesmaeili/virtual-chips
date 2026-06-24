/**
 * Typed domain errors (docs/BETTING-ENGINE.md §7).
 *
 * Every domain error extends {@link DomainError} and exposes a stable,
 * machine-readable `code` drawn from {@link DomainErrorCode}. The
 * application / transport layers map these codes to user-facing messages
 * without leaking internals.
 */

/** The complete set of domain error codes. */
export type DomainErrorCode =
  | 'INVALID_CHIPS_AMOUNT'
  | 'INSUFFICIENT_CHIPS'
  | 'INVALID_ROOM_SETTINGS'
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'ALREADY_IN_ROOM'
  | 'NOT_ROOM_MEMBER'
  | 'NOT_ENOUGH_PLAYERS'
  | 'HAND_IN_PROGRESS'
  | 'NO_ACTIVE_HAND'
  | 'NO_OPEN_GAME'
  | 'NOT_YOUR_TURN'
  | 'INVALID_ACTION'
  | 'INVALID_RAISE'
  | 'HAND_NOT_IN_BETTING'
  | 'NO_TIME_BANK'
  | 'NOT_BANKER'
  | 'INVALID_SETTLEMENT'
  | 'CHIP_REQUEST_NOT_FOUND'
  | 'CHIP_REQUEST_PENDING'
  | 'FORBIDDEN'
  | 'CANNOT_LEAVE_MID_HAND'
  | 'BANKER_CANNOT_LEAVE';

export abstract class DomainError extends Error {
  /** Stable, machine-readable error code (e.g. `INSUFFICIENT_CHIPS`). */
  abstract readonly code: DomainErrorCode;

  protected constructor(message: string) {
    super(message);
    // `new.target` resolves to the concrete subclass being constructed.
    this.name = new.target.name;
  }
}

/** Type guard for narrowing unknown errors to DomainError. */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

// --- Chips ---

/** Thrown when a chips amount is not a non-negative integer. */
export class InvalidChipsAmountError extends DomainError {
  readonly code = 'INVALID_CHIPS_AMOUNT';

  constructor(readonly amount: number) {
    super(`Chips amount must be a non-negative integer, received: ${amount}`);
  }
}

/** Thrown when an operation would drive a chip balance below zero. */
export class InsufficientChipsError extends DomainError {
  readonly code = 'INSUFFICIENT_CHIPS';

  constructor(
    readonly available: number,
    readonly requested: number,
  ) {
    super(
      `Insufficient chips: requested ${requested} but only ${available} available`,
    );
  }
}

// --- Room ---

/** Thrown when room settings violate an invariant (e.g. bigBlind < smallBlind). */
export class InvalidRoomSettingsError extends DomainError {
  readonly code = 'INVALID_ROOM_SETTINGS';

  constructor(message: string) {
    super(`Invalid room settings: ${message}`);
  }
}

/**
 * Thrown when a player tries to join a room that has no free seats.
 * Used by the JoinRoom use-case (application layer).
 */
export class RoomFullError extends DomainError {
  readonly code = 'ROOM_FULL';

  constructor(readonly capacity: number) {
    super(`Room is full (capacity: ${capacity})`);
  }
}

/** Thrown when a room cannot be found by id. */
export class RoomNotFoundError extends DomainError {
  readonly code = 'ROOM_NOT_FOUND';

  constructor(readonly roomId: string) {
    super(`Room not found: ${roomId}`);
  }
}

/** Thrown when a user tries to join a room they are already a member of. */
export class AlreadyInRoomError extends DomainError {
  readonly code = 'ALREADY_IN_ROOM';

  constructor(readonly roomId: string) {
    super(`Already a member of room: ${roomId}`);
  }
}

/** Thrown when a user acts on a room they are not a member of. */
export class NotRoomMemberError extends DomainError {
  readonly code = 'NOT_ROOM_MEMBER';

  constructor(readonly roomId: string) {
    super(`Not a member of room: ${roomId}`);
  }
}

/** Thrown when a hand is started with fewer than two funded players. */
export class NotEnoughPlayersError extends DomainError {
  readonly code = 'NOT_ENOUGH_PLAYERS';

  constructor(readonly roomId: string) {
    super(`Not enough players with chips to start a hand in room: ${roomId}`);
  }
}

/** Thrown when starting a hand while one is already in progress. */
export class HandInProgressError extends DomainError {
  readonly code = 'HAND_IN_PROGRESS';

  constructor(readonly roomId: string) {
    super(`A hand is already in progress in room: ${roomId}`);
  }
}

/** Thrown when acting while no hand is in progress. */
export class NoActiveHandError extends DomainError {
  readonly code = 'NO_ACTIVE_HAND';

  constructor(readonly roomId: string) {
    super(`No active hand in room: ${roomId}`);
  }
}

/**
 * Thrown when ending a game for a room that has no open game (none was ever
 * started, or it was already ended). The game lifecycle is lazy-on-first-hand:
 * a Game opens on the first hand and is closed by end-game.
 */
export class NoOpenGameError extends DomainError {
  readonly code = 'NO_OPEN_GAME';

  constructor(readonly roomId: string) {
    super(`No open game to end in room: ${roomId}`);
  }
}

// --- Betting actions ---

/** Thrown when a seat tries to act out of turn. */
export class NotYourTurnError extends DomainError {
  readonly code = 'NOT_YOUR_TURN';

  constructor(
    readonly seat: number,
    readonly actingSeat: number | null,
  ) {
    super(
      `It is not seat ${seat}'s turn to act (acting seat: ${actingSeat ?? 'none'})`,
    );
  }
}

/** Thrown when an action is not legal in the current state (wrong action). */
export class InvalidActionError extends DomainError {
  readonly code = 'INVALID_ACTION';

  constructor(message: string) {
    super(`Invalid action: ${message}`);
  }
}

/** Thrown when a raise does not meet the min-raise rule or is unaffordable. */
export class InvalidRaiseError extends DomainError {
  readonly code = 'INVALID_RAISE';

  constructor(message: string) {
    super(`Invalid raise: ${message}`);
  }
}

/** Thrown when a betting action is attempted on a hand that is not betting. */
export class HandNotInBettingError extends DomainError {
  readonly code = 'HAND_NOT_IN_BETTING';

  constructor(readonly status: string) {
    super(`Hand is not in the betting phase (status: ${status})`);
  }
}

/** Thrown when a player asks for more time but their time bank is empty (4.12). */
export class NoTimeBankError extends DomainError {
  readonly code = 'NO_TIME_BANK';

  constructor(readonly seat: number) {
    super(`No time bank remaining for seat ${seat}`);
  }
}

// --- Banker / settlement ---

/**
 * Thrown when a banker-only action is attempted by a non-banker. Enforced by
 * the use-cases (banker settle / declare winner / end game), not the UI.
 */
export class NotBankerError extends DomainError {
  readonly code = 'NOT_BANKER';

  constructor(readonly userId?: string) {
    super(
      userId === undefined
        ? 'Only the banker may perform this action'
        : `User ${userId} is not the banker and may not perform this action`,
    );
  }
}

/** Thrown when settlement input is invalid or chips are not conserved. */
export class InvalidSettlementError extends DomainError {
  readonly code = 'INVALID_SETTLEMENT';

  constructor(message: string) {
    super(`Invalid settlement: ${message}`);
  }
}

// --- Chip requests / buy-ins ---

/** Thrown when a chip request to approve/reject no longer exists. */
export class ChipRequestNotFoundError extends DomainError {
  readonly code = 'CHIP_REQUEST_NOT_FOUND';

  constructor(readonly requestId?: string) {
    super('That chip request no longer exists');
  }
}

/** Thrown when a player already has a chip request awaiting the banker. */
export class ChipRequestPendingError extends DomainError {
  readonly code = 'CHIP_REQUEST_PENDING';

  constructor() {
    super('You already have a chip request waiting for the banker');
  }
}

// --- Presence (sit out / leave, task 4.14) ---

/**
 * Thrown when a user tries to act on someone other than themselves (IDOR
 * guard). The acting user is always the authenticated session user; a payload
 * may never target a different user.
 */
export class ForbiddenActionError extends DomainError {
  readonly code = 'FORBIDDEN';

  constructor(message = 'You can only perform this action on yourself') {
    super(message);
  }
}

/**
 * Thrown when a player tries to leave the table while a hand is in progress.
 * They may fold and stay seated; the seat is only freed between hands.
 */
export class CannotLeaveMidHandError extends DomainError {
  readonly code = 'CANNOT_LEAVE_MID_HAND';

  constructor(readonly roomId: string) {
    super('You cannot leave the table during a hand');
  }
}

/**
 * Thrown when the banker tries to leave mid-game. Transferring the banker role
 * is a later task (roadmap 7.3); for now the banker must end the game first.
 */
export class BankerCannotLeaveError extends DomainError {
  readonly code = 'BANKER_CANNOT_LEAVE';

  constructor(readonly roomId: string) {
    super('The banker cannot leave mid-game');
  }
}
