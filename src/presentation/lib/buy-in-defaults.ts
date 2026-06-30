/**
 * Presentation-only helpers for the lobby create-room form's read-only buy-in
 * readout.
 *
 * The Min/Max buy-in are no longer editable: the form derives them from the
 * chosen big blind (10x/20x) for both the read-only display and the submit
 * payload. These helpers are NOT the source of truth: the domain
 * (`deriveBuyInDefaults` in `domain/entities/room.ts`) owns the real 10x/20x
 * big-blind multiples and the server re-derives/validates everything. The
 * multiples are duplicated here only so the form can show the derived bounds
 * before the payload is sent.
 */

/** Default minimum buy-in = 10x the big blind (mirrors the domain multiple). */
export const BUY_IN_MIN_BB_MULTIPLE = 10;
/** Default maximum buy-in = 20x the big blind (mirrors the domain multiple). */
export const BUY_IN_MAX_BB_MULTIPLE = 20;

/** bigBlind * 10 */
export function defaultMinBuyIn(bigBlind: number): number {
  return bigBlind * BUY_IN_MIN_BB_MULTIPLE;
}

/** bigBlind * 20 */
export function defaultMaxBuyIn(bigBlind: number): number {
  return bigBlind * BUY_IN_MAX_BB_MULTIPLE;
}
