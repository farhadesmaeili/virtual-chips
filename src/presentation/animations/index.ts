/**
 * Phase 5 animation foundations: shared spring presets, variant definitions,
 * and the reduced-motion-aware selection helper. Consumed by tasks 5.1–5.4 —
 * this module does not animate any component itself.
 */
export {
  springSoft,
  springSnappy,
  springBouncy,
  fadeTransition,
} from './transitions';
export {
  chipFly,
  seatHighlight,
  playerEnter,
  winPulse,
  winGlow,
  betPost,
  type MotionVariantSet,
} from './variants';
export {
  selectVariants,
  useMotionVariants,
  useReducedMotionPreference,
} from './reduced-motion';
