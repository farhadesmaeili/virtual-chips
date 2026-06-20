'use client';

import { useEffect, useState } from 'react';
import { secondsRemaining } from '@/presentation/lib/countdown';

/**
 * Seconds left until an absolute `deadline` (epoch ms), or null when there is no
 * deadline (e.g. between turns, or while the hand waits for the banker). Ticks
 * about twice a second so the displayed value stays accurate without driving
 * per-frame game state.
 */
export function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now()); // resync immediately when the deadline changes
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null) return null;
  return secondsRemaining(deadline, now);
}
