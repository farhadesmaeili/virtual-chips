import { describe, expect, it } from 'vitest';
import { createHand, type Hand } from '../entities/hand';
import {
  createPlayerInHand,
  type PlayerInHand,
} from '../entities/player-in-hand';
import { advanceHand, dealNextStreet } from './street';
import { calculateSidePotsForPlayers } from './side-pot';
import { settleHand } from './settlement';
import { returnUncalledBet } from './uncalled';

interface PlayerOpts {
  seat: number;
  stack?: number;
  committedTotal?: number;
  /** Defaults to committedTotal (single-street scenarios). */
  committedThisStreet?: number;
  state?: PlayerInHand['state'];
}

function mkPlayer(o: PlayerOpts): PlayerInHand {
  const committedTotal = o.committedTotal ?? 0;
  return {
    ...createPlayerInHand({
      seat: o.seat,
      userId: `u${o.seat}`,
      stack: o.stack ?? 0,
    }),
    committedTotal,
    committedThisStreet: o.committedThisStreet ?? committedTotal,
    state: o.state ?? 'active',
  };
}

function mkHand(players: PlayerInHand[], overrides: Partial<Hand> = {}): Hand {
  const maxThisStreet = Math.max(
    0,
    ...players.map((p) => p.committedThisStreet),
  );
  return {
    ...createHand({ id: 'h1', roomId: 'r1', buttonSeat: 0, players }),
    currentBet: maxThisStreet,
    status: 'betting',
    ...overrides,
  };
}

/** Total chips in play: behind every stack plus everything committed. */
function chipsInPlay(hand: Hand): number {
  return hand.players.reduce((s, p) => s + p.stack + p.committedTotal, 0);
}

function potOf(players: readonly PlayerInHand[]): number {
  return calculateSidePotsForPlayers(players).reduce(
    (s, pot) => s + pot.amount,
    0,
  );
}

describe('returnUncalledBet', () => {
  it('returns the uncalled excess to a lone over-committer (heads-up)', () => {
    // B bets 1000 from a 1500 stack; C calls all-in for 800. B's 200 returns.
    const b = mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 });
    const c = mkPlayer({
      seat: 2,
      stack: 0,
      committedTotal: 800,
      state: 'all_in',
    });
    const result = returnUncalledBet(mkHand([b, c]));

    const nb = result.players.find((p) => p.seat === 1)!;
    expect(nb.stack).toBe(700); // 500 + 200 returned
    expect(nb.committedTotal).toBe(800);
    expect(nb.committedThisStreet).toBe(800);
    expect(result.currentBet).toBe(800);

    // No spurious lone-eligible side pot — one contested pot of 1600.
    const pots = calculateSidePotsForPlayers(result.players);
    expect(pots).toHaveLength(1);
    expect(pots[0]).toEqual({ amount: 1600, eligibleSeats: [1, 2] });
  });

  it('returns the hand unchanged when the top is tied (nothing uncalled)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 1, committedTotal: 1000 }),
      mkPlayer({ seat: 2, committedTotal: 1000 }),
    ]);
    expect(returnUncalledBet(hand)).toBe(hand); // byte-identical (same ref)
  });

  it('refunds only the top seat; short all-ins below it are untouched', () => {
    const b = mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 });
    const c = mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' });
    const a = mkPlayer({ seat: 3, committedTotal: 300, state: 'all_in' });
    const result = returnUncalledBet(mkHand([b, c, a]));

    // U = 1000 - 800 = 200 to B only.
    expect(result.players.find((p) => p.seat === 1)!.stack).toBe(700);
    // The short all-ins are the exact same objects (never refunded).
    expect(result.players.find((p) => p.seat === 2)).toBe(c);
    expect(result.players.find((p) => p.seat === 3)).toBe(a);
  });

  it('handles multi-all-in side pots with an uncalled excess on top', () => {
    // A all-in 100, B all-in 60, D bets 200 (only A,B can call). D over-by 100.
    const a = mkPlayer({ seat: 1, committedTotal: 100, state: 'all_in' });
    const b = mkPlayer({ seat: 2, committedTotal: 60, state: 'all_in' });
    const d = mkPlayer({ seat: 3, stack: 300, committedTotal: 200 });
    const result = returnUncalledBet(mkHand([a, b, d]));

    const nd = result.players.find((p) => p.seat === 3)!;
    expect(nd.committedTotal).toBe(100); // 200 - 100 uncalled
    expect(nd.stack).toBe(400); // 300 + 100 returned

    // Layers: {1,2,3}=180 then {1,3}=80 — no lone {3} pot, total 260 (was 360).
    const pots = calculateSidePotsForPlayers(result.players);
    expect(pots).toContainEqual({ amount: 180, eligibleSeats: [1, 2, 3] });
    expect(pots).toContainEqual({ amount: 80, eligibleSeats: [1, 3] });
    expect(potOf(result.players)).toBe(260);
  });

  it('caps the return by a FOLDED contributor (U=200, not 500)', () => {
    // B 1000 active, A 800 FOLDED, C 500 all-in. Second-highest across ALL
    // seats is the folded A=800, so only 200 is uncalled — not 1000-500=500.
    const b = mkPlayer({
      seat: 1,
      stack: 0,
      committedTotal: 1000,
      state: 'all_in',
    });
    const a = mkPlayer({ seat: 2, committedTotal: 800, state: 'folded' });
    const c = mkPlayer({ seat: 3, committedTotal: 500, state: 'all_in' });
    const result = returnUncalledBet(
      mkHand([b, a, c], { status: 'awaiting_showdown', buttonSeat: 3 }),
    );

    const nb = result.players.find((p) => p.seat === 1)!;
    expect(nb.committedTotal).toBe(800); // 1000 - 200, NOT 1000 - 500
    expect(nb.stack).toBe(200);

    // No eligible-less pot is produced, and settlement does not throw.
    const pots = calculateSidePotsForPlayers(result.players);
    for (const pot of pots) expect(pot.eligibleSeats.length).toBeGreaterThan(0);
    // Contested {1,3} pot declared to B; the lone-{1} layer auto-awards.
    expect(() => settleHand(result, [[1]])).not.toThrow();
  });

  it('flips a refunded all-in seat back to active', () => {
    // B is all-in for its whole 1000 stack; C calls all-in 800. B gets 200 back.
    const b = mkPlayer({
      seat: 1,
      stack: 0,
      committedTotal: 1000,
      state: 'all_in',
    });
    const c = mkPlayer({
      seat: 2,
      stack: 0,
      committedTotal: 800,
      state: 'all_in',
    });
    const result = returnUncalledBet(mkHand([b, c]));

    const nb = result.players.find((p) => p.seat === 1)!;
    expect(nb.state).toBe('active');
    expect(nb.stack).toBe(200);
    expect(nb.committedTotal).toBe(800);
  });

  it('is a no-op when every contributor matched (3-way tie)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 1, committedTotal: 500 }),
      mkPlayer({ seat: 2, committedTotal: 500 }),
      mkPlayer({ seat: 3, committedTotal: 500 }),
    ]);
    expect(returnUncalledBet(hand)).toBe(hand);
  });

  it('is idempotent: a second call is a byte-identical no-op', () => {
    const hand = mkHand([
      mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 }),
      mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
    ]);
    const once = returnUncalledBet(hand);
    const twice = returnUncalledBet(once);
    expect(twice).toBe(once);
  });

  it('returns nothing when the unique top seat is folded (forfeited chips)', () => {
    // Pathological: a folded seat sits above everyone. Folded chips are dead,
    // never refunded — the hand is unchanged.
    const hand = mkHand([
      mkPlayer({ seat: 1, committedTotal: 1000, state: 'folded' }),
      mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
    ]);
    expect(returnUncalledBet(hand)).toBe(hand);
  });

  describe('invariants', () => {
    it('conserves total chips in play across the return', () => {
      const hand = mkHand([
        mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 }),
        mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
      ]);
      const before = chipsInPlay(hand);
      const after = chipsInPlay(returnUncalledBet(hand));
      expect(after).toBe(before);
    });

    it('makes the live-projection pots equal the post-settlement pots', () => {
      // Close the (final-street) betting through the real transition, then
      // settle: both read the same already-corrected committedTotal.
      const closed = advanceHand(
        mkHand(
          [
            mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 }),
            mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
          ],
          { street: 3 },
        ),
        { minBet: 20, streetCount: 4 },
      );
      expect(closed.status).toBe('awaiting_showdown');

      const livePots = calculateSidePotsForPlayers(closed.players);
      // The single 1600 pot is contested (two eligible) → declare seat 1.
      const settled = settleHand(closed, [[1]]);
      expect(livePots).toEqual(settled.pots);
      expect(potOf(closed.players)).toBe(1600);
    });
  });
});

describe('returnUncalledBet — wired into street close', () => {
  it('returns the uncalled bet at street close via advanceHand', () => {
    // Lone active player (B) owes nothing after C called all-in short.
    const hand = mkHand(
      [
        mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 }),
        mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
      ],
      { street: 0, actingSeat: 1 },
    );
    const result = advanceHand(hand, { minBet: 20, streetCount: 4 });

    expect(result.status).toBe('awaiting_street'); // not last street → pause
    const nb = result.players.find((p) => p.seat === 1)!;
    expect(nb.stack).toBe(700);
    expect(nb.committedTotal).toBe(800);
    expect(result.currentBet).toBe(800);
  });

  it('returns the uncalled bet once across a multi-street all-in run-out', () => {
    const hand = mkHand(
      [
        mkPlayer({ seat: 1, stack: 500, committedTotal: 1000 }),
        mkPlayer({ seat: 2, committedTotal: 800, state: 'all_in' }),
      ],
      { street: 0, actingSeat: 1 },
    );
    // Street 0 closes: uncalled 200 returned.
    const afterFlop = advanceHand(hand, { minBet: 20, streetCount: 4 });
    expect(afterFlop.players.find((p) => p.seat === 1)!.committedTotal).toBe(
      800,
    );

    // Banker deals the next street; the run-out pauses again but does NOT
    // re-return (committedTotal already balanced).
    const afterTurn = dealNextStreet(afterFlop, { minBet: 20, streetCount: 4 });
    expect(afterTurn.status).toBe('awaiting_street');
    expect(afterTurn.street).toBe(1);
    const nb = afterTurn.players.find((p) => p.seat === 1)!;
    expect(nb.committedTotal).toBe(800); // unchanged — not refunded twice
    expect(nb.stack).toBe(700);
  });
});
