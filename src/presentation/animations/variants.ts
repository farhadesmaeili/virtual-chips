import type { Variants } from 'framer-motion';
import {
  fadeTransition,
  springSnappy,
  springSoft,
  springBouncy,
} from './transitions';

/**
 * A reusable animation primitive: the full physical motion plus a degraded
 * fallback for `prefers-reduced-motion`. Components never read `full`/`reduced`
 * directly — they route through {@link useMotionVariants} so reduced-motion is
 * honored by construction.
 *
 * Every variant animates `transform`/`opacity` ONLY (no width/top/left) to keep
 * work on the GPU compositor — see docs/ANIMATIONS.md.
 *
 * These are pure configuration objects with no branching, so they are exempt
 * from unit tests per CLAUDE.md. The selection logic in `reduced-motion.ts` is
 * what carries the tested behavior.
 */
export interface MotionVariantSet {
  /** Full, physical motion used when reduced-motion is OFF. */
  readonly full: Variants;
  /** Simple fade / instant fallback used when reduced-motion is ON. */
  readonly reduced: Variants;
}

/**
 * Chip travelling from a player to the pot (and pot → winner). The travel
 * offset itself is supplied by the consuming component (5.1); this set defines
 * the spring "pop" and exit feel so multiple chips read as a stack.
 */
export const chipFly: MotionVariantSet = {
  full: {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1, transition: springSnappy },
    exit: { opacity: 0, scale: 0.6, transition: fadeTransition },
  },
  reduced: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: fadeTransition },
    exit: { opacity: 0, transition: fadeTransition },
  },
};

/** Highlight for the seat whose turn it is — a gentle scale + opacity lift. */
export const seatHighlight: MotionVariantSet = {
  full: {
    inactive: { scale: 1, opacity: 0.85, transition: springSoft },
    active: { scale: 1.05, opacity: 1, transition: springSoft },
  },
  reduced: {
    inactive: { opacity: 0.85 },
    active: { opacity: 1, transition: fadeTransition },
  },
};

/** Player entering / leaving a seat under `AnimatePresence` — scale + fade. */
export const playerEnter: MotionVariantSet = {
  full: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1, transition: springBouncy },
    exit: { opacity: 0, scale: 0.8, transition: fadeTransition },
  },
  reduced: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: fadeTransition },
    exit: { opacity: 0, transition: fadeTransition },
  },
};

/** Win celebration on the pot winner — an idle → pop scale with overshoot. */
export const winPulse: MotionVariantSet = {
  full: {
    idle: { scale: 1, opacity: 1 },
    win: { scale: 1.12, opacity: 1, transition: springBouncy },
  },
  reduced: {
    idle: { opacity: 1 },
    win: { opacity: 1 },
  },
};
