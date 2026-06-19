'use client';

import { motion } from 'framer-motion';

export interface BankerBarProps {
  /** Whether a hand is currently in play (controls are limited until it ends). */
  readonly handInPlay: boolean;
  /** True once a hand has been settled — the deal button reads "Start next hand". */
  readonly resuming: boolean;
  /** True while a start request awaits the next hand state. */
  readonly pending: boolean;
  /** A friendly error to surface here (e.g. a failed deal), or null. */
  readonly error: string | null;
  readonly onStartHand: () => void;
}

/**
 * Minimal banker controls (task 4.3 needs a way to deal so the action flow can
 * be tested end-to-end). The full banker view — blinds, buy-in control, ending
 * the game and declaring winners — lands in task 4.6; this is only the deal
 * button. Rendered only for the banker.
 */
export function BankerBar({
  handInPlay,
  resuming,
  pending,
  error,
  onStartHand,
}: BankerBarProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-vc-ink-muted">
          <span className="text-vc-gold">◆</span> You are the banker
        </span>
        {handInPlay ? (
          <span className="text-xs text-vc-ink-faint">Hand in play</span>
        ) : (
          <motion.button
            whileTap={pending ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.12 }}
            disabled={pending}
            onClick={onStartHand}
            className="rounded-lg border border-vc-gold/50 bg-vc-gold/10 px-4 py-1.5 text-sm font-semibold text-vc-gold transition hover:bg-vc-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resuming ? 'Start next hand' : 'Start hand'}
          </motion.button>
        )}
      </div>
      {error !== null && !handInPlay && (
        <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-1.5 text-sm text-vc-danger">
          {error}
        </p>
      )}
    </div>
  );
}
