import type { Transition } from 'framer-motion';

/**
 * Shared spring transition presets for Phase 5 animations.
 *
 * Physical motion uses `type: 'spring'` with explicit stiffness/damping so the
 * feel stays consistent across every animated surface (chips, seats, players,
 * win effects). Linear easing is intentionally avoided for physical motion —
 * see docs/ANIMATIONS.md.
 *
 * These are pure configuration objects with no branching, so they are exempt
 * from unit tests per CLAUDE.md.
 */

/** Calm settle — seat highlights and general state transitions. */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 140,
  damping: 20,
};

/** Quick, controlled snap — chips arriving, short travel. */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
};

/** Lively pop with a touch of overshoot — player entrance, win pop. */
export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 16,
};

/**
 * Degraded path only: a short opacity tween. Used by the reduced-motion
 * fallbacks where physical springs are replaced by a plain fade. This is the
 * one place a non-spring transition is allowed, because it animates `opacity`
 * (not physical position) and exists specifically to reduce vestibular motion.
 */
export const fadeTransition: Transition = {
  duration: 0.15,
};
