// Pure derivation of which betting actions the hero may take, mirroring the
// server engine (domain/engine/apply-action.ts). This drives what the action
// panel offers — but it is only a hint: the server stays authoritative and
// re-validates every action, so the UI never confirms anything itself.

import type {
  PublicHandState,
  PublicHandPlayer,
} from '@/presentation/lib/socket-events';

/** The action verbs sent to the server on `player:act`. */
export type ActionKind = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

/** A slider/input range for sizing a bet or raise (amounts in chips). */
export interface SizingRange {
  /** 'bet' opens the betting (amount = bet size); 'raise' faces a bet (amount
   * = the total to raise *to*, matching the server's `raiseTo`). */
  readonly mode: 'bet' | 'raise';
  /** Smallest legal amount (the min bet, or the min-raise total). */
  readonly min: number;
  /** Largest legal amount in the same units (a full all-in). */
  readonly max: number;
  /** Sizing increment (the big blind). */
  readonly step: number;
}

export interface ActionAvailability {
  readonly isHeroTurn: boolean;
  /** Chips owed to match the current bet this street. */
  readonly toCall: number;
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly canCall: boolean;
  /** Present when a full bet or raise is affordable; null otherwise. */
  readonly sizing: SizingRange | null;
  readonly canAllIn: boolean;
  /** Chips the hero commits this street by going all-in (for the label). */
  readonly allInTo: number;
}

const NONE: ActionAvailability = {
  isHeroTurn: false,
  toCall: 0,
  canFold: false,
  canCheck: false,
  canCall: false,
  sizing: null,
  canAllIn: false,
  allInTo: 0,
};

/**
 * Derives the hero's legal actions from the live hand. `heroSeat` is the seat
 * the current user occupies (null if they are not in the hand). `bigBlind` is
 * the room's minimum bet / sizing step.
 */
export function deriveActions(
  hand: PublicHandState | null,
  heroSeat: number | null,
  bigBlind: number,
): ActionAvailability {
  if (hand === null || heroSeat === null || hand.status !== 'betting') {
    return NONE;
  }
  const hero: PublicHandPlayer | undefined = hand.players.find(
    (p) => p.seat === heroSeat,
  );
  if (
    hero === undefined ||
    hero.state !== 'active' ||
    hand.actingSeat !== heroSeat
  ) {
    return NONE;
  }

  const toCall = Math.max(0, hand.currentBet - hero.committedThisStreet);
  const canCheck = toCall === 0;
  // A call must be affordable in full; otherwise the only move is all-in.
  const canCall = toCall > 0 && hero.stack >= toCall;
  const canAllIn = hero.stack > 0;
  const allInTo = hero.committedThisStreet + hero.stack;

  let sizing: SizingRange | null = null;
  if (hand.currentBet === 0) {
    // Opening bet: at least the big blind, up to the whole stack.
    if (hero.stack >= bigBlind) {
      sizing = { mode: 'bet', min: bigBlind, max: hero.stack, step: bigBlind };
    }
  } else {
    // Facing a bet: a full raise must reach currentBet + lastRaiseSize and be
    // affordable (allInTo covers it). Below that, the player can only call/all-in.
    const minRaiseTo = hand.currentBet + hand.lastRaiseSize;
    if (allInTo >= minRaiseTo) {
      sizing = { mode: 'raise', min: minRaiseTo, max: allInTo, step: bigBlind };
    }
  }

  return {
    isHeroTurn: true,
    toCall,
    canFold: true,
    canCheck,
    canCall,
    sizing,
    canAllIn,
    allInTo,
  };
}
