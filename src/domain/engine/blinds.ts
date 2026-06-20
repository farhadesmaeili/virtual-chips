import { getPlayer, updatePlayer, type Hand } from '../entities/hand';
import { commit } from '../entities/player-in-hand';
import { nextActiveSeat } from './street';

/**
 * Positions involved in posting the blinds, derived purely from seating order
 * (clockwise from the button). Stacks do not affect position.
 */
interface BlindPositions {
  readonly smallBlindSeat: number;
  readonly bigBlindSeat: number;
  /** Seat that acts first preflop. */
  readonly firstToActSeat: number;
}

/**
 * Resolves the blind seats and the first preflop actor from the seating order.
 *
 * Full ring (3+ active): SB is the first active seat left of the button, BB the
 * next, and the first actor the seat left of the BB. Heads-up (exactly two
 * active players) is reversed: the button posts the SB and acts first preflop,
 * the other player posts the BB.
 */
function resolveBlindPositions(hand: Hand): BlindPositions {
  const active = hand.players.filter((p) => p.state === 'active');
  if (active.length < 2) {
    throw new Error('postBlinds requires at least two active players');
  }

  if (active.length === 2) {
    // Heads-up: the button is the small blind and acts first preflop.
    const bigBlindSeat = nextActiveSeat(hand, hand.buttonSeat);
    if (bigBlindSeat === null) {
      throw new Error('heads-up hand is missing the big-blind seat');
    }
    return {
      smallBlindSeat: hand.buttonSeat,
      bigBlindSeat,
      firstToActSeat: hand.buttonSeat,
    };
  }

  const smallBlindSeat = nextActiveSeat(hand, hand.buttonSeat);
  if (smallBlindSeat === null) {
    throw new Error('cannot place the small blind');
  }
  const bigBlindSeat = nextActiveSeat(hand, smallBlindSeat);
  if (bigBlindSeat === null) {
    throw new Error('cannot place the big blind');
  }
  const firstToActSeat = nextActiveSeat(hand, bigBlindSeat);
  if (firstToActSeat === null) {
    throw new Error('cannot place the first actor');
  }
  return { smallBlindSeat, bigBlindSeat, firstToActSeat };
}

/**
 * Posts a forced blind at `seat`: commits `min(stack, amount)` chips, leaving
 * the player all-in if the blind covers their whole stack. Unlike a voluntary
 * action, a blind does NOT count as having acted this street — the poster keeps
 * the option to raise when the action returns to them (the big-blind option).
 */
function postBlind(hand: Hand, seat: number, amount: number): Hand {
  return updatePlayer(hand, seat, (p) => {
    const posted = commit(p, Math.min(p.stack, amount));
    // Forced bet: clear the "acted" flag set by commit so the option is kept.
    return { ...posted, hasActedThisStreet: false };
  });
}

/**
 * Posts the small and big blinds at the start of a hand (docs/BETTING-ENGINE.md
 * §2). Pure: no I/O, time, or randomness — returns a new Hand.
 *
 * - The SB and BB seats are chosen by position; a short stack posts all-in for
 *   whatever it has.
 * - `currentBet` and `lastRaiseSize` are set to the *nominal* big blind even if
 *   the BB poster could not cover it (a short all-in does not lower the bet to
 *   match, and the minimum preflop raise stays at 2× the big blind).
 * - Blind chips flow through committedThisStreet/committedTotal, so side-pot and
 *   settlement math picks them up with no separate pot mutation.
 * - `actingSeat` is set to the first preflop actor (skipping any seat that went
 *   all-in posting a blind, e.g. a heads-up button posting an all-in SB).
 */
export function postBlinds(
  hand: Hand,
  smallBlind: number,
  bigBlind: number,
): Hand {
  const { smallBlindSeat, bigBlindSeat, firstToActSeat } =
    resolveBlindPositions(hand);

  const posted = postBlind(
    postBlind(hand, smallBlindSeat, smallBlind),
    bigBlindSeat,
    bigBlind,
  );

  // The bet to match is always the nominal big blind, regardless of a short
  // all-in by the BB poster.
  const withBet: Hand = {
    ...posted,
    currentBet: bigBlind,
    lastRaiseSize: bigBlind,
  };

  // The canonical first actor may have gone all-in posting a blind (heads-up
  // button posting a short SB); fall back to the next seat that can still act.
  const canonical = getPlayer(withBet, firstToActSeat);
  const actingSeat =
    canonical !== undefined && canonical.state === 'active'
      ? firstToActSeat
      : nextActiveSeat(withBet, firstToActSeat);

  return { ...withBet, actingSeat };
}
