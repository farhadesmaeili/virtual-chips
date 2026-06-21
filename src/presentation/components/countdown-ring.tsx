'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useMotionVariants } from '@/presentation/animations';
import {
  isWarning,
  remainingMs as computeRemaining,
  ringFillFraction,
  warningThresholdMs,
} from '@/presentation/lib/timer-ring';
import {
  ringFill,
  ringPulse,
  type RingFillCustom,
} from './countdown-ring-variants';

// r=46 circle circumference (2·π·46 ≈ 289), used as the dash length so the
// stroke can deplete from full to empty.
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface CountdownRingProps {
  /** Absolute turn deadline (epoch ms); null when there is no pending turn. */
  readonly deadline: number | null;
  /** Configured turn length (ms) — the basis for fill + warning threshold. */
  readonly totalMs: number;
}

/**
 * The active player's countdown ring (task 5.2). An SVG stroke depletes over the
 * time left until the server-authoritative `deadline`; near the end it turns red
 * and pulses. The depletion is driven by Framer over a single snapshot duration
 * (no per-frame React state), and reduced-motion is honored by routing both the
 * fill and the pulse through the 5.0 {@link useMotionVariants} helper.
 */
export function CountdownRing({
  deadline,
  totalMs,
}: CountdownRingProps): React.ReactElement | null {
  // Snapshot remaining time once per turn (per deadline). Mid-turn re-renders
  // must not restart the depletion — Framer drives the smooth fill over this
  // duration rather than us writing state every frame.
  const remaining = useMemo(
    () => (deadline === null ? 0 : computeRemaining(deadline, Date.now())),
    [deadline],
  );

  // A single timer flips to the warning look when remaining crosses the
  // threshold — one state change per turn, never per frame.
  const startsInWarning = isWarning(remaining, totalMs);
  const [warning, setWarning] = useState(startsInWarning);
  useEffect(() => {
    setWarning(startsInWarning);
    if (deadline === null || startsInWarning) return;
    const msUntilWarning = remaining - warningThresholdMs(totalMs);
    const id = setTimeout(() => setWarning(true), msUntilWarning);
    return () => clearTimeout(id);
  }, [deadline, remaining, totalMs, startsInWarning]);

  // Stable per-turn custom so the warning flip (a re-render) never restarts the
  // fill animation.
  const fillCustom = useMemo<RingFillCustom>(() => {
    const fraction = ringFillFraction(remaining, totalMs);
    return {
      fromOffset: RING_CIRCUMFERENCE * (1 - fraction),
      toOffset: RING_CIRCUMFERENCE,
      remainingSec: remaining / 1000,
    };
  }, [remaining, totalMs]);

  const fillVariants = useMotionVariants(ringFill);
  const pulseVariants = useMotionVariants(ringPulse);

  if (deadline === null) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ transformOrigin: 'center' }}
      variants={pulseVariants}
      initial="idle"
      animate={warning ? 'warn' : 'idle'}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <motion.circle
          // Remount per turn so the depletion restarts cleanly each deadline.
          key={deadline}
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke={warning ? 'var(--vc-danger)' : 'var(--vc-emerald)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          variants={fillVariants}
          custom={fillCustom}
          initial="initial"
          animate="animate"
        />
      </svg>
    </motion.div>
  );
}
