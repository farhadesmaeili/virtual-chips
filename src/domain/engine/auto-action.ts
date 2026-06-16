import type { Hand } from '../entities/hand';
import { toCall } from '../entities/player-in-hand';

export type AutoActionType = 'CHECK' | 'FOLD';

/**
 * The action the server applies for the acting player when their time runs out
 * (docs/BETTING-ENGINE.md §6): CHECK when nothing is owed, otherwise FOLD.
 * Returns null when there is no one to act on.
 */
export function autoActionType(hand: Hand): AutoActionType | null {
  if (hand.actingSeat === null) return null;
  const player = hand.players.find((p) => p.seat === hand.actingSeat);
  if (player === undefined) return null;
  return toCall(player, hand.currentBet) === 0 ? 'CHECK' : 'FOLD';
}
