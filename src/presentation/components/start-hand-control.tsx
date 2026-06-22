'use client';

import { motion } from 'framer-motion';
import type { StartHandState } from './menu-availability';

export interface StartHandControlProps {
  /** Derived banker-only visibility + contextual label (the startHand predicate). */
  readonly state: StartHandState;
  readonly onStart: () => void;
}

/**
 * The banker's "Start hand / Start next hand" button. A phase-flow control that
 * lives with the deal/advance controls ({@link ./street-controls.StreetControls}),
 * shown only when no hand is in play. Behavior is unchanged from when it lived in
 * the action menu — same intent (`hand:start`), same banker-only authorization,
 * same visibility — only its placement moved. The server still re-validates.
 */
export function StartHandControl({
  state,
  onStart,
}: StartHandControlProps): React.ReactElement | null {
  if (!state.show) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        whileTap={state.disabled ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.12 }}
        disabled={state.disabled}
        onClick={onStart}
        className="rounded-lg border border-vc-gold/50 bg-vc-gold/10 px-5 py-2 text-sm font-semibold text-vc-gold transition hover:bg-vc-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.label}
      </motion.button>
    </div>
  );
}
