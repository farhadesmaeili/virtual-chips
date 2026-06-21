'use client';

export interface PresenceControlsProps {
  /** Whether the current user occupies a seat (only seated players see these). */
  readonly seated: boolean;
  readonly sittingOut: boolean;
  readonly isBanker: boolean;
  /** True while a hand is live — leaving is blocked until it settles. */
  readonly handInPlay: boolean;
  /** True while the game is running (room status 'playing'). */
  readonly gameInPlay: boolean;
  readonly pending: boolean;
  readonly onSitOut: () => void;
  readonly onSitIn: () => void;
  readonly onLeave: () => void;
}

/**
 * Seat-presence controls (task 4.14): sit out / sit in, and leave. Placed as a
 * small bar for now; these move into the unified action menu in task 4.16.
 *
 * Buttons are disabled when the server would reject the action, so the intent
 * stays clear — but the server is still authoritative (the guards live in the
 * use-cases, not here).
 */
export function PresenceControls({
  seated,
  sittingOut,
  isBanker,
  handInPlay,
  gameInPlay,
  pending,
  onSitOut,
  onSitIn,
  onLeave,
}: PresenceControlsProps): React.ReactElement | null {
  if (!seated) return null;

  // The banker cannot leave mid-game; anyone is blocked from leaving mid-hand.
  const leaveBlocked = handInPlay || (isBanker && gameInPlay);
  const leaveHint = isBanker
    ? 'The banker cannot leave mid-game'
    : 'You cannot leave during a hand';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sittingOut ? (
        <button
          onClick={onSitIn}
          disabled={pending}
          className="rounded-lg border border-vc-emerald/40 bg-vc-emerald/10 px-3 py-1.5 text-sm font-medium text-vc-emerald transition hover:bg-vc-emerald/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sit in
        </button>
      ) : (
        <button
          onClick={onSitOut}
          disabled={pending}
          className="rounded-lg border border-vc-rail-edge/60 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-vc-ink transition hover:bg-white/[0.08] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sit out
        </button>
      )}

      <button
        onClick={onLeave}
        disabled={pending || leaveBlocked}
        title={leaveBlocked ? leaveHint : undefined}
        className="rounded-lg border border-vc-danger/40 bg-vc-danger/10 px-3 py-1.5 text-sm font-medium text-vc-danger transition hover:bg-vc-danger/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Leave table
      </button>

      {sittingOut && (
        <span className="text-xs text-vc-ink-muted">
          Sitting out — dealt in next hand when you sit back in.
        </span>
      )}
    </div>
  );
}
