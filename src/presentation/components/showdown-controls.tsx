'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type {
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

export interface ShowdownControlsProps {
  readonly hand: PublicHandState;
  readonly members: readonly PublicRoomMember[];
  readonly isBanker: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  /** Winner seats per pot (aligned with hand.pots); [] for uncontested pots. */
  readonly onSettle: (declarations: number[][]) => void;
}

/**
 * The showdown moment: the hand's betting is done and the banker awards each
 * pot. Since there is no hand evaluation, the banker declares the winner of any
 * contested pot; uncontested pots are shown for confirmation and auto-award.
 * Everyone sees the pots; only the banker gets the controls (server-enforced).
 */
export function ShowdownControls({
  hand,
  members,
  isBanker,
  pending,
  error,
  onSettle,
}: ShowdownControlsProps): React.ReactElement {
  const reduce = useReducedMotion();
  const pots = hand.pots;

  const nameOf = (seat: number): string =>
    members.find((m) => m.seat === seat)?.username ?? `Seat ${seat}`;

  // One winner-set per pot; contested pots start empty (banker must choose).
  const [picks, setPicks] = useState<number[][]>(() =>
    pots.map((pot) =>
      pot.eligibleSeats.length === 1 ? [...pot.eligibleSeats] : [],
    ),
  );

  const isContested = (i: number): boolean => pots[i]!.eligibleSeats.length > 1;
  const contestedReady = pots.every(
    (_, i) => !isContested(i) || (picks[i]?.length ?? 0) > 0,
  );

  function toggle(potIndex: number, seat: number): void {
    setPicks((prev) =>
      prev.map((set, i) => {
        if (i !== potIndex) return set;
        return set.includes(seat)
          ? set.filter((s) => s !== seat)
          : [...set, seat];
      }),
    );
  }

  const hasContested = pots.some((_, i) => isContested(i));
  const total = hand.totalPot;
  const awardLabel =
    total === 0 ? 'End hand' : pots.length > 1 ? 'Award pots' : 'Award pot';

  return (
    <div className="pointer-events-none sticky bottom-3 z-20 mt-2 flex justify-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="vc-tray pointer-events-auto flex w-full max-w-xl flex-col gap-3 p-3 sm:p-4"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-vc-gold">
          <span className="text-sm">◆</span> Showdown
        </div>

        {error !== null && (
          <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-2 text-sm text-vc-danger">
            {error}
          </p>
        )}

        {pots.length === 0 ? (
          <p className="text-sm text-vc-ink-muted">
            No chips in play — end the hand to deal the next one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pots.map((pot, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vc-ink-muted">
                    {pots.length > 1
                      ? i === 0
                        ? 'Main pot'
                        : `Side ${i}`
                      : 'Pot'}
                  </span>
                  <span className="font-mono text-base font-bold tabular-nums text-vc-gold">
                    {pot.amount.toLocaleString()}
                  </span>
                </div>

                {!isContested(i) ? (
                  <p className="text-sm text-vc-ink-muted">
                    Goes to{' '}
                    <span className="font-medium text-vc-ink">
                      {nameOf(pot.eligibleSeats[0]!)}
                    </span>
                  </p>
                ) : isBanker ? (
                  <div className="flex flex-wrap gap-2">
                    {pot.eligibleSeats.map((seat) => {
                      const picked = picks[i]?.includes(seat) ?? false;
                      return (
                        <button
                          key={seat}
                          disabled={pending}
                          onClick={() => toggle(i, seat)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                            picked
                              ? 'border-vc-gold/70 bg-vc-gold/15 text-vc-gold'
                              : 'border-white/10 bg-white/[0.03] text-vc-ink-muted hover:text-vc-ink'
                          }`}
                        >
                          {nameOf(seat)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-vc-ink-muted">
                    {pot.eligibleSeats.map(nameOf).join(' · ')} — banker to
                    decide
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {isBanker ? (
          <button
            disabled={pending || (hasContested && !contestedReady)}
            onClick={() =>
              onSettle(pots.map((_, i) => (isContested(i) ? picks[i]! : [])))
            }
            className="rounded-xl bg-vc-gold px-4 py-3 text-sm font-semibold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(244_192_74/0.5)] transition hover:bg-vc-gold/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {awardLabel}
          </button>
        ) : (
          <p className="text-center text-sm text-vc-ink-muted">
            Waiting for the banker to award the pot…
          </p>
        )}
      </motion.div>
    </div>
  );
}
