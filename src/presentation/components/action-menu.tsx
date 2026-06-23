'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useReducedMotionPreference } from '@/presentation/animations';
import type { MenuModel } from './menu-availability';
import type { PublicChipRequest } from '@/presentation/lib/socket-events';

export interface ActionMenuProps {
  readonly model: MenuModel;
  /** Pending buy-in requests, for the banker's approve/deny queue. */
  readonly requests: readonly PublicChipRequest[];
  /** The viewer's stack, to nudge them when they are out of chips. */
  readonly heroChips: number;
  readonly pending: boolean;
  /** Error owned by a presence / start-hand action (or null). */
  readonly actionError: string | null;
  /** Error owned by a funding action (request / approve / reject) (or null). */
  readonly fundingError: string | null;
  readonly onSitOut: () => void;
  readonly onSitIn: () => void;
  readonly onLeave: () => void;
  readonly onRequestChips: (amount: number) => void;
  readonly onApproveChips: (id: string) => void;
  readonly onRejectChips: (id: string) => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The unified action menu (task 4.16): one button opening a sheet that collects
 * the always-present controls that used to be scattered bars — presence
 * (sit out / in, leave; task 4.14) and funding (request chips, and the banker's
 * approve/deny queue; task 4.15). The phase-flow trays (betting, deal-street,
 * showdown, and the banker's start-hand button) deliberately stay separate.
 *
 * This is presentation only: it sends the same intents the bars sent. The server
 * re-validates every event, so hiding/disabling an item is UX, not authorization.
 */
export function ActionMenu({
  model,
  requests,
  heroChips,
  pending,
  actionError,
  fundingError,
  onSitOut,
  onSitIn,
  onLeave,
  onRequestChips,
  onApproveChips,
  onRejectChips,
}: ActionMenuProps): React.ReactElement | null {
  const reduce = useReducedMotionPreference();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1000');
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((): void => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape, on outside click, and trap Tab within the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || panelRef.current === null) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointerDown = (e: MouseEvent): void => {
      if (
        wrapperRef.current !== null &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    // Move focus into the panel on open.
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, close]);

  if (!model.hasAny) return null;

  const submitRequest = (): void => {
    const value = Number(amount);
    if (Number.isInteger(value) && value > 0) onRequestChips(value);
  };

  return (
    <div ref={wrapperRef} className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-vc-rail-edge/60 bg-white/[0.04] px-4 py-2 text-sm font-medium text-vc-ink transition hover:bg-white/[0.08] active:scale-[0.99]"
      >
        <span aria-hidden className="text-vc-ink-muted">
          ☰
        </span>
        Actions
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile scrim; desktop dismiss is the outside-click listener. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            />
            <motion.div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Table actions"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="vc-tray fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col gap-3 rounded-b-none p-4 sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mx-0 sm:mb-2 sm:w-80 sm:rounded-b-[18px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vc-ink-muted">
                  Actions
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="rounded-md px-2 py-0.5 text-vc-ink-muted transition hover:text-vc-ink"
                >
                  ✕
                </button>
              </div>

              {/* Presence: sit out / sit in. */}
              {model.sitIn.show && (
                <button
                  type="button"
                  disabled={model.sitIn.disabled}
                  onClick={onSitIn}
                  className="rounded-lg border border-vc-emerald/40 bg-vc-emerald/10 px-4 py-2 text-sm font-medium text-vc-emerald transition hover:bg-vc-emerald/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sit in
                </button>
              )}
              {model.sitOut.show && (
                <button
                  type="button"
                  disabled={model.sitOut.disabled}
                  onClick={onSitOut}
                  className="rounded-lg border border-vc-rail-edge/60 bg-white/[0.04] px-4 py-2 text-sm font-medium text-vc-ink transition hover:bg-white/[0.08] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sit out
                </button>
              )}

              {/* Funding: request a buy-in, or a waiting note. */}
              {model.requestChips.show ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-vc-ink-muted">
                    {heroChips === 0
                      ? "You're out of chips — request a buy-in."
                      : 'Request a buy-in'}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRequest();
                      }}
                      aria-label="Buy-in amount"
                      className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm tabular-nums text-vc-ink outline-none focus-visible:border-vc-emerald/60"
                    />
                    <button
                      type="button"
                      disabled={model.requestChips.disabled}
                      onClick={submitRequest}
                      className="rounded-lg border border-vc-emerald/50 bg-vc-emerald/10 px-4 py-1.5 text-sm font-semibold text-vc-emerald transition hover:bg-vc-emerald/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Request chips
                    </button>
                  </div>
                </div>
              ) : (
                model.ownRequestPending && (
                  <p className="text-sm text-vc-ink-muted">
                    Buy-in requested — waiting for the banker.
                  </p>
                )
              )}

              {fundingError !== null && (
                <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-1.5 text-sm text-vc-danger">
                  {fundingError}
                </p>
              )}

              {/* Banker: the approve/deny queue. */}
              {model.requestQueue.show && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vc-ink-muted">
                    Chip requests
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {requests.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                      >
                        <span className="text-sm text-vc-ink">
                          <span className="font-medium">{r.username}</span>
                          <span className="text-vc-ink-faint">
                            {' '}
                            · seat {r.seat + 1}
                          </span>{' '}
                          <span className="font-mono tabular-nums text-vc-gold">
                            {r.amount.toLocaleString()}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onApproveChips(r.id)}
                            className="rounded-md border border-vc-gold/50 bg-vc-gold/10 px-2.5 py-1 text-xs font-semibold text-vc-gold transition hover:bg-vc-gold/20 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onRejectChips(r.id)}
                            className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-vc-ink-muted transition hover:border-vc-danger/40 hover:text-vc-danger disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Leave is last and visually separated — it's destructive. */}
              {model.leave.show && (
                <button
                  type="button"
                  disabled={model.leave.disabled}
                  title={model.leave.reason}
                  onClick={onLeave}
                  className="mt-1 rounded-lg border border-vc-danger/40 bg-vc-danger/10 px-4 py-2 text-sm font-medium text-vc-danger transition hover:bg-vc-danger/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Leave table
                </button>
              )}
              {model.leave.reason !== undefined && (
                <p className="text-xs text-vc-ink-faint">
                  {model.leave.reason}
                </p>
              )}

              {actionError !== null && (
                <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-1.5 text-sm text-vc-danger">
                  {actionError}
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
