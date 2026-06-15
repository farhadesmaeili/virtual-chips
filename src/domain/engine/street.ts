import type { Hand } from '../entities/hand';
import { resetForNewStreet } from '../entities/player-in-hand';

/** Default number of betting streets (preflop/flop/turn/river-style). */
export const DEFAULT_STREET_COUNT = 4;

export interface AdvanceOptions {
  /** Room minimum bet (big blind); the new street's lastRaiseSize. */
  readonly minBet: number;
  /** Total number of betting streets before showdown. Defaults to 4. */
  readonly streetCount?: number;
}

/**
 * Next seat that can act, going clockwise (by ascending seat number, wrapping)
 * from `fromSeat` (exclusive). Folded / all-in / sitting-out seats are skipped.
 * Returns null if no other seat can act.
 */
export function nextActiveSeat(hand: Hand, fromSeat: number): number | null {
  const seated = [...hand.players].sort((a, b) => a.seat - b.seat);
  const n = seated.length;
  if (n === 0) return null;
  const fromIdx = seated.findIndex((p) => p.seat === fromSeat);
  // If fromSeat is not seated, start scanning from the first seat.
  const start = fromIdx === -1 ? -1 : fromIdx;
  for (let i = 1; i <= n; i++) {
    const candidate = seated[(start + i) % n];
    // Exclude the reference seat itself (never return the same seat).
    if (
      candidate !== undefined &&
      candidate.seat !== fromSeat &&
      candidate.state === 'active'
    ) {
      return candidate.seat;
    }
  }
  return null;
}

/** First seat to act on a new street: the first active seat left of the button. */
export function firstActiveAfterButton(hand: Hand): number | null {
  return nextActiveSeat(hand, hand.buttonSeat);
}

/**
 * Players who can still win the hand (active or all-in, i.e. not folded /
 * sitting out). When only one remains, the hand is uncontested.
 */
function contenderCount(hand: Hand): number {
  return hand.players.filter(
    (p) => p.state === 'active' || p.state === 'all_in',
  ).length;
}

/** True when at most one contender remains — the hand ends without showdown. */
export function isHandUncontested(hand: Hand): boolean {
  return contenderCount(hand) <= 1;
}

/**
 * True when the current street's betting round is over (docs/BETTING-ENGINE.md
 * §3). The round is complete when no one can still act, or when every player
 * who can act has acted this street and matched the current bet.
 *
 * Note: §3 phrases one condition as "at most one active player remains". We
 * use the stricter, correct rule — a lone active player facing an all-in must
 * still call or fold first — so the round closes only once that seat has acted
 * and matched (or folded, which makes the hand uncontested).
 */
export function isStreetComplete(hand: Hand): boolean {
  const active = hand.players.filter((p) => p.state === 'active');
  if (active.length === 0) return true;
  return active.every(
    (p) => p.hasActedThisStreet && p.committedThisStreet === hand.currentBet,
  );
}

function endBetting(hand: Hand): Hand {
  return {
    ...hand,
    status: 'awaiting_showdown',
    actingSeat: null,
    actionDeadline: null,
  };
}

function startNextStreet(hand: Hand, minBet: number): Hand {
  const reset: Hand = {
    ...hand,
    players: hand.players.map(resetForNewStreet),
    street: hand.street + 1,
    currentBet: 0,
    lastRaiseSize: minBet,
    actionDeadline: null,
  };
  return { ...reset, actingSeat: firstActiveAfterButton(reset) };
}

/**
 * Progresses the hand after an action (docs/BETTING-ENGINE.md §3):
 *
 * - If the hand is uncontested (≤1 contender), betting ends → awaiting_showdown.
 * - If the current street is not complete, the action passes to the next
 *   active seat clockwise.
 * - If the street is complete, advance to the next street (resetting per-street
 *   state and setting the first actor left of the button). Streets where no one
 *   can act (everyone all-in) are skipped; once the last street is reached or
 *   no one can act, betting ends → awaiting_showdown.
 *
 * Pure: returns a new Hand. Pots are not recomputed here; side pots are
 * derived from committedTotal at settlement (task 1.5).
 */
export function advanceHand(hand: Hand, options: AdvanceOptions): Hand {
  const streetCount = options.streetCount ?? DEFAULT_STREET_COUNT;

  if (isHandUncontested(hand)) {
    return endBetting(hand);
  }

  if (!isStreetComplete(hand)) {
    return {
      ...hand,
      actingSeat: nextActiveSeat(hand, hand.actingSeat ?? hand.buttonSeat),
    };
  }

  // Street complete: roll forward through streets until someone can act or
  // betting is over.
  let next = hand;
  while (isStreetComplete(next)) {
    if (next.street + 1 >= streetCount) {
      return endBetting(next);
    }
    next = startNextStreet(next, options.minBet);
    if (isHandUncontested(next)) {
      return endBetting(next);
    }
  }
  return next;
}
