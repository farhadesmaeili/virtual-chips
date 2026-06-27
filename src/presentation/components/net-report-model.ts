// Pure derivation of the end-of-game net settlement report (task 6.2). When the
// banker ends the game the server broadcasts `game:ended` with each seat's net
// (RoomMember.chips − buyInTotal; zero-sum, with any rake carved out). This
// module only shapes those authoritative nets for display — it never recomputes
// a net from chips, and it never folds rake into a seat's net.

import type {
  GameEnded,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

/** How a row reads at a glance: a winner, a loser, or flat. */
export type NetKind = 'win' | 'loss' | 'even';

/** One display row of the net report, resolved against the room's members. */
export interface NetReportRow {
  readonly seat: number;
  readonly username: string;
  readonly net: number;
  readonly kind: NetKind;
}

const classify = (net: number): NetKind =>
  net > 0 ? 'win' : net < 0 ? 'loss' : 'even';

/**
 * Shapes the authoritative per-seat nets into sorted display rows.
 *
 * - `net` is passed through verbatim from `game:ended` (the chips − buyInTotal
 *   ledger); it is never recomputed here.
 * - Rows sort by net descending (biggest winner first), with seat as a stable
 *   tiebreak so equal nets keep a deterministic order.
 * - `username` resolves from `members`; a member who left before the game ended
 *   falls back to `Seat <n>`, matching the rest of the UI's nameOf fallback.
 * - This stays rake-agnostic: rake is reported separately by the component, not
 *   subtracted from any seat here.
 */
export function buildNetReport(
  nets: GameEnded['nets'],
  members: readonly PublicRoomMember[],
): readonly NetReportRow[] {
  const nameOf = (seat: number): string =>
    members.find((m) => m.seat === seat)?.username ?? `Seat ${seat}`;

  return nets
    .map((n) => ({
      seat: n.seat,
      username: nameOf(n.seat),
      net: n.net,
      kind: classify(n.net),
    }))
    .sort((a, b) => b.net - a.net || a.seat - b.seat);
}
