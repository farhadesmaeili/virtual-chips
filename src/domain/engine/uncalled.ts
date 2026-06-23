import type { Hand } from '../entities/hand';
import type { PlayerInHand } from '../entities/player-in-hand';
import { Chips } from '../value-objects/chips';

/** A seat is non-folded (can still win) when active or all-in — the same
 * predicate `calculateSidePotsForPlayers` uses to mark contributions. */
function canWin(p: PlayerInHand): boolean {
  return p.state === 'active' || p.state === 'all_in';
}

/**
 * Returns an over-committer's uncalled chips at street close (pure: a new Hand,
 * the input is never mutated). docs/BETTING-ENGINE.md §4 assumes uncalled bets
 * are already returned before side pots are peeled; this is that step.
 *
 * The uncalled amount is computed on the SAME contribution model the side-pot
 * builder uses (`committedTotal`, with folded = not active/all-in), so that
 * returning here and then peeling reproduces settlement exactly — the live
 * projection and settlement read one already-corrected state.
 *
 * U = committedTotal[top] − (second-highest committedTotal across ALL seats),
 * applied only when a single NON-FOLDED seat uniquely holds the maximum. Folded
 * contributors DO cap U: their chips physically fund the same pot layers, so the
 * aggressor's wager up to a folded seat's level was matched (it becomes dead
 * money the aggressor may win, not an uncalled refund). Excluding them would
 * over-refund and strand dead money in a pot with no eligible seat.
 *
 * No return is owed when: the top is tied (no lone over-committer), the unique
 * top seat is folded (forfeited chips are never refunded), or U ≤ 0 (the bet was
 * fully matched / a short all-in below the call).
 *
 * Idempotent: after a refund the top seat's committedTotal equals the runner-up,
 * so a second call finds no unique maximum and returns the hand unchanged. This
 * keeps it safe to invoke on every street-close of an all-in run-out — the
 * return happens once, in the street it arose, and is a no-op thereafter.
 */
export function returnUncalledBet(hand: Hand): Hand {
  const totals = hand.players.map((p) => p.committedTotal);
  if (totals.length === 0) return hand;

  const max = Math.max(...totals);
  const topSeats = hand.players.filter((p) => p.committedTotal === max);
  // A tie at the top (or an all-zero pot) means nothing is uncalled.
  if (topSeats.length !== 1) return hand;

  const top = topSeats[0];
  if (top === undefined || !canWin(top)) return hand;

  // Second-highest committedTotal across every OTHER seat (folded included).
  const secondHighest = hand.players.reduce(
    (m, p) => (p.seat === top.seat ? m : Math.max(m, p.committedTotal)),
    0,
  );
  const uncalled = max - secondHighest;
  if (uncalled <= 0) return hand;

  const u = Chips.of(uncalled);
  return {
    ...hand,
    // The over-bet set `currentBet`; lower it back to the matched level. By the
    // street-close invariant (prior streets already balanced) u ≤ the top seat's
    // committedThisStreet === currentBet, so this stays non-negative.
    currentBet: Chips.of(hand.currentBet).subtract(u).value,
    players: hand.players.map((p) => (p.seat === top.seat ? refund(p, u) : p)),
  };
}

/**
 * Refunds `u` uncalled chips to a seat: back to the stack, out of both committed
 * counters, and — since the seat now has chips behind — back to `active` if it
 * had been all-in. `Chips.subtract` throws {@link import('../errors').InsufficientChipsError}
 * if `u` ever exceeds what the seat committed this street (an impossible state by
 * the street-close invariant), surfacing a bug loudly instead of corrupting chips.
 */
function refund(p: PlayerInHand, u: Chips): PlayerInHand {
  return {
    ...p,
    stack: Chips.of(p.stack).add(u).value,
    committedThisStreet: Chips.of(p.committedThisStreet).subtract(u).value,
    committedTotal: Chips.of(p.committedTotal).subtract(u).value,
    state: p.state === 'all_in' ? 'active' : p.state,
  };
}
