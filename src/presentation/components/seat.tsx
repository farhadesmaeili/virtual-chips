'use client';

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  betPost,
  playerEnter,
  seatHighlight,
  springSoft,
  useMotionVariants,
  useReducedMotionPreference,
} from '@/presentation/animations';
import { ChipStack } from './chip';
import { CountdownRing } from './countdown-ring';
import {
  formatStackChips,
  stackHasHiddenPrecision,
} from '@/presentation/lib/format-chips';
import { actionVerbLabel, labelFade } from './seat-action';
import { seatBetChipOffset, type SeatSlot } from './seat-layout';
import type {
  AppliedActionType,
  PublicHandPlayer,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

/** Shared-layout id for the single turn highlight that slides between seats. */
const ACTIVE_HIGHLIGHT_LAYOUT_ID = 'active-seat-highlight';
/** Shared-layout id for the single dealer button that glides between seats. */
const DEALER_BUTTON_LAYOUT_ID = 'dealer-button';

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
  /** Absolute turn deadline (epoch ms) for the acting seat; drives the ring. */
  readonly actionDeadline?: number | null;
  /** Configured turn length (ms); the ring's fill + warning threshold basis. */
  readonly actionTimeoutMs: number;
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
  actionDeadline = null,
  actionTimeoutMs,
}: SeatProps): React.ReactElement {
  const folded = handPlayer?.state === 'folded';
  const allIn = handPlayer?.state === 'all_in';
  const sittingOut = member?.sittingOut ?? false;
  const stack = handPlayer?.stack ?? member?.chips ?? 0;
  const bet = handPlayer?.committedThisStreet ?? 0;
  const lastAction = handPlayer?.lastAction ?? null;

  // Enter/exit (join/leave/swap) — scale + fade under reduced-motion (fade only).
  // `x`/`y` keep the seat centered on its slot point while Framer composes the
  // entrance scale into the same transform (no top/left thrash).
  const presenceVariants = useMotionVariants(playerEnter);
  // Blind/bet chips appearing in front of the seat (task 5.4).
  const betVariants = useMotionVariants(betPost);
  // Per-seat px nudge toward table center, kept on its own element so it never
  // clobbers the Tailwind centering/lift base of the bet-chip block.
  const off = seatBetChipOffset(slot);

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${slot.xPct}%`,
        top: `${slot.yPct}%`,
        x: '-50%',
        y: '-50%',
      }}
      variants={presenceVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="vc-seat-stand">
        {member === undefined ? (
          <EmptySeat seat={slot.seat} />
        ) : (
          <div
            data-acting={isActing || undefined}
            data-sitting-out={sittingOut || undefined}
            className={`flex flex-col items-center transition-opacity duration-300 ${
              folded || sittingOut ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {/* Bet chips sit on the felt between the seat and the pot. The outer
                div owns positioning (its `transform` offsets toward center); the
                inner motion node owns the entrance so Framer's scale never fights
                the positioning transform. Blinds/bets get an IN-PLACE spring pop
                (task 5.4) — deliberately NOT a seat→felt flight, so it can't be
                "upgraded" to one later. The stack is tinted by its top chip
                denomination. */}
            {bet > 0 && (
              <div className="vc-bet absolute -top-1 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-1.5">
                <div style={{ transform: `translate(${off.x}px, ${off.y}px)` }}>
                  <motion.div
                    className="flex items-center gap-1.5"
                    variants={betVariants}
                    initial="initial"
                    animate="animate"
                  >
                    <ChipStack amount={bet} size={16} height={3} />
                    <span className="font-mono text-xs font-semibold tabular-nums text-vc-gold [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                      {bet.toLocaleString()}
                    </span>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Avatar + concentric layers: turn highlight (z-0, slides between
                seats), avatar (z-10), countdown ring (z-20, depleting stroke on
                top), dealer button (z-30). The ring keeps no layoutId so its
                stroke tween never fights the highlight's shared-layout slide. */}
            <div className="relative grid h-12 w-12 place-items-center sm:h-14 sm:w-14">
              {isActing && <SeatHighlight />}
              {isActing && (
                <div className="absolute inset-0 z-20">
                  <CountdownRing
                    deadline={actionDeadline}
                    totalMs={actionTimeoutMs}
                  />
                </div>
              )}
              <div
                className={`relative z-10 grid h-11 w-11 place-items-center rounded-full font-display text-sm font-bold sm:h-[3.25rem] sm:w-[3.25rem] ${
                  isActing
                    ? 'bg-vc-felt-lamp text-vc-emerald'
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

              {/* Dealer button rides just off the avatar; it glides between
                  seats each new hand via shared layout (task 5.4). */}
              {isButton && <DealerButton />}
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
              {/* Last action (verb only) — a fixed-height row so the seat never
                  reflows as the label appears/clears. */}
              <LastActionLabel verb={lastAction} />
              <StackReadout stack={stack} allIn={allIn} />
              {sittingOut && (
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-vc-ink-muted">
                  Sitting out
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * The single turn highlight — an emerald glow/border behind the active avatar.
 * It carries the shared `layoutId`, so when only one is mounted at a time it
 * slides from the previous active seat to the new one as `actingSeat` changes.
 * The slide is a Framer layout animation (transform, not top/left); under
 * reduced-motion it repositions instantly and only fades, via the 5.0 helpers.
 */
function SeatHighlight(): React.ReactElement {
  const variants = useMotionVariants(seatHighlight);
  const reduced = useReducedMotionPreference();
  return (
    <motion.div
      layoutId={ACTIVE_HIGHLIGHT_LAYOUT_ID}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 rounded-full bg-[rgb(52_211_153/0.10)] shadow-[0_0_22px_-2px_rgb(52_211_153/0.7),0_0_0_2px_rgb(52_211_153/0.35)]"
      variants={variants}
      initial="inactive"
      animate="active"
      transition={{ layout: reduced ? { duration: 0 } : springSoft }}
    />
  );
}

/**
 * The single dealer button. It carries the shared `layoutId`, so as only one is
 * mounted at a time it glides from the previous button seat to the new one when
 * the hand rotates — the same shared-layout pattern as {@link SeatHighlight}
 * (task 5.3). The glide is a Framer layout animation (transform, not top/left);
 * under reduced-motion it repositions instantly, via the 5.0 helper.
 */
function DealerButton(): React.ReactElement {
  const reduced = useReducedMotionPreference();
  return (
    <motion.span
      layoutId={DEALER_BUTTON_LAYOUT_ID}
      aria-label="Dealer button"
      className="pointer-events-none absolute -bottom-1 -right-1 z-30 grid h-5 w-5 place-items-center rounded-full bg-vc-gold font-mono text-[10px] font-bold text-vc-felt-edge shadow-[0_2px_5px_rgb(0_0_0/0.5)]"
      transition={{ layout: reduced ? { duration: 0 } : springSoft }}
    >
      D
    </motion.span>
  );
}

/**
 * The seat's last action this hand (verb only — the chips in front already show
 * the amount). The row keeps a fixed height even when empty so the seat never
 * reflows as the label appears/clears. On a verb change it fades in via the 5.0
 * helper (opacity only; instant under reduced motion).
 */
function LastActionLabel({
  verb,
}: {
  verb: AppliedActionType | null;
}): React.ReactElement {
  const variants = useMotionVariants(labelFade);
  const label = actionVerbLabel(verb);
  return (
    <div className="flex h-3.5 items-center justify-center">
      {label !== '' && (
        <motion.span
          // Remount on verb change so the fade replays.
          key={verb ?? 'none'}
          variants={variants}
          initial="initial"
          animate="animate"
          className="text-[9px] font-semibold uppercase tracking-[0.12em] text-vc-ink-muted"
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}

/**
 * The seat's stack readout. The number is a Framer motion value rendered
 * directly into the DOM (`<motion.span>{text}</motion.span>`) and tweened with
 * `animate()`, so it counts up/down on change WITHOUT re-rendering the seat each
 * frame — only the text node updates (the same approach as the 5.2 ring). Under
 * reduced motion it snaps to the value instantly. The tween always settles on
 * the authoritative `stack`, and the "All in" display is preserved.
 *
 * When the compact string hides precision (large stacks), the readout becomes an
 * in-place disclosure: hovering (desktop), focusing (keyboard), or tapping
 * (mobile) reveals the exact grouped balance in a small popover. The idle/closed
 * visual is byte-identical to the non-interactive readout — the compact value
 * stays the default. The popover is purely visual (`aria-hidden`); the exact
 * value is announced via the trigger's `aria-label`.
 */
function StackReadout({
  stack,
  allIn,
}: {
  stack: number;
  allIn: boolean;
}): React.ReactElement {
  const reduced = useReducedMotionPreference();
  const value = useMotionValue(stack);
  // Large stacks render compact ("1.2M") so they never overflow the tight seat
  // nameplate on a narrow phone; the exact value stays available via title/aria.
  const text = useTransform(value, (v) => formatStackChips(Math.round(v)));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reduced) {
      value.set(stack);
      return;
    }
    const controls = animate(value, stack, { duration: 0.5, ease: 'easeOut' });
    return () => controls.stop();
  }, [stack, reduced, value]);

  // Dismiss the disclosure on Escape and on a pointer landing outside the
  // trigger. Mirrors the inline pattern in action-menu.tsx (kept inline, not a
  // shared hook, to match house style).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent): void => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const exact = Math.round(stack).toLocaleString();
  const className = 'font-mono text-sm font-semibold tabular-nums text-vc-gold';
  const inner = allIn ? 'All in' : <motion.span>{text}</motion.span>;
  const interactive = !allIn && stackHasHiddenPrecision(stack);

  if (!interactive) {
    return (
      <div className={className} title={exact} aria-label={`Stack ${exact}`}>
        {inner}
      </div>
    );
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      className={`${className} relative m-0 inline-flex appearance-none items-center border-0 bg-transparent p-0`}
      aria-label={`Stack ${exact}`}
      aria-expanded={open}
      onPointerEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}
    >
      {inner}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            aria-hidden="true"
            className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-vc-felt-deep/95 px-2 py-1 font-mono text-xs tabular-nums text-vc-gold shadow-lg ring-1 ring-vc-gold/20"
            style={{ transformOrigin: 'top center' }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 500, damping: 32 }
            }
          >
            {exact}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
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
