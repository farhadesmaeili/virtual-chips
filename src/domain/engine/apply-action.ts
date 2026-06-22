import {
  commit,
  fold,
  markActed,
  toCall,
  type ActionVerb,
  type PlayerInHand,
} from '../entities/player-in-hand';
import { getPlayer, updatePlayer, type Hand } from '../entities/hand';
import {
  HandNotInBettingError,
  InsufficientChipsError,
  InvalidActionError,
  InvalidRaiseError,
  NotYourTurnError,
} from '../errors';

/** A betting action's verb. Aliases the entity {@link ActionVerb} (one source). */
export type ActionType = ActionVerb;

export interface PlayerAction {
  readonly seat: number;
  readonly type: ActionType;
  /**
   * BET: the amount to bet. RAISE: the total to raise *to* (`raiseTo`).
   * Ignored for FOLD / CHECK / CALL / ALL_IN.
   */
  readonly amount?: number;
}

/**
 * Validates and applies a single player action to a Hand, returning the new
 * Hand (the input is never mutated). Invalid actions throw a typed
 * {@link import('../errors').DomainError}.
 *
 * This step applies the acting player's effects (chips, state), updates the
 * hand-level `currentBet` / `lastRaiseSize`, and reopens the action for other
 * active players after a full bet/raise. It does NOT pick the next seat or
 * close the street — that is the street state machine (roadmap task 1.4).
 *
 * `minBet` is the room's big blind (the minimum opening bet).
 *
 * Server-authoritative: all of this runs in the pure domain; never trust the
 * client for chip/pot values (see CLAUDE.md security rules).
 */
export function applyAction(
  hand: Hand,
  action: PlayerAction,
  minBet: number,
): Hand {
  if (hand.status !== 'betting') {
    throw new HandNotInBettingError(hand.status);
  }
  if (hand.actingSeat === null || hand.actingSeat !== action.seat) {
    throw new NotYourTurnError(action.seat, hand.actingSeat);
  }

  const player = getPlayer(hand, action.seat);
  if (player === undefined || player.state !== 'active') {
    throw new InvalidActionError(`seat ${action.seat} cannot act`);
  }

  const owed = toCall(player, hand.currentBet);

  // Apply the validated action, then stamp the player's `lastAction` with the
  // verb the engine just validated (no amount stored — the chips in front of the
  // seat already show that). The verb persists across streets until they act
  // again, and is null until then (set at hand start by `createPlayerInHand`).
  const applied = ((): Hand => {
    switch (action.type) {
      case 'FOLD':
        return updatePlayer(hand, player.seat, fold);

      case 'CHECK': {
        if (owed !== 0) {
          throw new InvalidActionError('cannot check while facing a bet');
        }
        return updatePlayer(hand, player.seat, markActed);
      }

      case 'CALL': {
        if (owed <= 0) {
          throw new InvalidActionError('nothing to call');
        }
        if (player.stack < owed) {
          // Not enough chips to call in full — the player must go all-in.
          throw new InsufficientChipsError(player.stack, owed);
        }
        return updatePlayer(hand, player.seat, (p) => commit(p, owed));
      }

      case 'BET':
        return applyBet(hand, player, action.amount, minBet);

      case 'RAISE':
        return applyRaise(hand, player, action.amount);

      case 'ALL_IN':
        return applyAllIn(hand, player);
    }
  })();

  return updatePlayer(applied, player.seat, (p) => ({
    ...p,
    lastAction: action.type,
  }));
}

function applyBet(
  hand: Hand,
  player: PlayerInHand,
  amount: number | undefined,
  minBet: number,
): Hand {
  if (hand.currentBet !== 0) {
    throw new InvalidActionError(
      'cannot bet while a bet exists; raise instead',
    );
  }
  if (amount === undefined) {
    throw new InvalidActionError('bet requires an amount');
  }
  if (!Number.isInteger(amount) || amount < minBet) {
    throw new InvalidActionError(
      `bet must be at least the minimum bet (${minBet})`,
    );
  }
  if (amount > player.stack) {
    throw new InsufficientChipsError(player.stack, amount);
  }
  const updated = updatePlayer(hand, player.seat, (p) => commit(p, amount));
  // Opening a bet sets the bet level and the raise size, and reopens action.
  return reopenAndSet(updated, player.seat, amount, amount);
}

function applyRaise(
  hand: Hand,
  player: PlayerInHand,
  raiseTo: number | undefined,
): Hand {
  if (hand.currentBet <= 0) {
    throw new InvalidActionError(
      'cannot raise without an existing bet; bet instead',
    );
  }
  if (raiseTo === undefined) {
    throw new InvalidRaiseError('raise requires a target amount');
  }
  const minRaiseTo = hand.currentBet + hand.lastRaiseSize;
  if (!Number.isInteger(raiseTo) || raiseTo < minRaiseTo) {
    throw new InvalidRaiseError(
      `raise must be to at least ${minRaiseTo} (currentBet ${hand.currentBet} + lastRaiseSize ${hand.lastRaiseSize})`,
    );
  }
  const maxRaiseTo = player.committedThisStreet + player.stack;
  if (raiseTo > maxRaiseTo) {
    // Cannot afford a full raise to this amount — must call or go all-in.
    throw new InsufficientChipsError(
      player.stack,
      raiseTo - player.committedThisStreet,
    );
  }
  const toCommit = raiseTo - player.committedThisStreet;
  const updated = updatePlayer(hand, player.seat, (p) => commit(p, toCommit));
  const raiseIncrement = raiseTo - hand.currentBet;
  return reopenAndSet(updated, player.seat, raiseTo, raiseIncrement);
}

function applyAllIn(hand: Hand, player: PlayerInHand): Hand {
  if (player.stack <= 0) {
    throw new InvalidActionError('player has no chips to go all-in');
  }
  const allInThisStreet = player.committedThisStreet + player.stack;
  const updated = updatePlayer(hand, player.seat, (p) => commit(p, p.stack));
  const newCurrentBet = Math.max(hand.currentBet, allInThisStreet);
  const increment = newCurrentBet - hand.currentBet;

  if (increment >= hand.lastRaiseSize && increment > 0) {
    // Full-size (or larger) all-in raise: behaves like a normal raise —
    // sets the new raise size and reopens action for everyone else.
    return reopenAndSet(updated, player.seat, newCurrentBet, increment);
  }
  if (increment > 0) {
    // Short all-in raise (smaller than a full min-raise): the bet level rises
    // but `lastRaiseSize` is left UNCHANGED and the action is NOT reopened for
    // players who have already acted (standard poker rule). So we only raise
    // the bet level without resetting anyone's `hasActedThisStreet`.
    return { ...updated, currentBet: newCurrentBet };
  }
  // All-in for at most the current bet: just a (possibly partial) call.
  return updated;
}

/**
 * Sets the new bet level / raise size and reopens the action: every other
 * active player must respond, so their `hasActedThisStreet` is reset. The
 * acting player (and any folded / all-in players) are left untouched.
 */
function reopenAndSet(
  hand: Hand,
  actingSeat: number,
  newCurrentBet: number,
  newLastRaiseSize: number,
): Hand {
  return {
    ...hand,
    currentBet: newCurrentBet,
    lastRaiseSize: newLastRaiseSize,
    players: hand.players.map((p) =>
      p.seat !== actingSeat && p.state === 'active'
        ? { ...p, hasActedThisStreet: false }
        : p,
    ),
  };
}
