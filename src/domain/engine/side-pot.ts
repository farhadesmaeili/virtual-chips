import type { PlayerInHand } from '../entities/player-in-hand';
import { createPot, type Pot } from '../entities/pot';
import { Chips } from '../value-objects/chips';

/**
 * One seat's contribution to the pot, for side-pot calculation.
 *
 * `folded` means the seat cannot win (folded or sitting out): its chips stay
 * in the pots and fund the layers, but the seat is never added to a pot's
 * eligible list. See docs/BETTING-ENGINE.md §4.
 */
export interface PotContribution {
  readonly seat: number;
  /** Total chips this seat committed across the whole hand. */
  readonly committed: number;
  /** True if the seat cannot win this hand (folded / sitting out). */
  readonly folded: boolean;
}

/**
 * Splits committed chips into main + side pots using layer peeling
 * (docs/BETTING-ENGINE.md §4).
 *
 * Each iteration peels the smallest remaining contribution level: every seat
 * that still has chips contributes up to that level into one pot layer, and
 * only non-folded seats become eligible to win that layer. Folded seats'
 * chips remain in the layers they funded but the seat is not eligible.
 *
 * Chips are fully conserved: the sum of the returned pot amounts equals the
 * sum of the inputs.
 *
 * Precondition: uncalled bets have already been returned by the engine, so
 * the largest contribution always belongs to a non-folded seat. If only
 * folded chips remained (malformed input) the loop still terminates, yielding
 * a pot with no eligible seats (dead chips) rather than looping forever.
 */
export function calculateSidePots(
  contributions: readonly PotContribution[],
): Pot[] {
  // Validate and copy into a mutable working set, dropping zero contributions.
  const remaining = contributions
    .map((c) => {
      Chips.of(c.committed); // throws on negative / non-integer amounts
      return { seat: c.seat, committed: c.committed, folded: c.folded };
    })
    .filter((c) => c.committed > 0);

  const pots: Pot[] = [];

  while (remaining.some((c) => c.committed > 0)) {
    // The peel level is the smallest positive amount among non-folded seats.
    // If only folded chips remain (not expected for well-formed input), fall
    // back to the smallest positive remaining so the loop terminates.
    const nonFolded = remaining.filter((c) => !c.folded && c.committed > 0);
    const pool =
      nonFolded.length > 0
        ? nonFolded
        : remaining.filter((c) => c.committed > 0);
    const minLevel = Math.min(...pool.map((c) => c.committed));

    let layerAmount = 0;
    const eligible: number[] = [];
    for (const c of remaining) {
      if (c.committed <= 0) continue;
      const take = Math.min(c.committed, minLevel);
      layerAmount += take;
      c.committed -= take;
      if (!c.folded) eligible.push(c.seat);
    }

    pots.push(
      createPot(
        layerAmount,
        eligible.sort((a, b) => a - b),
      ),
    );
  }

  return mergePotsByEligibleSeats(pots);
}

/**
 * Adapter: builds pot contributions from the players in a hand and computes
 * the side pots. Only `active` or `all_in` seats can win; `folded` and
 * `sitting_out` seats keep their chips in the pot but cannot win.
 */
export function calculateSidePotsForPlayers(
  players: readonly PlayerInHand[],
): Pot[] {
  return calculateSidePots(
    players.map((p) => ({
      seat: p.seat,
      committed: p.committedTotal,
      folded: !(p.state === 'active' || p.state === 'all_in'),
    })),
  );
}

/** Merges pots that share the exact same eligible seats (same potential winners). */
function mergePotsByEligibleSeats(pots: readonly Pot[]): Pot[] {
  const byKey = new Map<string, Pot>();
  for (const pot of pots) {
    const key = JSON.stringify(pot.eligibleSeats);
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing
        ? createPot(existing.amount + pot.amount, pot.eligibleSeats)
        : pot,
    );
  }
  return [...byKey.values()];
}
