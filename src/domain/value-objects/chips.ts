import { InsufficientChipsError, InvalidChipsAmountError } from '../errors';

/**
 * Immutable value object for an amount of chips: a non-negative integer.
 *
 * All arithmetic returns a new `Chips` instance — instances are never mutated.
 * Construction goes through `Chips.of`, which enforces the invariant.
 */
export class Chips {
  private constructor(readonly value: number) {}

  /** Creates a Chips amount, throwing if it is not a non-negative integer. */
  static of(value: number): Chips {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidChipsAmountError(value);
    }
    return new Chips(value);
  }

  static zero(): Chips {
    return new Chips(0);
  }

  /** Returns the smaller of two amounts (e.g. for a capped call / all-in). */
  static min(a: Chips, b: Chips): Chips {
    return a.value <= b.value ? a : b;
  }

  add(other: Chips): Chips {
    return new Chips(this.value + other.value);
  }

  /**
   * Subtracts `other`. Throws {@link InsufficientChipsError} if the result
   * would be negative — chip balances are never negative.
   */
  subtract(other: Chips): Chips {
    if (other.value > this.value) {
      throw new InsufficientChipsError(this.value, other.value);
    }
    return new Chips(this.value - other.value);
  }

  isZero(): boolean {
    return this.value === 0;
  }

  equals(other: Chips): boolean {
    return this.value === other.value;
  }

  gt(other: Chips): boolean {
    return this.value > other.value;
  }

  gte(other: Chips): boolean {
    return this.value >= other.value;
  }

  lt(other: Chips): boolean {
    return this.value < other.value;
  }
}
