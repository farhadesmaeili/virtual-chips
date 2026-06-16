'use client';

import { Chip } from './chip';
import type { SeatSlot } from './seat-layout';
import type {
  PublicHandPlayer,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  const second = parts[1];
  const pick = second
    ? first.slice(0, 1) + second.slice(0, 1)
    : first.slice(0, 2);
  return pick.toUpperCase() || '··';
}

export interface SeatProps {
  readonly slot: SeatSlot;
  readonly member?: PublicRoomMember;
  readonly handPlayer?: PublicHandPlayer;
  readonly isActing: boolean;
  readonly isButton: boolean;
}

/**
 * One seat at the rail. Pure presentation, driven by room + hand state. The
 * structure is laid out so Phase 5 can animate it without restructuring:
 * `data-acting` marks the seat whose countdown ring + highlight animate, and the
 * `.vc-bet` node is the chip stack that travels to the pot.
 */
export function Seat({
  slot,
  member,
  handPlayer,
  isActing,
  isButton,
}: SeatProps): React.ReactElement {
  const folded = handPlayer?.state === 'folded';
  const allIn = handPlayer?.state === 'all_in';
  const stack = handPlayer?.stack ?? member?.chips ?? 0;
  const bet = handPlayer?.committedThisStreet ?? 0;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${slot.xPct}%`, top: `${slot.yPct}%` }}
    >
      <div className="vc-seat-stand">
        {member === undefined ? (
          <EmptySeat seat={slot.seat} />
        ) : (
          <div
            data-acting={isActing || undefined}
            className={`flex flex-col items-center transition-opacity duration-300 ${
              folded ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {/* Bet chips sit on the felt between the seat and the pot; in Phase 5
                they spring to the center. */}
            {bet > 0 && (
              <div
                className="vc-bet absolute -top-1 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-1"
                style={{
                  transform: `translate(calc(-50% + ${slot.towardCenter.x * 26}px), ${
                    slot.towardCenter.y * 26
                  }px)`,
                }}
              >
                <Chip size={18} color="var(--vc-chip-25)" />
                <span className="font-mono text-xs font-semibold tabular-nums text-vc-gold">
                  {bet.toLocaleString()}
                </span>
              </div>
            )}

            {/* Avatar + countdown ring. */}
            <div className="relative grid h-12 w-12 place-items-center sm:h-14 sm:w-14">
              {isActing && <CountdownRing />}
              <div
                className={`grid h-11 w-11 place-items-center rounded-full font-display text-sm font-bold sm:h-[3.25rem] sm:w-[3.25rem] ${
                  isActing
                    ? 'bg-vc-felt-lamp text-vc-emerald shadow-[0_0_22px_-2px_rgb(52_211_153/0.7)] ring-2 ring-vc-emerald'
                    : 'bg-vc-felt-deep text-vc-ink ring-1 ring-white/10'
                }`}
                style={{
                  boxShadow: isActing
                    ? undefined
                    : 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 6px 12px rgb(0 0 0 / 0.5)',
                }}
              >
                {initials(member.username)}
              </div>

              {/* Dealer button rides just off the avatar; Phase 5 glides it. */}
              {isButton && (
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-vc-gold font-mono text-[10px] font-bold text-vc-felt-edge shadow-[0_2px_5px_rgb(0_0_0/0.5)]">
                  D
                </span>
              )}
            </div>

            {/* Nameplate — username over a tote-board stack readout. */}
            <div className="mt-1.5 w-[4.5rem] rounded-lg border border-white/[0.07] bg-black/40 px-2 py-1 text-center backdrop-blur-sm sm:w-[6.5rem]">
              <div className="flex items-center justify-center gap-1">
                <span className="truncate text-[11px] font-medium text-vc-ink sm:text-xs">
                  {member.username}
                </span>
                {member.isBanker && (
                  <span
                    title="Banker"
                    className="text-[10px] font-bold text-vc-gold"
                  >
                    ◆
                  </span>
                )}
              </div>
              <div className="font-mono text-sm font-semibold tabular-nums text-vc-gold">
                {allIn ? 'All in' : stack.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptySeat({ seat }: { seat: number }): React.ReactElement {
  return (
    <div className="flex flex-col items-center opacity-70">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-white/15 text-vc-ink-faint sm:h-[3.25rem] sm:w-[3.25rem]">
        <span className="font-mono text-xs">{seat}</span>
      </div>
      <span className="mt-1.5 text-[11px] text-vc-ink-faint">Open seat</span>
    </div>
  );
}

/**
 * The active player's countdown ring. Rendered as a full emerald ring now; in
 * Phase 5 the stroke is driven by the absolute `actionDeadline` (animating a
 * transform on the stroke, not per-tick React state).
 */
function CountdownRing(): React.ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
    >
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="var(--vc-emerald)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="289"
        strokeDashoffset="0"
        opacity="0.9"
      />
    </svg>
  );
}
