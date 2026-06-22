'use client';

import { useReducedMotion, type Variants } from 'framer-motion';
import type { MotionVariantSet } from './variants';

/**
 * Pure selection: given a variant set and whether reduced-motion is requested,
 * return the matching Framer Motion variants. Kept side-effect free so the
 * branching behavior is unit-tested directly.
 */
export function selectVariants(
  set: MotionVariantSet,
  reduced: boolean,
): Variants {
  return reduced ? set.reduced : set.full;
}

/**
 * The single reduced-motion decision for all Phase 5 animations.
 *
 * `useReducedMotion()` returns `boolean | null` — at framer-motion 11.18.2 it is
 * `null` while the preference is still unresolved (server render and the first
 * client render before the media-query listener initializes).
 *
 * Fail SAFE for accessibility: when the preference is unknown we degrade (treat
 * as reduced-motion ON) rather than briefly showing full motion to a user who
 * may have asked for none. Guessing "no motion" wrongly is merely cosmetic;
 * guessing "full motion" wrongly violates the user's request.
 *
 * Use this when an animation isn't expressed as a variant (e.g. a Framer
 * `layout`/`layoutId` transition) and so can't go through
 * {@link useMotionVariants}; both share this one decision.
 */
export function useReducedMotionPreference(): boolean {
  return useReducedMotion() ?? true;
}

/**
 * The single path every Phase 5 variant-based animation routes through. Returns
 * the full physical variant when reduced-motion is OFF and the degraded fallback
 * when it is ON, so `prefers-reduced-motion` is honored by construction rather
 * than retrofitted per component.
 */
export function useMotionVariants(set: MotionVariantSet): Variants {
  return selectVariants(set, useReducedMotionPreference());
}
