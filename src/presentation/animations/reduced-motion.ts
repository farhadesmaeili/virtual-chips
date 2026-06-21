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
 * The single path every Phase 5 animation routes through. Returns the full
 * physical variant when reduced-motion is OFF and the degraded fallback when it
 * is ON, so `prefers-reduced-motion` is honored by construction rather than
 * retrofitted per component.
 */
export function useMotionVariants(set: MotionVariantSet): Variants {
  // `useReducedMotion()` returns `boolean | null` (null before it resolves).
  const reduced = useReducedMotion();
  return selectVariants(set, reduced ?? false);
}
