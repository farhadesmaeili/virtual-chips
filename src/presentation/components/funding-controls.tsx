'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { PublicChipRequest } from '@/presentation/lib/socket-events';

export interface FundingControlsProps {
  readonly requests: readonly PublicChipRequest[];
  /** The viewer's seat, or null if they are only watching. */
  readonly heroSeat: number | null;
  /** The viewer's current stack, to nudge them when they are out of chips. */
  readonly heroChips: number;
  readonly isBanker: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly onRequest: (amount: number) => void;
  readonly onApprove: (id: string) => void;
  readonly onReject: (id: string) => void;
}

/**
 * Buy-in funding (task 4.15): a seated player requests chips; the banker
 * approves or rejects from the queue. The server is authoritative — this only
 * surfaces the requests and sends intents.
 */
export function FundingControls({
  requests,
  heroSeat,
  heroChips,
  isBanker,
  pending,
  error,
  onRequest,
  onApprove,
  onReject,
}: FundingControlsProps): React.ReactElement | null {
  const [amount, setAmount] = useState('1000');

  const seated = heroSeat !== null;
  const myRequest = requests.find((r) => r.seat === heroSeat);
  if (!seated && !isBanker) return null;

  const submit = (): void => {
    const value = Number(amount);
    if (Number.isInteger(value) && value > 0) onRequest(value);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
      {/* Player's own request control. */}
      {seated &&
        (myRequest ? (
          <p className="text-sm text-vc-ink-muted">
            Requested{' '}
            <span className="font-mono tabular-nums text-vc-gold">
              {myRequest.amount.toLocaleString()}
            </span>{' '}
            — waiting for the banker.
          </p>
        ) : (
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
                  if (e.key === 'Enter') submit();
                }}
                aria-label="Buy-in amount"
                className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-sm tabular-nums text-vc-ink outline-none focus-visible:border-vc-emerald/60"
              />
              <motion.button
                whileTap={pending ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.12 }}
                disabled={pending}
                onClick={submit}
                className="rounded-lg border border-vc-emerald/50 bg-vc-emerald/10 px-4 py-1.5 text-sm font-semibold text-vc-emerald transition hover:bg-vc-emerald/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Request chips
              </motion.button>
            </div>
          </div>
        ))}

      {/* Banker's approval queue. */}
      {isBanker && requests.length > 0 && (
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
                    disabled={pending}
                    onClick={() => onApprove(r.id)}
                    className="rounded-md border border-vc-gold/50 bg-vc-gold/10 px-2.5 py-1 text-xs font-semibold text-vc-gold transition hover:bg-vc-gold/20 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => onReject(r.id)}
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

      {error !== null && (
        <p className="rounded-lg border border-vc-danger/30 bg-vc-danger/10 px-3 py-1.5 text-sm text-vc-danger">
          {error}
        </p>
      )}
    </div>
  );
}
