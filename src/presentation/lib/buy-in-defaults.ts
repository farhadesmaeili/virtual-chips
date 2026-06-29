/**
 * Presentation-only helpers for the lobby create-room form's buy-in inputs.
 *
 * These derive UX prefill values and validate the inputs client-side. They are
 * NOT the source of truth: the domain (`deriveBuyInDefaults` in
 * `domain/entities/room.ts`) owns the real 10x/20x big-blind multiples and the
 * server re-derives/validates everything. The multiples are duplicated here only
 * so the form can show a sensible prefill before the payload is sent.
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

/**
 * Dirty-aware recompute of the prefilled inputs when the big blind changes.
 * Returns STRING values for the inputs. A field that the banker has manually
 * edited (dirty) is preserved verbatim. If bigBlind is not a positive integer
 * (e.g. empty input → NaN), return currentMin/currentMax UNCHANGED — never
 * clobber the inputs with "NaN".
 */
export function recomputeBuyInPrefill(args: {
  bigBlind: number;
  minDirty: boolean;
  maxDirty: boolean;
  currentMin: string;
  currentMax: string;
}): { min: string; max: string } {
  const { bigBlind, minDirty, maxDirty, currentMin, currentMax } = args;

  // Guard: only recompute from a valid positive-integer big blind. Otherwise the
  // inputs are left as the banker last saw them.
  if (!Number.isInteger(bigBlind) || bigBlind <= 0) {
    return { min: currentMin, max: currentMax };
  }

  return {
    min: minDirty ? currentMin : String(defaultMinBuyIn(bigBlind)),
    max: maxDirty ? currentMax : String(defaultMaxBuyIn(bigBlind)),
  };
}

/**
 * UX validation guard (mirrors blindsValid; client-side UX only, server is the
 * authority). noMax = the "no maximum" toggle. Rules:
 *   - min must be an integer >= 1
 *   - if noMax: max is ignored
 *   - else: max must be an integer >= min
 */
export function isBuyInValid(args: {
  min: string;
  max: string;
  noMax: boolean;
}): boolean {
  const { min, max, noMax } = args;

  const minNum = Number(min);
  if (min.trim() === '' || !Number.isInteger(minNum) || minNum < 1) {
    return false;
  }

  if (noMax) {
    return true;
  }

  const maxNum = Number(max);
  if (max.trim() === '' || !Number.isInteger(maxNum) || maxNum < minNum) {
    return false;
  }

  return true;
}
