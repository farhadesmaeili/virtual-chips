import { Chips } from '../value-objects/chips';

/**
 * A pot (main or side). `eligibleSeats` lists the seats that may win it.
 * Immutable: helpers return new Pot instances.
 */
export interface Pot {
  readonly amount: number;
  readonly eligibleSeats: readonly number[];
}

export function createPot(
  amount = 0,
  eligibleSeats: readonly number[] = [],
): Pot {
  Chips.of(amount); // validate the amount is a non-negative integer
  return { amount, eligibleSeats: [...eligibleSeats] };
}

export function isEligible(pot: Pot, seat: number): boolean {
  return pot.eligibleSeats.includes(seat);
}

export function addToPot(pot: Pot, amount: number): Pot {
  return {
    ...pot,
    amount: Chips.of(pot.amount).add(Chips.of(amount)).value,
  };
}
