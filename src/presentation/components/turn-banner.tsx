'use client';

import { streetName } from '@/domain/engine';
import { useCountdown } from '@/presentation/hooks/use-countdown';
import { formatCountdown } from '@/presentation/lib/countdown';
import type {
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

export interface TurnBannerProps {
  readonly hand: PublicHandState | null;
  readonly members: readonly PublicRoomMember[];
  /** The seat the viewer occupies, to say "Your turn" rather than their name. */
  readonly heroSeat: number | null;
}

/**
 * A banner above the table announcing whose move it is (task 4.11): the acting
 * player and their time left while betting, or who everyone is waiting on
 * between streets and at showdown. Hidden when no hand is in play.
 */
export function TurnBanner({
  hand,
  members,
  heroSeat,
}: TurnBannerProps): React.ReactElement | null {
  const betting = hand !== null && hand.status === 'betting';
  const deadline = betting ? hand.actionDeadline : null;
  const seconds = useCountdown(deadline);

  if (hand === null || hand.status === 'settled') return null;

  const heroActing = betting && hand.actingSeat === heroSeat;
  let label: React.ReactNode;

  if (betting && hand.actingSeat !== null) {
    if (heroActing) {
      label = 'Your turn';
    } else {
      const name =
        members.find((m) => m.seat === hand.actingSeat)?.username ??
        `Seat ${hand.actingSeat}`;
      label = (
        <>
          <span className="font-medium text-vc-ink">{name}</span> to act
        </>
      );
    }
  } else if (hand.status === 'awaiting_street') {
    label = (
      <>
        Waiting for the banker to deal the{' '}
        <span className="font-medium text-vc-ink">
          {streetName(hand.street + 1)}
        </span>
      </>
    );
  } else {
    // awaiting_showdown
    label = 'Waiting for the banker to settle';
  }

  const low = seconds !== null && seconds <= 5;

  return (
    <div className="flex justify-center">
      <div
        className={`flex items-center gap-2.5 rounded-full border px-4 py-1.5 backdrop-blur-sm ${
          heroActing
            ? 'border-vc-emerald/40 bg-vc-emerald/10'
            : 'border-white/[0.07] bg-black/25'
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${
            heroActing ? 'bg-vc-emerald' : 'bg-vc-ink-faint'
          }`}
        />
        <span
          className={`text-sm ${heroActing ? 'font-semibold text-vc-emerald' : 'text-vc-ink-muted'}`}
        >
          {label}
        </span>
        {seconds !== null && (
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              low ? 'text-vc-danger' : 'text-vc-ink'
            }`}
          >
            {formatCountdown(seconds)}
          </span>
        )}
      </div>
    </div>
  );
}
