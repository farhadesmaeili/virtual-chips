import { describe, expect, it } from 'vitest';
import { createHand, getPlayer, type Hand } from '../entities/hand';
import { createPlayerInHand } from '../entities/player-in-hand';
import { applyAction } from './apply-action';
import { postBlinds } from './blinds';

const SB = 5;
const BB = 10;

/** Builds a fresh, pre-blinds hand with players at the given seats. */
function mkHand(
  seats: readonly { seat: number; stack?: number }[],
  buttonSeat: number,
): Hand {
  const players = seats.map((s) =>
    createPlayerInHand({
      seat: s.seat,
      userId: `u${s.seat}`,
      stack: s.stack ?? 1000,
    }),
  );
  return createHand({ id: 'h1', roomId: 'r1', players, buttonSeat });
}

function seat(hand: Hand, n: number) {
  const p = getPlayer(hand, n);
  if (p === undefined) throw new Error(`no player at seat ${n}`);
  return p;
}

describe('postBlinds — full ring (3+ players)', () => {
  // Seats 0,1,2; button on 0 → SB=seat1, BB=seat2, first actor=seat0 (UTG).
  const hand = postBlinds(
    mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 0),
    SB,
    BB,
  );

  it('posts the small blind left of the button', () => {
    const sb = seat(hand, 1);
    expect(sb.committedThisStreet).toBe(SB);
    expect(sb.committedTotal).toBe(SB);
    expect(sb.stack).toBe(1000 - SB);
  });

  it('posts the big blind next', () => {
    const bb = seat(hand, 2);
    expect(bb.committedThisStreet).toBe(BB);
    expect(bb.committedTotal).toBe(BB);
    expect(bb.stack).toBe(1000 - BB);
  });

  it('sets currentBet and lastRaiseSize to the big blind', () => {
    expect(hand.currentBet).toBe(BB);
    expect(hand.lastRaiseSize).toBe(BB);
  });

  it('leaves the first actor as the seat left of the big blind', () => {
    // With three players the seat left of the BB wraps back to the button.
    expect(hand.actingSeat).toBe(0);
  });

  it('keeps blind posters with the option (hasActedThisStreet = false)', () => {
    expect(seat(hand, 1).hasActedThisStreet).toBe(false);
    expect(seat(hand, 2).hasActedThisStreet).toBe(false);
  });

  it('does not touch non-blind players', () => {
    const utg = seat(hand, 0);
    expect(utg.committedThisStreet).toBe(0);
    expect(utg.stack).toBe(1000);
  });
});

describe('postBlinds — first actor left of the big blind (4 players)', () => {
  it('puts the first actor left of the BB, not the button', () => {
    // Seats 0..3, button 0 → SB=1, BB=2, first actor=3.
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }], 0),
      SB,
      BB,
    );
    expect(seat(hand, 1).committedThisStreet).toBe(SB);
    expect(seat(hand, 2).committedThisStreet).toBe(BB);
    expect(hand.actingSeat).toBe(3);
  });

  it('wraps blind seats clockwise when the button is the highest seat', () => {
    // Seats 0,1,2, button 2 → SB=0, BB=1, first actor=2.
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 2),
      SB,
      BB,
    );
    expect(seat(hand, 0).committedThisStreet).toBe(SB);
    expect(seat(hand, 1).committedThisStreet).toBe(BB);
    expect(hand.actingSeat).toBe(2);
  });
});

describe('postBlinds — heads-up (2 players)', () => {
  // Button posts SB and acts first preflop; the other posts BB.
  const hand = postBlinds(mkHand([{ seat: 0 }, { seat: 1 }], 0), SB, BB);

  it('makes the button post the small blind', () => {
    expect(seat(hand, 0).committedThisStreet).toBe(SB);
  });

  it('makes the other player post the big blind', () => {
    expect(seat(hand, 1).committedThisStreet).toBe(BB);
  });

  it('lets the button (small blind) act first preflop', () => {
    expect(hand.actingSeat).toBe(0);
  });

  it('sets currentBet to the big blind', () => {
    expect(hand.currentBet).toBe(BB);
    expect(hand.lastRaiseSize).toBe(BB);
  });
});

describe('postBlinds — short-stack all-in blind', () => {
  it('puts a short big blind all-in for its whole stack', () => {
    // Seat 2 (the BB) only has 6 chips, less than the BB of 10.
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2, stack: 6 }], 0),
      SB,
      BB,
    );
    const bb = seat(hand, 2);
    expect(bb.committedThisStreet).toBe(6);
    expect(bb.stack).toBe(0);
    expect(bb.state).toBe('all_in');
    // The bet to match stays the nominal big blind despite the short post.
    expect(hand.currentBet).toBe(BB);
    expect(hand.lastRaiseSize).toBe(BB);
  });

  it('puts a short small blind all-in but keeps the nominal big blind', () => {
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1, stack: 3 }, { seat: 2 }], 0),
      SB,
      BB,
    );
    const sb = seat(hand, 1);
    expect(sb.committedThisStreet).toBe(3);
    expect(sb.state).toBe('all_in');
    expect(hand.currentBet).toBe(BB);
  });

  it('skips a heads-up button that went all-in posting the small blind', () => {
    // Heads-up button with only 3 chips posts an all-in SB and cannot act.
    const hand = postBlinds(
      mkHand([{ seat: 0, stack: 3 }, { seat: 1 }], 0),
      SB,
      BB,
    );
    expect(seat(hand, 0).state).toBe('all_in');
    // No active seat can act first (the lone other player is the BB and is
    // already matched-or-above) → the first actor falls through to seat 1.
    expect(hand.actingSeat).toBe(1);
  });
});

describe('postBlinds — preflop betting rules', () => {
  it('makes the minimum preflop raise 2× the big blind', () => {
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 0),
      SB,
      BB,
    );
    // The button (UTG) is first to act. A raise below 2×BB is rejected.
    expect(() =>
      applyAction(hand, { seat: 0, type: 'RAISE', amount: BB + 1 }, BB),
    ).toThrow();
    // A raise to exactly 2×BB is allowed.
    const raised = applyAction(
      hand,
      { seat: 0, type: 'RAISE', amount: 2 * BB },
      BB,
    );
    expect(raised.currentBet).toBe(2 * BB);
    expect(seat(raised, 0).committedThisStreet).toBe(2 * BB);
  });

  it('gives the big blind the option to raise after the action is called around', () => {
    let hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 0),
      SB,
      BB,
    );
    // UTG (button, seat 0) calls the big blind. applyAction applies the chips
    // but does not pick the next seat — the street machine does that.
    hand = applyAction(hand, { seat: 0, type: 'CALL' }, BB);
    expect(seat(hand, 0).committedThisStreet).toBe(BB);
    // Simulate the street machine handing action to the SB, who completes.
    hand = { ...hand, actingSeat: 1 };
    hand = applyAction(hand, { seat: 1, type: 'CALL' }, BB);
    // Action is now on the big blind, who is matched but has not acted: the
    // option stands, so they may still raise.
    hand = { ...hand, actingSeat: 2 };
    const raised = applyAction(
      hand,
      { seat: 2, type: 'RAISE', amount: 2 * BB },
      BB,
    );
    expect(raised.currentBet).toBe(2 * BB);
    expect(seat(raised, 2).committedThisStreet).toBe(2 * BB);
  });

  it('lets the big blind check their option when no one raised', () => {
    const hand = postBlinds(
      mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 0),
      SB,
      BB,
    );
    // Action on the BB while matched: a CHECK is legal (toCall == 0).
    const bbToAct = { ...hand, actingSeat: 2 };
    const checked = applyAction(bbToAct, { seat: 2, type: 'CHECK' }, BB);
    expect(seat(checked, 2).hasActedThisStreet).toBe(true);
  });
});

describe('postBlinds — purity & guards', () => {
  it('does not mutate the input hand', () => {
    const base = mkHand([{ seat: 0 }, { seat: 1 }, { seat: 2 }], 0);
    const snapshot = JSON.stringify(base);
    postBlinds(base, SB, BB);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('throws with fewer than two active players', () => {
    const lone = mkHand([{ seat: 0 }], 0);
    expect(() => postBlinds(lone, SB, BB)).toThrow();
  });
});
