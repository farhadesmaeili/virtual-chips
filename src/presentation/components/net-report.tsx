'use client';

import { motion } from 'framer-motion';
import { useReducedMotionPreference } from '@/presentation/animations';
import type { NetReportRow } from './net-report-model';

export interface NetReportProps {
  /** Rows already shaped + sorted by {@link buildNetReport}. */
  readonly rows: readonly NetReportRow[];
  /** Rake carved out of the zero-sum total (0 until rake is configurable). */
  readonly rake: number;
}

const NET_TONE: Record<NetReportRow['kind'], string> = {
  win: 'text-vc-gold',
  loss: 'text-vc-danger',
  even: 'text-vc-ink-muted',
};

/**
 * The end-of-game settlement report (task 6.2): each seat's net for the whole
 * game, biggest winner first. Pure presentation — it renders the rows handed to
 * it by {@link buildNetReport} and never computes a net itself. Styling mirrors
 * the showdown tray (vc-tray; money in mono + tabular-nums).
 */
export function NetReport({ rows, rake }: NetReportProps): React.ReactElement {
  const reduce = useReducedMotionPreference();
  const fmt = (net: number): string =>
    `${net > 0 ? '+' : ''}${net.toLocaleString()}`;

  return (
    <div className="flex justify-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="vc-tray flex w-full max-w-xl flex-col gap-3 p-4"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-vc-gold">
          <span className="text-sm">◆</span> Final settlement
        </div>

        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={row.seat}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              <span className="text-sm text-vc-ink">
                <span className="font-medium">{row.username}</span>
                <span className="text-vc-ink-faint">
                  {' '}
                  · seat {row.seat + 1}
                </span>
              </span>
              <span
                className={`font-mono text-base font-semibold tabular-nums ${NET_TONE[row.kind]}`}
              >
                {fmt(row.net)}
              </span>
            </li>
          ))}
        </ul>

        {rake > 0 && (
          <p className="text-right text-xs text-vc-ink-muted">
            Rake{' '}
            <span className="font-mono tabular-nums">
              {rake.toLocaleString()}
            </span>
          </p>
        )}
      </motion.div>
    </div>
  );
}
