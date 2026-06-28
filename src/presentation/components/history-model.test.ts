import { describe, expect, it } from 'vitest';
import type { PublicGameHistoryEntry } from '@/presentation/lib/socket-events';
import { buildGameHistory, formatNet } from './history-model';

const entry = (
  gameId: string,
  net: number,
  endedAt: string,
  roomName = `room-${gameId}`,
): PublicGameHistoryEntry => ({ gameId, net, roomName, endedAt });

// Three finished games at distinct times: a win, a loss, and a flat game.
const GAMES: readonly PublicGameHistoryEntry[] = [
  entry('g1', 800, '2026-06-26T20:00:00.000Z'),
  entry('g2', -300, '2026-06-27T20:00:00.000Z'),
  entry('g3', 0, '2026-06-25T20:00:00.000Z'),
];

describe('buildGameHistory', () => {
  it('classifies a positive net as win, negative as loss, zero as even', () => {
    const { rows } = buildGameHistory(GAMES);
    expect(rows.find((r) => r.gameId === 'g1')?.kind).toBe('win');
    expect(rows.find((r) => r.gameId === 'g2')?.kind).toBe('loss');
    expect(rows.find((r) => r.gameId === 'g3')?.kind).toBe('even');
  });

  it('passes net through verbatim and derives a non-empty endedAtLabel', () => {
    const { rows } = buildGameHistory([
      entry('g1', 800, '2026-06-26T20:00:00.000Z'),
    ]);
    const row = rows.find((r) => r.gameId === 'g1');
    expect(row?.net).toBe(800);
    expect(row?.roomName).toBe('room-g1');
    expect(row?.endedAtLabel.length).toBeGreaterThan(0);
  });

  it('returns empty rows and a zero summary for no games', () => {
    expect(buildGameHistory([])).toEqual({
      rows: [],
      summary: { totalNet: 0, gameCount: 0 },
    });
  });

  it('sums totalNet across mixed-sign nets (cumulative)', () => {
    // 800 + (-300) + 0 = 500.
    const { summary } = buildGameHistory(GAMES);
    expect(summary.totalNet).toBe(500);
  });

  it('sets gameCount to the number of games', () => {
    expect(buildGameHistory(GAMES).summary.gameCount).toBe(3);
  });

  it('sorts newest-first by endedAt regardless of input order', () => {
    // Input is g1, g2, g3; chronological is g3 (25th) < g1 (26th) < g2 (27th),
    // so newest-first is g2, g1, g3.
    const { rows } = buildGameHistory(GAMES);
    expect(rows.map((r) => r.gameId)).toEqual(['g2', 'g1', 'g3']);
  });

  it('breaks equal-timestamp ties by gameId for a stable order', () => {
    const sameTime = '2026-06-27T20:00:00.000Z';
    const { rows } = buildGameHistory([
      entry('b', 10, sameTime),
      entry('a', 20, sameTime),
    ]);
    expect(rows.map((r) => r.gameId)).toEqual(['a', 'b']);
  });
});

describe('formatNet', () => {
  it('prefixes a win with +', () => {
    expect(formatNet(800)).toBe('+800');
  });

  it('keeps the native - for a loss', () => {
    expect(formatNet(-300)).toBe('-300');
  });

  it('renders an even net without a sign', () => {
    expect(formatNet(0)).toBe('0');
  });
});
