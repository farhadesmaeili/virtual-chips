// Pure derivation of the per-user game-history view (task 6.3). The server
// (history:mine) sends each finished game's net read straight from the persisted
// Settlement rows; this module only shapes those authoritative nets for display.
// It never recomputes a net from chips, and `totalNet` is a plain sum of the
// nets the server sent — never derived from RoomMember or anything else.

import type { PublicGameHistoryEntry } from '@/presentation/lib/socket-events';

/** How a row reads at a glance: a win, a loss, or flat. */
export type NetKind = 'win' | 'loss' | 'even';

/** One display row of the history list, shaped from a server entry. */
export interface HistoryRow {
  readonly gameId: string;
  readonly roomName: string;
  readonly net: number;
  readonly kind: NetKind;
  readonly endedAtLabel: string;
}

/** Cumulative figures across the listed games (the header "tote board"). */
export interface HistorySummary {
  readonly totalNet: number;
  readonly gameCount: number;
}

/** The full shaped history: display rows plus the cumulative summary. */
export interface GameHistory {
  readonly rows: readonly HistoryRow[];
  readonly summary: HistorySummary;
}

const classify = (net: number): NetKind =>
  net > 0 ? 'win' : net < 0 ? 'loss' : 'even';

/**
 * Formats a net for display: a leading `+` for wins, the native `-` for losses,
 * grouped digits via `toLocaleString`. Mirrors the net-report's formatting.
 */
export function formatNet(net: number): string {
  return `${net > 0 ? '+' : ''}${net.toLocaleString()}`;
}

/** A short, human label for the ISO `endedAt` timestamp. */
function formatEndedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Shapes the authoritative finished-game entries into display rows + a summary.
 *
 * - `net` is passed through verbatim from `history:mine`; it is never recomputed.
 * - Rows sort newest-first by `endedAt` (descending), with `gameId` as a stable
 *   tiebreak. The server already orders newest-first, but we don't rely on it.
 * - `totalNet` is the plain sum of the nets across the listed games (a pure
 *   reduce); `gameCount` is the number of games.
 */
export function buildGameHistory(
  games: readonly PublicGameHistoryEntry[],
): GameHistory {
  // Sort the source entries newest-first (by the raw ISO timestamp, not the
  // localized label), with gameId as a stable tiebreak, then shape each one.
  const rows: HistoryRow[] = [...games]
    .sort(
      (a, b) =>
        new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime() ||
        a.gameId.localeCompare(b.gameId),
    )
    .map((g) => ({
      gameId: g.gameId,
      roomName: g.roomName,
      net: g.net,
      kind: classify(g.net),
      endedAtLabel: formatEndedAt(g.endedAt),
    }));

  const totalNet = rows.reduce((acc, r) => acc + r.net, 0);

  return { rows, summary: { totalNet, gameCount: rows.length } };
}
