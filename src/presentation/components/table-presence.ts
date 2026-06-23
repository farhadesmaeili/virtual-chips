// Pure helpers for the turn highlight + seat enter/exit (task 5.3). No I/O, no
// React — just deriving "which seat is highlighted" and stable presence keys
// from the authoritative room/hand state, so the branching is unit-tested.

import type {
  PublicHandPlayer,
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

/**
 * Whether a hand is currently live: there is a hand and it is not yet `settled`.
 * The single source of truth for the "settled/absent hand => not live" rule, so
 * the pot and the seats gate on the SAME predicate and can never diverge. A type
 * guard, so callers keep narrowing `hand` to non-null when this is true.
 */
export function isHandInPlay(
  hand: PublicHandState | null | undefined,
): hand is PublicHandState {
  return hand != null && hand.status !== 'settled';
}

/**
 * The seat's live in-hand projection, or `undefined` when no hand is live at the
 * seat (see {@link isHandInPlay}). A settled hand is a historical record (a
 * player who was all-in keeps `state: 'all_in'`), so the seat must stop reading
 * it once the hand ends and fall back to the member's persistent chips — the same
 * gate the pot uses, applied at the seat so the in-hand 'all in' label and bet
 * chips clear on settle instead of sticking until the next deal.
 */
export function seatHandPlayer(
  hand: PublicHandState | null | undefined,
  seat: number,
): PublicHandPlayer | undefined {
  if (!isHandInPlay(hand)) return undefined;
  return hand.players.find((p) => p.seat === seat);
}

/**
 * Seat the turn highlight should sit on, or null when no seat is acting.
 *
 * Only the `betting` status has a pending turn; in `awaiting_street`,
 * `awaiting_showdown`, `settled` (or with no hand) there is no highlight, even if
 * a stale `actingSeat` were present.
 */
export function highlightSeat(
  hand: PublicHandState | null | undefined,
): number | null {
  if (!hand || hand.status !== 'betting') return null;
  return hand.actingSeat;
}

/**
 * Stable `AnimatePresence` key for a seat slot. Encodes the occupant so that:
 * - an open seat and an occupied seat differ → join/leave cross-fades,
 * - a different player taking the seat differs → swap (exit + enter),
 * - a seated player who only sits out keeps the same key → no exit (just dims).
 *
 * Invariant: `username` is safe as the occupant identity because it is globally
 * unique (`User.username @unique`) and immutable (the user repository has no
 * update path — set once at registration), so it never collides or renames. The
 * projection deliberately hides the raw `userId`, so username is the right
 * public-safe identifier here.
 */
export function seatPresenceKey(
  seat: number,
  member: PublicRoomMember | undefined,
): string {
  return `${seat}:${member ? `user:${member.username}` : 'empty'}`;
}
