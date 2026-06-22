// Pure helpers for the turn highlight + seat enter/exit (task 5.3). No I/O, no
// React — just deriving "which seat is highlighted" and stable presence keys
// from the authoritative room/hand state, so the branching is unit-tested.

import type {
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

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
