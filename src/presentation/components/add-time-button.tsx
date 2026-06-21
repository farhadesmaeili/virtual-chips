'use client';

import { useEffect, useState } from 'react';
import { secondsRemaining } from '@/presentation/lib/countdown';

/** Show the "Add time" control only once the turn is this close to expiring. */
const LOW_THRESHOLD_SECONDS = 10;

export interface AddTimeButtonProps {
  /** Absolute action deadline (epoch ms), or null when no turn is pending. */
  readonly deadline: number | null;
  /** The hero's remaining time-bank extensions this hand. */
  readonly extensionsRemaining: number;
  readonly onAddTime: () => void;
}

/**
 * Time-bank control (task 4.12): lets the acting player buy more time when their
 * clock is running low. Hidden until the deadline is within the low threshold
 * and the player still has budget. Self-ticks once a second to re-evaluate; this
 * only mounts during the hero's turn, so the interval is short-lived.
 */
export function AddTimeButton({
  deadline,
  extensionsRemaining,
  onAddTime,
}: AddTimeButtonProps): React.ReactElement | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (deadline === null || extensionsRemaining <= 0) return null;
  if (secondsRemaining(deadline, now) > LOW_THRESHOLD_SECONDS) return null;

  return (
    <button
      type="button"
      onClick={onAddTime}
      aria-label={`Add time, ${extensionsRemaining} left`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-vc-gold/40 bg-vc-gold/10 px-2.5 py-1 text-xs font-semibold text-vc-gold transition hover:bg-vc-gold/20 active:scale-[0.98]"
    >
      Add time
      <span className="font-mono tabular-nums opacity-80">
        {extensionsRemaining} left
      </span>
    </button>
  );
}
