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
  | 'NOT_YOUR_TURN'
  | 'INVALID_ACTION'
  | 'INVALID_RAISE'
  | 'HAND_NOT_IN_BETTING'
  | 'NOT_BANKER'
  | 'INVALID_SETTLEMENT';

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
