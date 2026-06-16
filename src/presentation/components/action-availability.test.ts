import { describe, expect, it } from 'vitest';
import { deriveActions } from './action-availability';
import type {
  PublicHandPlayer,
  PublicHandState,
} from '@/presentation/lib/socket-events';

function player(p: Partial<PublicHandPlayer> = {}): PublicHandPlayer {
  return {
    seat: 1,
    stack: 1000,
    committedThisStreet: 0,
    committedTotal: 0,
    state: 'active',
    hasActedThisStreet: false,
    ...p,
  };
}

function hand(h: Partial<PublicHandState> = {}): PublicHandState {
  return {
    id: 'h',
    roomId: 'r',
    street: 1,
    buttonSeat: 1,
    currentBet: 0,
    lastRaiseSize: 0,
    actingSeat: 1,
    actionDeadline: null,
    status: 'betting',
    players: [player()],
    pots: [],
    totalPot: 0,
    ...h,
  };
}

const BB = 20;

describe('deriveActions', () => {
  it('returns no actions when there is no hand', () => {
    expect(deriveActions(null, 1, BB).isHeroTurn).toBe(false);
  });

  it('returns no actions when it is not the hero seat to act', () => {
    const a = deriveActions(hand({ actingSeat: 2 }), 1, BB);
    expect(a.isHeroTurn).toBe(false);
  });

  it('returns no actions when the hand is not betting', () => {
    const a = deriveActions(hand({ status: 'settled' }), 1, BB);
    expect(a.isHeroTurn).toBe(false);
  });

  it('returns no actions when the hero has folded', () => {
    const folded = player({ state: 'folded' });
    const a = deriveActions(hand({ players: [folded] }), 1, BB);
    expect(a.isHeroTurn).toBe(false);
  });

  it('offers check and an opening bet when nothing is owed', () => {
    const a = deriveActions(hand(), 1, BB);
    expect(a.isHeroTurn).toBe(true);
    expect(a.toCall).toBe(0);
    expect(a.canCheck).toBe(true);
    expect(a.canCall).toBe(false);
    expect(a.sizing).toEqual({ mode: 'bet', min: 20, max: 1000, step: 20 });
    expect(a.canAllIn).toBe(true);
  });

  it('does not offer a bet when the stack is below the big blind', () => {
    const short = player({ stack: 10 });
    const a = deriveActions(hand({ players: [short] }), 1, BB);
    expect(a.canCheck).toBe(true);
    expect(a.sizing).toBeNull(); // too short to bet; all-in only
    expect(a.canAllIn).toBe(true);
  });

  it('offers call and a min-raise when facing a bet', () => {
    const players = [player({ committedThisStreet: 0, stack: 1000 })];
    const a = deriveActions(
      hand({ currentBet: 40, lastRaiseSize: 20, players }),
      1,
      BB,
    );
    expect(a.toCall).toBe(40);
    expect(a.canCheck).toBe(false);
    expect(a.canCall).toBe(true);
    // min-raise total = currentBet (40) + lastRaiseSize (20) = 60.
    expect(a.sizing).toEqual({ mode: 'raise', min: 60, max: 1000, step: 20 });
  });

  it('accounts for chips already committed this street in the call', () => {
    const players = [player({ committedThisStreet: 20, stack: 980 })];
    const a = deriveActions(
      hand({ currentBet: 40, lastRaiseSize: 20, players }),
      1,
      BB,
    );
    expect(a.toCall).toBe(20); // 40 - 20 already in
    expect(a.allInTo).toBe(1000); // 20 committed + 980 stack
  });

  it('forbids calling when the stack cannot cover it (all-in only)', () => {
    const players = [player({ committedThisStreet: 0, stack: 25 })];
    const a = deriveActions(
      hand({ currentBet: 40, lastRaiseSize: 20, players }),
      1,
      BB,
    );
    expect(a.canCall).toBe(false);
    expect(a.canAllIn).toBe(true);
    expect(a.sizing).toBeNull(); // cannot afford a full min-raise
  });

  it('forbids a raise that the stack cannot fully fund', () => {
    // currentBet 40, min-raise to 60, but the hero can only reach 50.
    const players = [player({ committedThisStreet: 0, stack: 50 })];
    const a = deriveActions(
      hand({ currentBet: 40, lastRaiseSize: 20, players }),
      1,
      BB,
    );
    expect(a.canCall).toBe(true); // 40 is affordable
    expect(a.sizing).toBeNull(); // but a full raise to 60 is not
  });
});
