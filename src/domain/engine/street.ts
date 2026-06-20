import type { Hand } from '../entities/hand';
import { resetForNewStreet } from '../entities/player-in-hand';

/** Default number of betting streets (preflop/flop/turn/river-style). */
export const DEFAULT_STREET_COUNT = 4;

/** Display names of the betting streets by index. */
export const STREET_NAMES = ['Preflop', 'Flop', 'Turn', 'River'] as const;

/** Human name of a street index; falls back to "Street N" past the river. */
export function streetName(street: number): string {
  return STREET_NAMES[street] ?? `Street ${street + 1}`;
}

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

function isLastStreet(hand: Hand, streetCount: number): boolean {
  return hand.street + 1 >= streetCount;
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
 * Pauses a hand whose current street's betting is settled. The banker paces the
 * physical game (task 4.7): on any street but the last, the hand waits for the
 * banker to deal the next street; on the final street it goes to showdown for
 * settlement. No turn is pending either way.
 */
function pauseAfterStreet(hand: Hand, streetCount: number): Hand {
  return {
    ...hand,
    status: isLastStreet(hand, streetCount)
      ? 'awaiting_showdown'
      : 'awaiting_street',
    actingSeat: null,
    actionDeadline: null,
  };
}

/**
 * Progresses the hand after an action (docs/BETTING-ENGINE.md §3):
 *
 * - If the hand is uncontested (≤1 contender), betting ends → awaiting_showdown.
 * - If the current street is not complete, the action passes to the next active
 *   seat clockwise.
 * - If the street's betting is complete, the hand pauses: the banker must deal
 *   the next street (`awaiting_street`), or — on the final street — it goes to
 *   `awaiting_showdown`. It never auto-deals the next street (task 4.7).
 *
 * Pure: returns a new Hand. Pots are not recomputed here; side pots are derived
 * from committedTotal at settlement (task 1.5).
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

  return pauseAfterStreet(hand, streetCount);
}

/**
 * Deals the next street at the banker's confirmation (task 4.7). The caller
 * (the AdvanceStreet use-case) must have verified the hand is `awaiting_street`.
 *
 * Resets per-street state and sets the first actor left of the button. If the
 * newly dealt street has no one who can act (everyone is all-in), it pauses
 * again so the banker keeps pacing the run-out street by street to the river —
 * streets are never auto-skipped.
 *
 * Pure: returns a new Hand.
 */
export function dealNextStreet(hand: Hand, options: AdvanceOptions): Hand {
  const streetCount = options.streetCount ?? DEFAULT_STREET_COUNT;
  const next = startNextStreet(hand, options.minBet);

  if (isHandUncontested(next)) {
    return endBetting(next);
  }
  // No betting is possible on the new street (all-in run-out) → pause/settle.
  if (isStreetComplete(next)) {
    return pauseAfterStreet(next, streetCount);
  }
  return { ...next, status: 'betting' };
}
