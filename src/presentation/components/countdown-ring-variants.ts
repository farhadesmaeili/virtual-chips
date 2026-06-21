import type { TargetAndTransition, Variants } from 'framer-motion';
import type { MotionVariantSet } from '@/presentation/animations';

/**
 * Per-turn values resolved into the fill variants via Framer's `custom` prop, so
 * the module-level variant set stays static while the dynamic offsets/duration
 * come from the live deadline. These are pure config objects with no branching —
 * the tested logic lives in `lib/timer-ring.ts`.
 */
export interface RingFillCustom {
  /** Current `strokeDashoffset` — reflects the time already elapsed. */
  readonly fromOffset: number;
  /** Empty `strokeDashoffset` (= full circumference) — the depleted end state. */
  readonly toOffset: number;
  /** Seconds the depletion should take to reach empty. */
  readonly remainingSec: number;
}

// Fill animates `strokeDashoffset` only (a paint, no layout thrash). Linear is
// intentional: a countdown must map time→fill faithfully, so no spring/easing.
const fillFull: Variants = {
  initial: (c: RingFillCustom): TargetAndTransition => ({
    strokeDashoffset: c.fromOffset,
  }),
  animate: (c: RingFillCustom): TargetAndTransition => ({
    strokeDashoffset: c.toOffset,
    transition: { duration: c.remainingSec, ease: 'linear' },
  }),
};

// Reduced motion: hold a calm static ring at the current remaining fraction —
// no depleting motion.
const fillReduced: Variants = {
  initial: (c: RingFillCustom): TargetAndTransition => ({
    strokeDashoffset: c.fromOffset,
  }),
  animate: (c: RingFillCustom): TargetAndTransition => ({
    strokeDashoffset: c.fromOffset,
  }),
};

export const ringFill: MotionVariantSet = {
  full: fillFull,
  reduced: fillReduced,
};

// Pulse animates `transform`/`opacity` only, around the ring's center.
const pulseFull: Variants = {
  idle: { scale: 1, opacity: 0.9 },
  warn: {
    scale: [1, 1.07, 1],
    opacity: [0.85, 1, 0.85],
    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' },
  },
};

// Reduced motion: no pulse — a steady, fully opaque ring conveys urgency without
// motion (the red color flip still applies).
const pulseReduced: Variants = {
  idle: { scale: 1, opacity: 0.9 },
  warn: { scale: 1, opacity: 1 },
};

export const ringPulse: MotionVariantSet = {
  full: pulseFull,
  reduced: pulseReduced,
};
