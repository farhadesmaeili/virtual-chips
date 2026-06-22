// Pure helpers for chip motion (task 5.1). No React, no I/O — they classify a
// LIVE event into a chip animation and derive endpoints from the shared seat
// geometry, so the wiring stays a thin, testable shell.

import { chipColor, topDenomination } from './chip-denominations';
import { MAX_SEATS, seatSlots } from './seat-layout';
import type {
  ActionApplied,
  AppliedActionType,
  HandSettled,
} from '@/presentation/lib/socket-events';

/**
 * A point on the table as a percentage of the seat-overlay box — the same
 * coordinate space as `seatSlots`, so chip endpoints line up with seats without
 * any hard-coded coordinates.
 */
export interface Point {
  readonly xPct: number;
  readonly yPct: number;
}

/**
 * The pot / table center. `seatSlots` arranges seats around (50, 50), so this is
 * the geometric center of the seat ring — derived from the layout, not a magic
 * spot.
 */
export const TABLE_CENTER: Point = { xPct: 50, yPct: 50 };

/** Center of `seat` in overlay %, from the shared `seatSlots` geometry. */
export function seatPoint(seat: number): Point {
  const slot = seatSlots(MAX_SEATS).find((s) => s.seat === seat);
  return slot ? { xPct: slot.xPct, yPct: slot.yPct } : TABLE_CENTER;
}

/** Actions that move chips into the pot; fold/check move none. */
export function commitsChips(action: AppliedActionType): boolean {
  return (
    action === 'CALL' ||
    action === 'BET' ||
    action === 'RAISE' ||
    action === 'ALL_IN'
  );
}

export type ChipMotion =
  | {
      readonly kind: 'to-pot';
      readonly fromSeat: number;
      /** Chips committed; null for call/all-in (the client sends no amount). */
      readonly amount: number | null;
    }
  | {
      readonly kind: 'to-winners';
      readonly awards: readonly {
        readonly seat: number;
        readonly amount: number;
      }[];
    };

/**
 * A table update classified for animation. Only LIVE transient events
 * (`action:applied`, `hand:settled`) ever animate; a `snapshot` (the
 * `room:state` / `hand:state` hydration sent on join/resync) never does — so a
 * mid-hand reconnect cannot replay past chip flights (no ghost chips). This is
 * the single place that decision is made.
 */
export type TableSignal =
  | { readonly type: 'action'; readonly event: ActionApplied }
  | { readonly type: 'settled'; readonly event: HandSettled }
  | { readonly type: 'snapshot' };

export function planChipMotion(signal: TableSignal): ChipMotion | null {
  switch (signal.type) {
    case 'action':
      return commitsChips(signal.event.action)
        ? {
            kind: 'to-pot',
            fromSeat: signal.event.seat,
            amount: signal.event.amount,
          }
        : null;
    case 'settled': {
      const awards = signal.event.payouts;
      return awards.length > 0 ? { kind: 'to-winners', awards } : null;
    }
    case 'snapshot':
      return null;
  }
}

/** Source→target endpoints + denomination tint for a single chip flight. */
export interface FlightSpec {
  readonly from: Point;
  readonly to: Point;
  /** Chip color, derived from the flight's value (the single chip-color source). */
  readonly color: string;
}

/** Denomination color for an amount — the one chip-color source of truth. */
export function chipTint(amount: number): string {
  return chipColor(topDenomination(amount));
}

/**
 * Expands a chip motion into concrete flights using `seatSlots` geometry: one
 * seat→center flight for a commit, one center→seat flight per winner (so a split
 * pot fans out to every winning seat). Each flight is tinted by its value so
 * flying chips match the pot/bet chips (vc-design: color encodes value).
 *
 * `fallbackAmount` (the current pot) tints a commit whose amount is unknown
 * (call/all-in send no amount), so those chips still read as the table's scale.
 */
export function flightsFor(
  motion: ChipMotion,
  fallbackAmount: number,
): FlightSpec[] {
  if (motion.kind === 'to-pot') {
    return [
      {
        from: seatPoint(motion.fromSeat),
        to: TABLE_CENTER,
        color: chipTint(motion.amount ?? fallbackAmount),
      },
    ];
  }
  return motion.awards.map((award) => ({
    from: TABLE_CENTER,
    to: seatPoint(award.seat),
    color: chipTint(award.amount),
  }));
}
