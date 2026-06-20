'use client';

import { motion } from 'framer-motion';
import { streetName } from '@/domain/engine';

export interface StreetControlsProps {
  /** The current street index (its betting just finished). */
  readonly street: number;
  readonly isBanker: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onDeal: () => void;
}

/**
 * Shown while the hand is `awaiting_street`: betting on the current street is
 * done and the banker must deal the next one (task 4.7 — the human paces the
 * physical cards). The banker gets a "Deal <next>" button; everyone else sees a
 * quiet waiting message.
 */
export function StreetControls({
  street,
  isBanker,
  pending,
  error,
  onDeal,
}: StreetControlsProps): React.ReactElement {
  const next = streetName(street + 1);

  return (
    <div className="flex flex-col items-center gap-2">
      {isBanker ? (
        <>
          <p className="text-sm text-vc-ink-muted">
            Betting&rsquo;s done — deal the{' '}
            <span className="font-medium text-vc-ink">{next}</span>.
          </p>
          <motion.button
            whileTap={pending ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.12 }}
            disabled={pending}
            onClick={onDeal}
            className="rounded-lg border border-vc-gold/50 bg-vc-gold/10 px-5 py-2 text-sm font-semibold text-vc-gold transition hover:bg-vc-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Deal {next}
          </motion.button>
        </>
      ) : (
        <p className="text-sm text-vc-ink-muted">
          Waiting for the banker to deal the{' '}
          <span className="font-medium text-vc-ink">{next}</span>.
        </p>
      )}
      {error !== null && (
        <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-1.5 text-sm text-vc-danger">
          {error}
        </p>
      )}
    </div>
  );
}
