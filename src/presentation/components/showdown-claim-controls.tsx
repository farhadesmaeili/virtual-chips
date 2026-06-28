'use client';

import { motion } from 'framer-motion';
import { useReducedMotionPreference } from '@/presentation/animations';
import {
  buildContenderRoster,
  deriveConfirmGate,
  isContender,
  type ClaimChoice,
  type ClaimStatus,
} from './showdown-claim-model';
import type {
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

export interface ShowdownClaimControlsProps {
  readonly hand: PublicHandState;
  readonly members: readonly PublicRoomMember[];
  /** The seat the current user occupies, or null if only watching. */
  readonly heroSeat: number | null;
  readonly isBanker: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  /** The hero claims for THEMSELVES; the seat is resolved server-side, never sent. */
  readonly onClaim: (choice: ClaimChoice) => void;
  /**
   * The banker confirms the showdown. This MUST funnel through the existing
   * `hand:settle` path with EMPTY declarations — the server seeds winners from the
   * stored claims and ignores any client declarations. This tray never builds
   * per-pot winner sets (that is mode A's `ShowdownControls`).
   */
  readonly onConfirm: () => void;
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
  claimed: 'Claims win',
  mucked: 'Mucked',
  waiting: 'Deciding…',
};

const STATUS_CLASS: Record<ClaimStatus, string> = {
  claimed: 'border-vc-gold/60 bg-vc-gold/15 text-vc-gold',
  mucked: 'border-white/10 bg-white/[0.03] text-vc-ink-muted',
  waiting: 'border-white/10 bg-white/[0.03] text-vc-ink-muted',
};

/**
 * The player-showdown tray (mode B, task 6.1). Without hand evaluation, each live
 * contender claims `'win'` or `'muck'` for themselves, the banker watches the
 * claims come in, and then confirms — at which point the SERVER turns the stored
 * claims into the winner declarations and settles. The client never decides a
 * winner and never moves a chip: confirm only emits `hand:settle` with empty
 * declarations (see {@link onConfirm}). Mode A (banker-declared) uses the separate
 * `ShowdownControls`; this component is never reused for it.
 */
export function ShowdownClaimControls({
  hand,
  members,
  heroSeat,
  isBanker,
  pending,
  error,
  onClaim,
  onConfirm,
}: ShowdownClaimControlsProps): React.ReactElement {
  const reduce = useReducedMotionPreference();

  const hero =
    heroSeat === null
      ? undefined
      : hand.players.find((p) => p.seat === heroSeat);
  const heroIsContender = hero !== undefined && isContender(hero.state);

  const roster = buildContenderRoster(hand.players, members, heroSeat);
  const gate = deriveConfirmGate(hand.players);

  return (
    <div className="pointer-events-none sticky bottom-3 z-20 mt-2 flex justify-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="vc-tray pointer-events-auto flex w-full max-w-xl flex-col gap-3 p-3 sm:p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-vc-gold">
            <span className="text-sm">◆</span> Showdown
          </div>
          <span className="font-mono text-base font-bold tabular-nums text-vc-gold">
            {hand.totalPot.toLocaleString()}
          </span>
        </div>

        {error !== null && (
          <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-2 text-sm text-vc-danger">
            {error}
          </p>
        )}

        {/* Who is contesting, and where each one stands. */}
        <ul className="flex flex-col gap-1.5">
          {roster.map((row) => (
            <li
              key={row.seat}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              <span className="text-sm font-medium text-vc-ink">
                {row.username}
                {row.isHero && (
                  <span className="ml-1.5 text-[11px] font-normal text-vc-ink-muted">
                    (you)
                  </span>
                )}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[row.status]}`}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </li>
          ))}
        </ul>

        {/* Hero claim controls — only a live contender may claim (server-mirrored). */}
        {heroIsContender && (
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => onClaim('win')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                hero?.claim === 'win'
                  ? 'border-vc-gold/70 bg-vc-gold/15 text-vc-gold'
                  : 'border-white/10 bg-white/[0.03] text-vc-ink hover:border-vc-gold/40'
              }`}
            >
              Claim win
            </button>
            <button
              disabled={pending}
              onClick={() => onClaim('muck')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                hero?.claim === 'muck'
                  ? 'border-vc-ink-muted/60 bg-white/[0.06] text-vc-ink'
                  : 'border-white/10 bg-white/[0.03] text-vc-ink-muted hover:text-vc-ink'
              }`}
            >
              Muck
            </button>
          </div>
        )}

        {/* Banker confirm — gated for UX; the server's settle is the real boundary. */}
        {isBanker ? (
          <>
            {gate.reason !== null && (
              <p className="text-center text-sm text-vc-ink-muted">
                {gate.reason}
              </p>
            )}
            <button
              disabled={pending || !gate.canConfirm}
              onClick={onConfirm}
              className="rounded-xl bg-vc-gold px-4 py-3 text-sm font-semibold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(244_192_74/0.5)] transition hover:bg-vc-gold/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm result
            </button>
          </>
        ) : (
          !heroIsContender && (
            <p className="text-center text-sm text-vc-ink-muted">
              Waiting for the players to claim…
            </p>
          )
        )}
      </motion.div>
    </div>
  );
}
