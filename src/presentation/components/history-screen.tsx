'use client';

import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useReducedMotionPreference } from '@/presentation/animations';
import { getSocket } from '@/presentation/lib/socket';
import type {
  HistoryMine,
  PublicGameHistoryEntry,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';
import { buildGameHistory, formatNet, type HistoryRow } from './history-model';

const NET_TONE: Record<HistoryRow['kind'], string> = {
  win: 'text-vc-gold',
  loss: 'text-vc-danger',
  even: 'text-vc-ink-muted',
};

/**
 * The per-user game-history page (task 6.3). Reads the authenticated user's
 * finished games over `history:mine` and renders them as a tote-board list. All
 * shaping (sort, classify, formatting, the cumulative total) lives in
 * {@link buildGameHistory}; this component only renders precomputed fields.
 */
export function HistoryScreen(): React.ReactElement {
  const reduce = useReducedMotionPreference();
  const router = useRouter();
  const { status } = useSession();
  const connectionStatus = useConnectionStore((s) => s.status);
  const connected = connectionStatus === 'connected';
  // null = not loaded yet (loading); [] = loaded but the user has no games.
  const [games, setGames] = useState<readonly PublicGameHistoryEntry[] | null>(
    null,
  );

  // Signed-out users have no history; send them back to the lobby/login.
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  // Fetch the user's finished games. Copied verbatim from the lobby's
  // `rooms:mine` pattern (emit on connect + on session:ready, clean up both).
  useEffect(() => {
    const socket = getSocket();
    const onHistory = (data: HistoryMine): void => setGames(data.games);
    const fetchMine = (): void => {
      socket.emit('history:mine');
    };
    socket.on('history:mine', onHistory);
    socket.on('session:ready', fetchMine);
    if (socket.connected) fetchMine();
    return () => {
      socket.off('history:mine', onHistory);
      socket.off('session:ready', fetchMine);
    };
  }, []);

  // Until the session resolves — and while the redirect for a signed-out user is
  // in flight — render nothing protected. Mirrors home-screen, which never shows
  // protected UI before auth resolves. (status is 'loading' or 'unauthenticated'.)
  if (status !== 'authenticated') {
    return (
      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6">
        <p className="text-vc-ink-muted">Setting the table…</p>
      </main>
    );
  }

  const { rows, summary } = buildGameHistory(games ?? []);
  const loading = games === null;
  const empty = games !== null && games.length === 0;

  return (
    <main className="relative z-10 flex min-h-[100dvh] items-start justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tightish text-vc-ink">
            Your history
          </h1>
          <button
            onClick={() => router.push('/')}
            className="text-xs text-vc-ink-faint underline-offset-2 transition hover:text-vc-ink-muted hover:underline"
          >
            ← Back
          </button>
        </div>

        {!connected && (
          <p className="mb-4 rounded-xl border border-vc-gold/25 bg-vc-gold/10 px-4 py-2.5 text-sm text-vc-gold">
            Connecting to the table server…
          </p>
        )}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="vc-tray flex w-full flex-col gap-3 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-vc-gold">
              <span className="text-sm">◆</span> Finished games
            </div>
            {!loading && !empty && (
              <div className="text-right">
                <span
                  className={`font-mono text-base font-semibold tabular-nums ${
                    summary.totalNet > 0
                      ? 'text-vc-gold'
                      : summary.totalNet < 0
                        ? 'text-vc-danger'
                        : 'text-vc-ink-muted'
                  }`}
                >
                  {formatNet(summary.totalNet)}
                </span>
                <span className="ml-2 text-xs text-vc-ink-faint">
                  across {summary.gameCount}{' '}
                  {summary.gameCount === 1 ? 'game' : 'games'}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <p className="py-6 text-center text-vc-ink-muted">
              Counting the chips…
            </p>
          ) : empty ? (
            <p className="py-6 text-center text-vc-ink-muted">
              No finished games yet — play a hand to start your history.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <li
                  key={row.gameId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                >
                  <span className="min-w-0 text-sm text-vc-ink">
                    <span className="block truncate font-medium">
                      {row.roomName}
                    </span>
                    <span className="text-xs text-vc-ink-faint">
                      {row.endedAtLabel}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-base font-semibold tabular-nums ${NET_TONE[row.kind]}`}
                  >
                    {formatNet(row.net)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </main>
  );
}
