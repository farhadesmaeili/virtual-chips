import { describe, expect, it } from 'vitest';
import { createHand, type Hand } from '../entities/hand';
import {
  createPlayerInHand,
  type ClaimChoice,
  type PlayerInHand,
} from '../entities/player-in-hand';
import { claimsToDeclarations } from './settlement';
import { calculateSidePotsForPlayers } from './side-pot';

interface PlayerOpts {
  seat: number;
  committedTotal?: number;
  state?: PlayerInHand['state'];
  claim?: ClaimChoice;
}

// Mirrors settlement.test.ts's builder; seats default to all-in contenders so
// every committed seat is eligible to win unless explicitly folded.
function mkPlayer(o: PlayerOpts): PlayerInHand {
  return {
    ...createPlayerInHand({ seat: o.seat, userId: `u${o.seat}`, stack: 0 }),
    committedTotal: o.committedTotal ?? 100,
    state: o.state ?? 'all_in',
    claim: o.claim,
  };
}

function mkHand(players: PlayerInHand[], overrides: Partial<Hand> = {}): Hand {
  return {
    ...createHand({ id: 'h1', roomId: 'r1', buttonSeat: 0, players }),
    status: 'awaiting_showdown',
    ...overrides,
  };
}

/** The pot count settleHand will see for the same hand — the dense length. */
function potCount(hand: Hand): number {
  return calculateSidePotsForPlayers(hand.players).length;
}

describe('claimsToDeclarations', () => {
  it('lists only seats that claimed win, excluding muck and unclaimed', () => {
    // One contested pot (all three equally committed → eligible [0,1,2]).
    const hand = mkHand([
      mkPlayer({ seat: 0, claim: 'win' }),
      mkPlayer({ seat: 1, claim: 'muck' }),
      mkPlayer({ seat: 2 }), // no claim yet
    ]);
    const result = claimsToDeclarations(hand);
    expect(result).toEqual([[0]]);
    expect(result.length).toBe(potCount(hand));
  });

  it('does not count folded seats even if they carry a win claim', () => {
    // A folded seat is not in any pot's eligibleSeats, so it can never appear.
    const hand = mkHand([
      mkPlayer({ seat: 0, claim: 'win' }),
      mkPlayer({ seat: 1, state: 'folded', claim: 'win' }),
    ]);
    expect(claimsToDeclarations(hand)).toEqual([[0]]);
  });

  it('returns one declaration with a single eligible win claimant on a contested pot', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0, claim: 'win' }),
      mkPlayer({ seat: 1, claim: 'muck' }),
    ]);
    expect(claimsToDeclarations(hand)).toEqual([[0]]);
  });

  it('lists ALL win claimants on one pot without dividing (split deferred to settleHand)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0, claim: 'win' }),
      mkPlayer({ seat: 1, claim: 'win' }),
      mkPlayer({ seat: 2, claim: 'muck' }),
    ]);
    // One pot eligible [0,1,2]; both winners listed, no chip math here.
    expect(claimsToDeclarations(hand)).toEqual([[0, 1]]);
  });

  it('respects per-pot eligibility: a claimant only wins pots they are eligible for', () => {
    // Layered commits → main pot [0,1,2], side pot [0,1]. Seat 2 is short.
    const hand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 200, claim: 'win' }),
      mkPlayer({ seat: 1, committedTotal: 200, claim: 'muck' }),
      mkPlayer({ seat: 2, committedTotal: 100, claim: 'win' }),
    ]);
    const result = claimsToDeclarations(hand);
    // Main pot (eligible [0,1,2]): winners [0,2]. Side pot (eligible [0,1]):
    // only seat 0 claimed win (seat 2 is not eligible for the side pot).
    expect(result).toEqual([[0, 2], [0]]);
  });

  it('represents a pot with no eligible win claim as [] at its index (not absent)', () => {
    const hand = mkHand([
      mkPlayer({ seat: 0, claim: 'muck' }),
      mkPlayer({ seat: 1, claim: 'muck' }),
    ]);
    const result = claimsToDeclarations(hand);
    // One pot, no winners → a dense `[[]]`, not an empty array and not a hole.
    expect(result).toEqual([[]]);
    expect(result.length).toBe(potCount(hand));
    expect(result[0]).toEqual([]);
  });

  it('with partial claims, the unclaimed pot is [] at its index (incomplete by design)', () => {
    // Main pot [0,1,2] has a win (seat 2); side pot [0,1] has no win claim.
    const hand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 200, claim: 'muck' }),
      mkPlayer({ seat: 1, committedTotal: 200, claim: 'muck' }),
      mkPlayer({ seat: 2, committedTotal: 100, claim: 'win' }),
    ]);
    const result = claimsToDeclarations(hand);
    // Claimed main pot keeps its winner; unclaimed side pot is [] (not omitted).
    expect(result).toEqual([[2], []]);
    expect(result.length).toBe(potCount(hand));
    expect(result[1]).toEqual([]);
  });

  it('returns a dense array of [] (one per pot) when no one has claimed anything', () => {
    const hand = mkHand([mkPlayer({ seat: 0 }), mkPlayer({ seat: 1 })]);
    const pots = potCount(hand);
    const result = claimsToDeclarations(hand);
    // Not an empty array: one [] per pot the engine actually produces.
    expect(result.length).toBe(pots);
    expect(result).toEqual(Array.from({ length: pots }, () => []));
  });

  it('is always dense and positional: length === pot count and every entry is an array (no holes)', () => {
    // Two-pot fixture: main [0,1,2], side [0,1]; only some pots are claimed.
    const hand = mkHand([
      mkPlayer({ seat: 0, committedTotal: 200, claim: 'win' }),
      mkPlayer({ seat: 1, committedTotal: 200, claim: 'muck' }),
      mkPlayer({ seat: 2, committedTotal: 100, claim: 'muck' }),
    ]);
    const result = claimsToDeclarations(hand);
    expect(result.length).toBe(potCount(hand));
    // No holes: every index is a real array (Array.prototype.every skips holes,
    // so a sparse array would make this assertion vacuously pass — guard length
    // and `in` too).
    for (let i = 0; i < result.length; i += 1) {
      expect(i in result).toBe(true);
      expect(Array.isArray(result[i])).toBe(true);
    }
  });
});
