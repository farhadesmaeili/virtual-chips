'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  useMotionVariants,
  useReducedMotionPreference,
  winGlow,
  winPulse,
} from '@/presentation/animations';
import { useElementSize } from '@/presentation/hooks/use-element-size';
import type { CelebrationBurst } from './celebration';

/** A live celebration awaiting render, with a stable id for cleanup. */
export interface Celebration extends CelebrationBurst {
  readonly id: string;
}

// A few sparks thrown outward from the winning seat (full motion only).
const SPARK_COUNT = 7;
// Lifetime after which a burst removes itself (fire-and-forget). Long enough for
// the pop + spark drift; short for the reduced-motion fade. Removal then plays
// the AnimatePresence exit. Mirrors the chip layer's self-cleanup (task 5.1).
const BURST_MS = 1100;
const BURST_MS_REDUCED = 280;

/**
 * Renders win celebrations over the table (task 5.4): a glow + scale pop (and,
 * with full motion, a small spark burst) at each winning seat. Shares the
 * seat-overlay coordinate space with the chips, so bursts line up with seats via
 * the same `seatPoint` geometry. Each burst is fire-and-forget — it schedules its
 * own removal and is never reconstructed from state, so nothing replays on a
 * resync. Sits above the chip layer (z-40 vs z-30) so the cheer lands on top of
 * the arriving pot→winner chips.
 */
export function CelebrationLayer({
  celebrations,
  onDone,
}: {
  readonly celebrations: readonly Celebration[];
  readonly onDone: (id: string) => void;
}): React.ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40"
    >
      <AnimatePresence>
        {size !== null &&
          celebrations.map((c) => (
            <CelebrationBurstView
              key={c.id}
              burst={c}
              width={size.width}
              height={size.height}
              onDone={onDone}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

function CelebrationBurstView({
  burst,
  width,
  height,
  onDone,
}: {
  readonly burst: Celebration;
  readonly width: number;
  readonly height: number;
  readonly onDone: (id: string) => void;
}): React.ReactElement {
  const reduced = useReducedMotionPreference();
  const glowVariants = useMotionVariants(winGlow);
  const pulseVariants = useMotionVariants(winPulse);

  // Seat center in px within the layer (transform space — no layout props).
  const x = (burst.at.xPct / 100) * width;
  const y = (burst.at.yPct / 100) * height;

  // Fire-and-forget cleanup, independent of the spring's exact settle time.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(
      () => onDoneRef.current(burst.id),
      reduced ? BURST_MS_REDUCED : BURST_MS,
    );
    return () => window.clearTimeout(id);
  }, [burst.id, reduced]);

  return (
    <motion.div
      // Anchored at the seat center; children center on it via negative margins
      // (not transforms) so Framer owns the transform channel cleanly.
      className="absolute left-0 top-0"
      style={{ x, y }}
      variants={glowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Soft gold glow disc. */}
      <div className="absolute -ml-12 -mt-12 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgb(245_197_24/0.5),transparent_70%)] blur-[2px]" />
      {/* Bright core — the winPulse scale pop (reused 5.0 primitive). */}
      <motion.div
        variants={pulseVariants}
        initial="idle"
        animate="win"
        className="absolute -ml-6 -mt-6 h-12 w-12 rounded-full bg-[radial-gradient(circle,rgb(255_245_210/0.85),transparent_72%)]"
      />
      {/* Sparks — transform/opacity only, and only under full motion (the 5.0
          reduced-motion decision suppresses them entirely). */}
      {!reduced &&
        Array.from({ length: SPARK_COUNT }, (_, i) => {
          const angle = (i / SPARK_COUNT) * Math.PI * 2;
          const dist = 30 + (i % 2) * 8;
          return (
            <motion.span
              key={i}
              className="absolute -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-vc-gold"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0.5],
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
              }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
            />
          );
        })}
    </motion.div>
  );
}
