import { getPlayer, updatePlayer, type Hand } from '@/domain/entities';
import {
  HandNotInBettingError,
  NoTimeBankError,
  NotYourTurnError,
} from '@/domain/errors';

/** Milliseconds added to the acting player's deadline per extension (task 4.12). */
export const TIME_EXTENSION_MS = 15_000;

/**
 * Grants one time-bank extension to the acting seat: pushes the action deadline
 * out by `extensionMs` and decrements that player's remaining extensions. Pure —
 * it holds all the rejection logic and never touches I/O.
 *
 * Rejections (server-authoritative; the caller maps the requester to a seat):
 * - {@link HandNotInBettingError} when no turn is pending (status not 'betting',
 *   or no acting seat) — nothing to extend.
 * - {@link NotYourTurnError} when `seat` is not the acting seat.
 * - {@link NoTimeBankError} when the acting player has no extensions left.
 *
 * `now` is only used as the base when the hand somehow has no deadline set; in
 * a normal betting turn `actionDeadline` is always present.
 */
export function extendDeadline(
  hand: Hand,
  seat: number,
  extensionMs: number,
  now: number,
): Hand {
  if (hand.status !== 'betting' || hand.actingSeat === null) {
    throw new HandNotInBettingError(hand.status);
  }
  if (hand.actingSeat !== seat) {
    throw new NotYourTurnError(seat, hand.actingSeat);
  }
  const player = getPlayer(hand, seat);
  if (player === undefined) {
    // The acting seat always maps to a real player; defensive only.
    throw new NotYourTurnError(seat, hand.actingSeat);
  }
  if (player.timeExtensionsRemaining <= 0) {
    throw new NoTimeBankError(seat);
  }

  const base = hand.actionDeadline ?? now;
  const next = updatePlayer(hand, seat, (p) => ({
    ...p,
    timeExtensionsRemaining: p.timeExtensionsRemaining - 1,
  }));
  return { ...next, actionDeadline: base + extensionMs };
}
