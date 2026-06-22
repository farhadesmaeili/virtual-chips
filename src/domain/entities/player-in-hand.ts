import { Chips } from '../value-objects/chips';

export type PlayerState = 'active' | 'folded' | 'all_in' | 'sitting_out';

/**
 * A chosen betting action's verb (no amount). Lives in the entities layer so
 * `PlayerInHand` can record a player's last move without depending on the engine
 * (the engine's `ActionType` aliases this).
 */
export type ActionVerb = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

/**
 * Time-bank extensions each player starts a hand with (task 4.12). The budget
 * lives per-hand on PlayerInHand, so it refreshes automatically every hand (the
 * player is rebuilt at hand start). Defined here, next to the field it seeds, so
 * the entities layer never has to depend on the engine.
 */
export const DEFAULT_TIME_EXTENSIONS = 2;

/**
 * A player's state within a single Hand. Immutable: every transition returns
 * a new PlayerInHand. Chip fields are plain numbers so the whole Hand state
 * stays JSON-serializable; arithmetic is validated through the Chips VO.
 */
export interface PlayerInHand {
  readonly seat: number;
  readonly userId: string;
  /** Remaining chips behind. */
  readonly stack: number;
  /** Chips committed during the current street. */
  readonly committedThisStreet: number;
  /** Chips committed over the whole Hand (used for side-pot layering). */
  readonly committedTotal: number;
  readonly state: PlayerState;
  readonly hasActedThisStreet: boolean;
  /**
   * The player's last chosen action this hand (verb only, no amount), or null
   * before they act. Cleared at hand start (a fresh player each hand) and
   * persists across streets until the player acts again. Forced blinds are NOT
   * a chosen action, so blind posters keep this null. Set by the engine.
   */
  readonly lastAction: ActionVerb | null;
  /** Remaining time-bank extensions this hand (task 4.12). */
  readonly timeExtensionsRemaining: number;
}

export interface CreatePlayerInHandInput {
  seat: number;
  userId: string;
  stack: number;
  state?: PlayerState;
}

export function createPlayerInHand(
  input: CreatePlayerInHandInput,
): PlayerInHand {
  // Validate the starting stack through the Chips value object.
  const stack = Chips.of(input.stack).value;
  return {
    seat: input.seat,
    userId: input.userId,
    stack,
    committedThisStreet: 0,
    committedTotal: 0,
    state: input.state ?? 'active',
    hasActedThisStreet: false,
    lastAction: null,
    timeExtensionsRemaining: DEFAULT_TIME_EXTENSIONS,
  };
}

export function isActive(p: PlayerInHand): boolean {
  return p.state === 'active';
}

export function isFolded(p: PlayerInHand): boolean {
  return p.state === 'folded';
}

export function isAllIn(p: PlayerInHand): boolean {
  return p.state === 'all_in';
}

export function isSittingOut(p: PlayerInHand): boolean {
  return p.state === 'sitting_out';
}

/** Only `active` players can be asked to act (all-in / folded / out cannot). */
export function canAct(p: PlayerInHand): boolean {
  return p.state === 'active';
}

/** Chips the player still needs to put in to match `currentBet` this street. */
export function toCall(p: PlayerInHand, currentBet: number): number {
  return Math.max(0, currentBet - p.committedThisStreet);
}

/**
 * Commits `amount` chips from the player's stack to the current street.
 * The player becomes `all_in` when this empties their stack. Throws
 * {@link InsufficientChipsError} (via Chips) if the amount exceeds the stack.
 * Returns a new PlayerInHand; the input is not mutated.
 */
export function commit(p: PlayerInHand, amount: number): PlayerInHand {
  const toCommit = Chips.of(amount);
  const newStack = Chips.of(p.stack).subtract(toCommit);
  const becomesAllIn = newStack.isZero() && !toCommit.isZero();
  return {
    ...p,
    stack: newStack.value,
    committedThisStreet: Chips.of(p.committedThisStreet).add(toCommit).value,
    committedTotal: Chips.of(p.committedTotal).add(toCommit).value,
    state: becomesAllIn ? 'all_in' : p.state,
    hasActedThisStreet: true,
  };
}

/** Marks the player as having acted (e.g. a CHECK that moves no chips). */
export function markActed(p: PlayerInHand): PlayerInHand {
  return { ...p, hasActedThisStreet: true };
}

/** Folds the player out of the Hand. */
export function fold(p: PlayerInHand): PlayerInHand {
  return { ...p, state: 'folded', hasActedThisStreet: true };
}

/**
 * Resets per-street fields when a new street begins: clears
 * `committedThisStreet`, `hasActedThisStreet`, and `lastAction`. Betting
 * restarts from zero each street (currentBet=0, committedThisStreet=0), so a
 * prior street's action verb is stale and must not be displayed. The
 * player's `committedTotal` and lifecycle `state` (folded / all_in) are
 * preserved — fold/all-in status is tracked by `state`, not by `lastAction`.
 */
export function resetForNewStreet(p: PlayerInHand): PlayerInHand {
  return {
    ...p,
    committedThisStreet: 0,
    hasActedThisStreet: false,
    lastAction: null,
  };
}
