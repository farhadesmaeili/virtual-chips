'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { ActionAvailability, ActionKind } from './action-availability';

export interface ActionPanelProps {
  readonly availability: ActionAvailability;
  /** Total pot, for the bet-sizing presets. */
  readonly pot: number;
  /** Current bet level this street, for raise-sizing presets. */
  readonly currentBet: number;
  /** True while an emitted action awaits the next hand state. */
  readonly pending: boolean;
  /** Friendly, server-sourced error for the last action (or null). */
  readonly error: string | null;
  /** Name of the player to act, shown while it is not the hero's turn. */
  readonly actingName?: string;
  readonly onAct: (action: ActionKind, amount?: number) => void;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * The player's action controls. Only the actions the server would accept are
 * offered (via {@link ActionAvailability}); the server stays authoritative and
 * re-validates every action, so this panel never settles anything itself.
 */
export function ActionPanel({
  availability,
  pot,
  currentBet,
  pending,
  error,
  actingName,
  onAct,
}: ActionPanelProps): React.ReactElement {
  const reduce = useReducedMotion();
  const { isHeroTurn } = availability;

  return (
    <div className="pointer-events-none sticky bottom-3 z-20 mt-2 flex justify-center">
      <AnimatePresence mode="wait">
        {isHeroTurn ? (
          <motion.div
            key="acting"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="vc-tray pointer-events-auto w-full max-w-xl p-3 sm:p-4"
          >
            <TurnControls
              availability={availability}
              pot={pot}
              currentBet={currentBet}
              pending={pending}
              error={error}
              onAct={onAct}
            />
          </motion.div>
        ) : (
          <motion.p
            key="waiting"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none rounded-full border border-white/[0.06] bg-black/30 px-4 py-2 text-sm text-vc-ink-muted backdrop-blur-sm"
          >
            {actingName ? (
              <>
                <span className="font-medium text-vc-ink">{actingName}</span> to
                act
              </>
            ) : (
              'Waiting for the deal'
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function TurnControls({
  availability,
  pot,
  currentBet,
  pending,
  error,
  onAct,
}: Omit<ActionPanelProps, 'isHeroTurn' | 'actingName'>): React.ReactElement {
  const { toCall, canFold, canCheck, canCall, sizing, canAllIn, allInTo } =
    availability;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(sizing?.min ?? 0);

  const raiseLabel = sizing?.mode === 'bet' ? 'Bet' : 'Raise';

  return (
    <div className="flex flex-col gap-3">
      {/* Status: whose money, what is owed. */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="flex items-center gap-2 font-medium text-vc-emerald">
          <span className="h-2 w-2 rounded-full bg-vc-emerald shadow-[0_0_8px_rgb(52_211_153/0.8)]" />
          Your turn
        </span>
        {toCall > 0 && (
          <span className="text-vc-ink-muted">
            To call{' '}
            <span className="font-mono font-semibold tabular-nums text-vc-ink">
              {toCall.toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {error !== null && (
        <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-2 text-sm text-vc-danger">
          {error}
        </p>
      )}

      {/* Sizing tray for a bet or raise. */}
      <AnimatePresence initial={false}>
        {open && sizing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <SizingTray
              mode={sizing.mode}
              min={sizing.min}
              max={sizing.max}
              step={sizing.step}
              pot={pot}
              currentBet={currentBet}
              toCall={toCall}
              amount={amount}
              onAmount={setAmount}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary actions. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionButton
          tone="danger"
          disabled={!canFold || pending}
          onClick={() => onAct('FOLD')}
        >
          Fold
        </ActionButton>

        {canCheck ? (
          <ActionButton
            tone="emerald"
            disabled={pending}
            onClick={() => onAct('CHECK')}
          >
            Check
          </ActionButton>
        ) : (
          <ActionButton
            tone="emerald"
            disabled={!canCall || pending}
            onClick={() => onAct('CALL')}
          >
            Call{' '}
            <span className="font-mono tabular-nums">
              {toCall.toLocaleString()}
            </span>
          </ActionButton>
        )}

        {sizing ? (
          open ? (
            <ActionButton
              tone="gold"
              disabled={pending}
              onClick={() => {
                onAct(sizing.mode === 'bet' ? 'BET' : 'RAISE', amount);
              }}
            >
              {sizing.mode === 'bet' ? 'Bet ' : 'Raise to '}
              <span className="font-mono tabular-nums">
                {amount.toLocaleString()}
              </span>
            </ActionButton>
          ) : (
            <ActionButton
              tone="outline"
              disabled={pending}
              onClick={() => setOpen(true)}
            >
              {raiseLabel}…
            </ActionButton>
          )
        ) : (
          <span className="hidden sm:block" />
        )}

        <ActionButton
          tone="allin"
          disabled={!canAllIn || pending}
          onClick={() => onAct('ALL_IN')}
        >
          All in
          <span className="ml-1 font-mono text-xs tabular-nums opacity-80">
            {allInTo.toLocaleString()}
          </span>
        </ActionButton>
      </div>
    </div>
  );
}

function SizingTray({
  mode,
  min,
  max,
  step,
  pot,
  currentBet,
  toCall,
  amount,
  onAmount,
}: {
  mode: 'bet' | 'raise';
  min: number;
  max: number;
  step: number;
  pot: number;
  currentBet: number;
  toCall: number;
  amount: number;
  onAmount: (value: number) => void;
}): React.ReactElement {
  const snap = (v: number): number =>
    clamp(Math.round(v / step) * step, min, max);

  // Pot-based presets, bounded by the tested [min, max] range. For a raise the
  // "to" amount is the current bet plus a pot-sized increment (pot + the call).
  const presets =
    mode === 'bet'
      ? [
          { label: 'Min', value: min },
          { label: '½ Pot', value: snap(pot / 2) },
          { label: 'Pot', value: snap(pot) },
          { label: 'Max', value: max },
        ]
      : [
          { label: 'Min', value: min },
          { label: '½ Pot', value: snap(currentBet + (pot + toCall) / 2) },
          { label: 'Pot', value: snap(currentBet + pot + toCall) },
          { label: 'Max', value: max },
        ];

  // Drop presets that collapse onto the same value (e.g. tiny stacks).
  const seen = new Set<number>();
  const uniquePresets = presets.filter((p) =>
    seen.has(p.value) ? false : (seen.add(p.value), true),
  );

  return (
    <div className="mb-1 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vc-ink-muted">
          {mode === 'bet' ? 'Bet' : 'Raise to'}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums text-vc-gold">
          {amount.toLocaleString()}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={amount}
        onChange={(e) => onAmount(snap(Number(e.target.value)))}
        className="w-full accent-vc-emerald"
        aria-label={mode === 'bet' ? 'Bet amount' : 'Raise to amount'}
      />

      <div className="flex flex-wrap items-center gap-2">
        {uniquePresets.map((p) => (
          <button
            key={p.label}
            onClick={() => onAmount(p.value)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              amount === p.value
                ? 'border-vc-emerald/60 bg-vc-emerald/15 text-vc-emerald'
                : 'border-white/10 bg-white/[0.03] text-vc-ink-muted hover:text-vc-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={amount}
          onChange={(e) => onAmount(clamp(Number(e.target.value), min, max))}
          className="ml-auto w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right font-mono text-sm tabular-nums text-vc-ink outline-none focus:border-vc-emerald/60"
          aria-label="Exact amount"
        />
      </div>
    </div>
  );
}

type Tone = 'danger' | 'emerald' | 'gold' | 'outline' | 'allin';

const TONES: Record<Tone, string> = {
  danger:
    'border border-vc-danger/40 bg-vc-danger/5 text-vc-danger hover:bg-vc-danger/15',
  emerald:
    'bg-vc-emerald text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(52_211_153/0.5)] hover:bg-vc-emerald/90',
  gold: 'bg-vc-gold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(244_192_74/0.5)] hover:bg-vc-gold/90',
  outline:
    'border border-vc-rail-edge/60 bg-white/[0.04] text-vc-ink hover:bg-white/[0.08]',
  allin:
    'border border-vc-gold/50 bg-vc-gold/5 text-vc-gold hover:bg-vc-gold/15',
};

function ActionButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: Tone;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-xl px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${TONES[tone]}`}
    >
      {children}
    </motion.button>
  );
}
