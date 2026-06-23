// Pure helpers for the win celebration (task 5.4). No React, no I/O.
//
// Celebration is derived from the SAME internal ChipMotion model that drives the
// 5.1 chip flights (`motion.awards`), NOT from the raw `hand:settled` socket
// payload. Two consequences:
//   - It inherits 5.1's live-only / no-replay guarantee: a snapshot/hydration
//     produces no ChipMotion (`planChipMotion({ type: 'snapshot' }) === null`),
//     so a mid-hand resync raises no celebration.
//   - It is insulated from the payouts[]/awards[] socket-contract doc-drift:
//     reading the internal mapped model means reconciling that drift later can't
//     break it.

import { seatPoint, type ChipMotion, type Point } from './chip-motion';

/** A single win-celebration flourish, positioned at a winning seat. */
export interface CelebrationBurst {
  readonly seat: number;
  readonly amount: number;
  /** Seat center in overlay %, from the shared seat geometry. */
  readonly at: Point;
}

/**
 * Expand a chip motion into win-celebration bursts: one per winning seat for a
 * `to-winners` settlement, and none for anything else (a `to-pot` commit or a
 * null motion). Because the only source of a `to-winners` motion is a LIVE
 * `hand:settled`, this never fires on a snapshot/resync.
 */
export function celebrationBursts(
  motion: ChipMotion | null,
): CelebrationBurst[] {
  if (motion === null || motion.kind !== 'to-winners') return [];
  return motion.awards.map((award) => ({
    seat: award.seat,
    amount: award.amount,
    at: seatPoint(award.seat),
  }));
}
