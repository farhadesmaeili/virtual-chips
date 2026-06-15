/**
 * Base class for all domain errors.
 *
 * Domain errors are typed so the application / transport layers can map them
 * to user-facing messages without leaking internals. Every concrete error
 * exposes a stable, machine-readable `code`.
 *
 * NOTE: the full catalogue of domain errors (NotYourTurnError,
 * InvalidRaiseError, ...) is completed in roadmap task 1.6. This file only
 * declares the errors that the entities and value objects need right now.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable error code (e.g. `INSUFFICIENT_CHIPS`). */
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    // `new.target` resolves to the concrete subclass being constructed.
    this.name = new.target.name;
  }
}

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

/** Thrown when room settings violate an invariant (e.g. bigBlind < smallBlind). */
export class InvalidRoomSettingsError extends DomainError {
  readonly code = 'INVALID_ROOM_SETTINGS';

  constructor(message: string) {
    super(`Invalid room settings: ${message}`);
  }
}
