import { FundingCeilingError, type BuyInLimitReason } from '../errors';

/**
 * Per-table buy-in limits and the rules that validate a buy-in request against a
 * member's current stack. Pure domain logic — no I/O — so both `RequestChips`
 * (at request time) and `ApproveChipRequest` (re-checked at approve time) share
 * one source of truth, and it is fully unit-testable.
 */

/** BB multiples used to derive a room's default buy-in bounds when omitted. */
export const BUY_IN_MIN_BB_MULTIPLE = 10;
export const BUY_IN_MAX_BB_MULTIPLE = 20;

/**
 * Hard ceiling on any single chip balance and on a member's cumulative
 * `buyInTotal`. `buyInTotal` is a Postgres Int accumulator incremented on every
 * funding op (buy-in / banker adjust) with an unbounded rebuy count, so a
 * per-op cap alone would let it overflow the Int column (2,147,483,647). The
 * cumulative guard ({@link validateFundingCeiling}) keeps both fields under this
 * value. Chosen so `20 * MAX_BLIND === MAX_CHIP_AMOUNT`.
 */
export const MAX_CHIP_AMOUNT = 100_000_000;

/** Upper bound for a blind, kept so `20 * MAX_BLIND === MAX_CHIP_AMOUNT`. */
export const MAX_BLIND = 5_000_000;

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

/**
 * Cumulative funding guard, applied on EVERY funding operation before chips
 * move. Throws {@link FundingCeilingError} if the operation would push either
 * the member's chips OR their cumulative `buyInTotal` past {@link
 * MAX_CHIP_AMOUNT}. Unlike a per-op cap, this bounds the running total so the
 * unguarded `buyInTotal` Int accumulator cannot overflow across many rebuys.
 *
 * A negative `amount` (cash-out / correction) is a no-op: neither sum can grow,
 * so the ceiling cannot be breached.
 */
export function validateFundingCeiling(
  currentChips: number,
  currentBuyInTotal: number,
  amount: number,
): void {
  if (
    currentChips + amount > MAX_CHIP_AMOUNT ||
    currentBuyInTotal + amount > MAX_CHIP_AMOUNT
  ) {
    throw new FundingCeilingError(MAX_CHIP_AMOUNT);
  }
}
