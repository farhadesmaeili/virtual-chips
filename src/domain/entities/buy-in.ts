import type { BuyInLimitReason } from '../errors';

/**
 * Per-table buy-in limits and the rules that validate a buy-in request against a
 * member's current stack. Pure domain logic — no I/O — so both `RequestChips`
 * (at request time) and `ApproveChipRequest` (re-checked at approve time) share
 * one source of truth, and it is fully unit-testable.
 */

/** BB multiples used to derive a room's default buy-in bounds when omitted. */
export const BUY_IN_MIN_BB_MULTIPLE = 10;
export const BUY_IN_MAX_BB_MULTIPLE = 20;

export interface BuyInRequestArgs {
  /** The member's current stack (chips). Requests happen between hands. */
  readonly currentChips: number;
  /** Table minimum for a first buy-in. */
  readonly minBuyIn: number;
  /** Table maximum stack, or null for no maximum. */
  readonly maxBuyIn: number | null;
  /** The requested buy-in amount (already validated as a positive integer). */
  readonly amount: number;
}

export type BuyInRequestResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: BuyInLimitReason };

/**
 * Validates a buy-in against the table limits:
 * - `space = (maxBuyIn === null ? Infinity : maxBuyIn) - currentChips`.
 * - First buy (currentChips === 0): `minBuyIn <= amount <= space`.
 * - Top-up (currentChips > 0): `amount <= space` (the minimum is NOT re-applied).
 * - If `maxBuyIn !== null && currentChips >= maxBuyIn`: the stack is full.
 * - `maxBuyIn === null`: no upper cap (space is Infinity).
 *
 * `amount`'s positivity is the caller's guard (so a non-positive amount surfaces
 * as an invalid-amount error, not a limit error); this only judges the limits.
 */
export function validateBuyInRequest(
  args: BuyInRequestArgs,
): BuyInRequestResult {
  const { currentChips, minBuyIn, maxBuyIn, amount } = args;

  // Already at or past the cap: no more chips can be added.
  if (maxBuyIn !== null && currentChips >= maxBuyIn) {
    return { ok: false, reason: 'full' };
  }

  const space = maxBuyIn === null ? Infinity : maxBuyIn - currentChips;

  // First buy-in must meet the table minimum.
  if (currentChips === 0 && amount < minBuyIn) {
    return { ok: false, reason: 'below_min' };
  }

  // Neither a first buy nor a top-up may overshoot the remaining space.
  if (amount > space) {
    return { ok: false, reason: 'exceeds_space' };
  }

  return { ok: true };
}
