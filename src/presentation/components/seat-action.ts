import type { MotionVariantSet } from '@/presentation/animations';
import type { AppliedActionType } from '@/presentation/lib/socket-events';

// Display text for each action verb. Verb only — never an amount; the chips in
// front of the seat already show how much was committed.
const VERB_LABELS: Record<AppliedActionType, string> = {
  FOLD: 'Fold',
  CHECK: 'Check',
  CALL: 'Call',
  BET: 'Bet',
  RAISE: 'Raise',
  ALL_IN: 'All-in',
};

/**
 * The seat's last-action label, or '' when the player hasn't acted (null) — so
 * the caller renders nothing while still reserving the row height.
 */
export function actionVerbLabel(verb: AppliedActionType | null): string {
  return verb === null ? '' : VERB_LABELS[verb];
}

/**
 * Subtle fade-in for the last-action label when the verb changes. Opacity only;
 * under reduced motion it appears instantly (no fade). Routed through the 5.0
 * {@link useMotionVariants} helper so reduced-motion is honored by construction.
 */
export const labelFade: MotionVariantSet = {
  full: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.18 } },
  },
  reduced: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
  },
};
