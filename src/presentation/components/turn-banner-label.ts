// Pure status->label decision for the turn banner (task 4.11). No React, no I/O
// so the branching is unit-tested directly. The component renders the chosen
// kind; this only decides WHICH label applies for a given hand state.

import type { PublicHandState } from '@/presentation/lib/socket-events';

/**
 * Which banner label to show. A discriminated union so the component can render
 * each case without re-deriving the status:
 * - `your-turn` / `to-act`: a live turn (the acting seat, hero or named).
 * - `deal-next`: betting paused; the banker must deal the next street.
 * - `settle`: showdown; the banker must award the pot.
 * - `none`: nothing to announce (settled, no hand, or an unexpected
 *   betting/no-actor state) — render no banner rather than mislabel it.
 */
export type TurnBannerLabel =
  | { readonly kind: 'your-turn' }
  | { readonly kind: 'to-act'; readonly seat: number }
  | { readonly kind: 'deal-next'; readonly street: number }
  | { readonly kind: 'settle' }
  | { readonly kind: 'none' };

/**
 * Decides the banner label from the hand state. `heroSeat` is the viewer's seat
 * (to say "Your turn" rather than their name).
 *
 * The final case deliberately returns `none` for any state that isn't a live
 * turn, a between-streets pause, or showdown — including the unexpected
 * `betting` with no acting seat. That combo should not occur, so we show no
 * label instead of falsely asserting "waiting to settle".
 */
export function turnBannerLabelKind(
  hand: PublicHandState | null,
  heroSeat: number | null,
): TurnBannerLabel {
  if (hand === null || hand.status === 'settled') return { kind: 'none' };

  if (hand.status === 'betting' && hand.actingSeat !== null) {
    return hand.actingSeat === heroSeat
      ? { kind: 'your-turn' }
      : { kind: 'to-act', seat: hand.actingSeat };
  }

  if (hand.status === 'awaiting_street') {
    // The street index that will be dealt next.
    return { kind: 'deal-next', street: hand.street + 1 };
  }

  if (hand.status === 'awaiting_showdown') {
    return { kind: 'settle' };
  }

  // Unexpected: betting with no acting seat (shouldn't happen) → no mislabel.
  return { kind: 'none' };
}
