// Pure derivation of which items the unified action menu (task 4.16) shows and
// which are disabled. This only re-homes controls that already existed as
// scattered bars (presence 4.14, funding 4.15, the banker's start-hand button);
// it is UX gating only. The server stays authoritative and re-validates every
// emitted event, so this never grants access — it only keeps intent clear.

/** A single one-shot menu action (sit out / sit in / leave / start hand). */
export interface MenuItemState {
  readonly show: boolean;
  readonly disabled: boolean;
  /** Short hint explaining a non-pending disable, for the title/aria-label. */
  readonly reason?: string;
}

/** The banker's start-hand item also carries its contextual label. */
export interface StartHandState extends MenuItemState {
  readonly label: string;
}

export interface MenuModel {
  /** Whether the menu trigger should render at all (nothing to show → hidden). */
  readonly hasAny: boolean;
  // Player presence (task 4.14).
  readonly sitOut: MenuItemState;
  readonly sitIn: MenuItemState;
  readonly leave: MenuItemState;
  // Player funding (task 4.15): the request-chips mini-form vs. a waiting note.
  readonly requestChips: MenuItemState;
  /** True when the player already has a pending request (show a note instead). */
  readonly ownRequestPending: boolean;
  // Banker controls.
  readonly startHand: StartHandState;
  /** Whether the banker's approve/deny request queue should render. */
  readonly requestQueue: MenuItemState;
}

export interface MenuInput {
  /** Whether the viewer occupies a seat. */
  readonly seated: boolean;
  readonly sittingOut: boolean;
  readonly isBanker: boolean;
  /** A hand is live (not settled) — leaving is blocked until it ends. */
  readonly handInPlay: boolean;
  /** The game is running (room status 'playing'). */
  readonly gameInPlay: boolean;
  /** The current hand is settled — the deal button reads "Start next hand". */
  readonly handSettled: boolean;
  /** The viewer already has a pending buy-in request. */
  readonly hasOwnRequest: boolean;
  /** Number of pending chip requests waiting on the banker. */
  readonly requestCount: number;
  /** A request is in flight; one-shot items disable until it resolves. */
  readonly pending: boolean;
}

const HIDDEN: MenuItemState = { show: false, disabled: false };

/**
 * Derives the menu's item visibility/disabled state from live room + hand state.
 * Mirrors {@link ./action-availability.deriveActions}: a pure hint the component
 * renders from — the server still enforces every guard.
 */
export function deriveMenuItems(input: MenuInput): MenuModel {
  const {
    seated,
    sittingOut,
    isBanker,
    handInPlay,
    gameInPlay,
    handSettled,
    hasOwnRequest,
    requestCount,
    pending,
  } = input;

  // Presence: a seated player can sit out (when in) or sit back in (when out).
  const sitOut: MenuItemState = seated
    ? { show: !sittingOut, disabled: pending }
    : HIDDEN;
  const sitIn: MenuItemState = seated
    ? { show: sittingOut, disabled: pending }
    : HIDDEN;

  // Leave is blocked mid-hand for anyone, and mid-game for the banker (the role
  // can't vanish from a running game). Mirrors PresenceControls' guard exactly.
  const leaveBlocked = handInPlay || (isBanker && gameInPlay);
  const leave: MenuItemState = seated
    ? {
        show: true,
        disabled: pending || leaveBlocked,
        reason: leaveBlocked
          ? isBanker
            ? 'The banker cannot leave mid-game'
            : 'You cannot leave during a hand'
          : undefined,
      }
    : HIDDEN;

  // Funding: a seated player without an open request sees the request form;
  // otherwise a "waiting for the banker" note.
  const requestChips: MenuItemState =
    seated && !hasOwnRequest ? { show: true, disabled: pending } : HIDDEN;
  const ownRequestPending = seated && hasOwnRequest;

  // Banker: start the (next) hand when none is in play; the approve/deny queue
  // only when requests are waiting.
  const startHand: StartHandState =
    isBanker && !handInPlay
      ? {
          show: true,
          disabled: pending,
          label: handSettled ? 'Start next hand' : 'Start hand',
        }
      : { ...HIDDEN, label: 'Start hand' };
  const requestQueue: MenuItemState =
    isBanker && requestCount > 0 ? { show: true, disabled: pending } : HIDDEN;

  const hasAny =
    sitOut.show ||
    sitIn.show ||
    leave.show ||
    requestChips.show ||
    ownRequestPending ||
    startHand.show ||
    requestQueue.show;

  return {
    hasAny,
    sitOut,
    sitIn,
    leave,
    requestChips,
    ownRequestPending,
    startHand,
    requestQueue,
  };
}
