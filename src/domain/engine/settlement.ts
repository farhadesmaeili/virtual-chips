import { getPlayer, type Hand } from '../entities/hand';
import type { Pot } from '../entities/pot';
import { InvalidSettlementError } from '../errors';
import { Chips } from '../value-objects/chips';
import { calculateSidePotsForPlayers } from './side-pot';

/**
 * Winner seats for a single pot, as declared by the banker (mode A) or as the
 * banker-confirmed claim set (mode B). Must be a non-empty subset of the pot's
 * eligible seats. Ignored for uncontested pots (which auto-resolve).
 */
export type PotDeclaration = readonly number[];

export interface SettlementResult {
  /** The hand with winnings applied to stacks and status `settled`. */
  readonly hand: Hand;
  /** The side pots that were settled (derived from committedTotal). */
  readonly pots: readonly Pot[];
  /** Chips won per seat (only seats that won appear). */
  readonly payouts: ReadonlyMap<number, number>;
}

/**
 * Orders seats clockwise starting just left of the button (button + 1 first,
 * wrapping; the button seat itself is last). Used for the odd-chip rule.
 */
export function orderLeftOfButton(
  seats: readonly number[],
  buttonSeat: number,
): number[] {
  const above = seats.filter((s) => s > buttonSeat).sort((a, b) => a - b);
  const below = seats.filter((s) => s < buttonSeat).sort((a, b) => a - b);
  const onButton = seats.filter((s) => s === buttonSeat);
  return [...above, ...below, ...onButton];
}

/**
 * Distributes a pot among `winners` (a non-empty subset of the pot's eligible
 * seats). Splits equally; the odd-chip remainder goes one chip at a time to the
 * winners nearest the left of the button (docs/BETTING-ENGINE.md §5).
 */
export function distributePot(
  pot: Pot,
  winners: readonly number[],
  buttonSeat: number,
): Map<number, number> {
  if (winners.length === 0) {
    throw new InvalidSettlementError('a pot must have at least one winner');
  }
  const unique = new Set(winners);
  if (unique.size !== winners.length) {
    throw new InvalidSettlementError('winners must be distinct');
  }
  for (const seat of winners) {
    if (!pot.eligibleSeats.includes(seat)) {
      throw new InvalidSettlementError(
        `seat ${seat} is not eligible for this pot`,
      );
    }
  }

  const ordered = orderLeftOfButton(winners, buttonSeat);
  const k = ordered.length;
  const base = Math.floor(pot.amount / k);
  const remainder = pot.amount % k;

  const payouts = new Map<number, number>();
  ordered.forEach((seat, i) => {
    payouts.set(seat, base + (i < remainder ? 1 : 0));
  });
  return payouts;
}

/**
 * Settles a hand that is awaiting showdown, returning a new hand with winnings
 * applied and status `settled` (docs/BETTING-ENGINE.md §5).
 *
 * Side pots are derived from each player's committedTotal. For every pot:
 * - an uncontested pot (a single eligible seat) auto-awards to that seat with
 *   no human declaration;
 * - a contested pot uses `declarations[i]` (aligned with the pots returned by
 *   `calculateSidePotsForPlayers`) — the banker's chosen winners (mode A) or
 *   the banker-confirmed claims (mode B).
 *
 * Both winner modes funnel through here: this is the single chip-moving step,
 * so callers must only invoke it after the banker confirms (mode B's "no chips
 * move until confirmation"). Authorization that the caller is the banker is an
 * application-layer concern, not part of this pure function.
 */
export function settleHand(
  hand: Hand,
  declarations: readonly PotDeclaration[] = [],
): SettlementResult {
  if (hand.status !== 'awaiting_showdown') {
    throw new InvalidSettlementError(
      `hand must be awaiting showdown to settle (status: ${hand.status})`,
    );
  }

  const pots = calculateSidePotsForPlayers(hand.players);
  const payouts = new Map<number, number>();

  pots.forEach((pot, i) => {
    if (pot.eligibleSeats.length === 0) {
      // No eligible winner — uncalled folded chips. Should not occur with
      // well-formed input (the engine returns uncalled bets earlier).
      throw new InvalidSettlementError(`pot ${i} has no eligible seats`);
    }

    let winners: readonly number[];
    if (pot.eligibleSeats.length === 1) {
      winners = pot.eligibleSeats; // uncontested: auto-win, no declaration
    } else {
      const declared = declarations[i];
      if (declared === undefined || declared.length === 0) {
        throw new InvalidSettlementError(
          `contested pot ${i} needs a winner declaration`,
        );
      }
      winners = declared;
    }

    for (const [seat, amount] of distributePot(pot, winners, hand.buttonSeat)) {
      payouts.set(seat, (payouts.get(seat) ?? 0) + amount);
    }
  });

  const players = hand.players.map((p) => {
    const won = payouts.get(p.seat) ?? 0;
    return won > 0 ? { ...p, stack: p.stack + won } : p;
  });

  const settledHand: Hand = {
    ...hand,
    players,
    pots,
    status: 'settled',
    actingSeat: null,
    actionDeadline: null,
  };

  return { hand: settledHand, pots, payouts };
}

/**
 * Translates the players' player-showdown claims (mode B,
 * docs/BETTING-ENGINE.md §5) into the {@link PotDeclaration}[] that
 * {@link settleHand} already consumes, so the banker-confirm path reuses
 * `settleHand` UNCHANGED. There is deliberately no second award path and no
 * second shape: this returns byte-for-byte what `settleHand` consumes and what
 * mode A already produces, so `settleHand` stays the sole chip-mover — the
 * end-of-game net / zero-sum invariants (task 6.2) depend on that.
 *
 * Side pots are derived from the SAME `calculateSidePotsForPlayers(hand.players)`
 * call `settleHand` uses, so the result is DENSE and positional: index `i` is
 * pot `i`, and `length` always equals the pot count (no holes). For each pot the
 * winners are its eligible seats whose player claimed `'win'` — eligibility is
 * already encoded in `eligibleSeats` (the side-pot calculator excludes folded /
 * sitting-out seats), so a claimant only ever wins pots they are eligible for,
 * and `'muck'` / not-yet-claimed seats are never listed.
 *
 * This helper NEVER moves chips and NEVER divides a pot: when several eligible
 * seats claim `'win'` on one pot it lists ALL of them and leaves the split —
 * including the odd-chip rule — to `settleHand`.
 *
 * A pot with no eligible `'win'` claim (everyone mucked, or nobody has claimed
 * yet) is `[]` at its index — never a hole, never a placeholder for "done". That
 * is exactly how `settleHand` reads "no winners for this pot": a contested pot
 * with `[]` is rejected on confirm (not yet confirmable), an uncontested pot
 * ignores it and auto-awards. So the PR2 banker-confirm completeness gate is just
 * a positional "every contested pot has a non-empty entry" check; it is not
 * enforced here.
 */
export function claimsToDeclarations(hand: Hand): readonly PotDeclaration[] {
  const pots = calculateSidePotsForPlayers(hand.players);
  // Dense + positional by construction: one entry per pot (possibly []), so the
  // result aligns with the pot list settleHand recomputes the same way.
  return pots.map((pot) =>
    pot.eligibleSeats.filter((seat) => getPlayer(hand, seat)?.claim === 'win'),
  );
}

export interface PlayerLedger {
  readonly seat: number;
  /** Chips the player holds at the end of the game. */
  readonly currentChips: number;
  /** Total chips the player bought in over the game. */
  readonly totalBuyIn: number;
}

export interface NetResult {
  readonly seat: number;
  /** Positive = net win, negative = net loss. */
  readonly net: number;
}

export interface NetSettlement {
  readonly nets: readonly NetResult[];
  /** Rake removed from play (0 when disabled). */
  readonly rake: number;
}

/**
 * Computes end-of-game net results: `net = currentChips - totalBuyIn` per
 * player (docs/BETTING-ENGINE.md §5). The game is zero-sum: the sum of nets
 * must equal `-rake` (chips only leave play as rake). Throws
 * {@link InvalidSettlementError} if that invariant is violated.
 */
export function computeNetSettlement(
  ledgers: readonly PlayerLedger[],
  rake = 0,
): NetSettlement {
  Chips.of(rake); // rake must be a non-negative integer

  const nets = ledgers.map((l) => {
    Chips.of(l.currentChips);
    Chips.of(l.totalBuyIn);
    return { seat: l.seat, net: l.currentChips - l.totalBuyIn };
  });

  const sum = nets.reduce((acc, n) => acc + n.net, 0);
  if (sum !== -rake) {
    throw new InvalidSettlementError(
      `not zero-sum: net total ${sum} should equal -rake (${-rake})`,
    );
  }

  return { nets, rake };
}
