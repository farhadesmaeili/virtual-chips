import { describe, expect, it } from 'vitest';
import type {
  HandStatus,
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';
import type { PublicHandPlayer } from '@/presentation/lib/socket-events';
import {
  highlightSeat,
  isHandInPlay,
  seatHandPlayer,
  seatPresenceKey,
} from './table-presence';

function handWith(
  status: HandStatus,
  actingSeat: number | null,
  players: readonly PublicHandPlayer[] = [],
): PublicHandState {
  return {
    id: 'h1',
    roomId: 'r1',
    street: 0,
    buttonSeat: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    actingSeat,
    actionDeadline: null,
    status,
    players,
    pots: [],
    totalPot: 0,
  };
}

function player(overrides: Partial<PublicHandPlayer> = {}): PublicHandPlayer {
  return {
    seat: 0,
    stack: 0,
    committedThisStreet: 0,
    committedTotal: 0,
    state: 'active',
    hasActedThisStreet: false,
    lastAction: null,
    timeExtensionsRemaining: 0,
    ...overrides,
  };
}

function member(overrides: Partial<PublicRoomMember> = {}): PublicRoomMember {
  return {
    seat: 0,
    username: 'Alice',
    chips: 100,
    buyInTotal: 100,
    isBanker: false,
    sittingOut: false,
    ...overrides,
  };
}

describe('highlightSeat', () => {
  it('returns the acting seat while betting', () => {
    expect(highlightSeat(handWith('betting', 3))).toBe(3);
  });

  it('is null with no hand', () => {
    expect(highlightSeat(null)).toBeNull();
    expect(highlightSeat(undefined)).toBeNull();
  });

  it('is null when betting but no one is acting', () => {
    expect(highlightSeat(handWith('betting', null))).toBeNull();
  });

  it('is null in awaiting_street (no pending turn)', () => {
    // Even a stale actingSeat must not light up between streets.
    expect(highlightSeat(handWith('awaiting_street', 2))).toBeNull();
  });

  it('is null in awaiting_showdown', () => {
    expect(highlightSeat(handWith('awaiting_showdown', 2))).toBeNull();
  });

  it('is null when settled', () => {
    expect(highlightSeat(handWith('settled', 2))).toBeNull();
  });
});

describe('isHandInPlay', () => {
  it('is true while a hand is being played', () => {
    expect(isHandInPlay(handWith('betting', 2))).toBe(true);
    expect(isHandInPlay(handWith('awaiting_street', null))).toBe(true);
    expect(isHandInPlay(handWith('awaiting_showdown', null))).toBe(true);
  });

  it('is false once the hand is settled', () => {
    expect(isHandInPlay(handWith('settled', null))).toBe(false);
  });

  it('is false when there is no hand', () => {
    expect(isHandInPlay(null)).toBe(false);
    expect(isHandInPlay(undefined)).toBe(false);
  });
});

describe('seatHandPlayer', () => {
  it('returns the seat-matched live player during a betting hand', () => {
    const allIn = player({ seat: 2, state: 'all_in', stack: 0 });
    const hand = handWith('betting', 2, [player({ seat: 0 }), allIn]);
    expect(seatHandPlayer(hand, 2)).toBe(allIn);
  });

  it('is undefined once the hand is settled (seat falls back to member chips)', () => {
    // The settled hand still carries the all-in player as a historical record;
    // the seat must stop reading it so the label/bet chips clear post-settle.
    const allIn = player({ seat: 2, state: 'all_in', stack: 0 });
    const hand = handWith('settled', null, [allIn]);
    expect(seatHandPlayer(hand, 2)).toBeUndefined();
  });

  it('is undefined when there is no hand', () => {
    expect(seatHandPlayer(null, 2)).toBeUndefined();
    expect(seatHandPlayer(undefined, 2)).toBeUndefined();
  });

  it('is undefined for a seat with no matching live player', () => {
    const hand = handWith('betting', 0, [player({ seat: 0 })]);
    expect(seatHandPlayer(hand, 5)).toBeUndefined();
  });
});

describe('seatPresenceKey', () => {
  it('marks an open seat distinctly per seat', () => {
    expect(seatPresenceKey(1, undefined)).toBe('1:empty');
    expect(seatPresenceKey(2, undefined)).toBe('2:empty');
    expect(seatPresenceKey(1, undefined)).not.toBe(
      seatPresenceKey(2, undefined),
    );
  });

  it('changes from empty to occupied on join (and back on leave)', () => {
    const empty = seatPresenceKey(4, undefined);
    const occupied = seatPresenceKey(4, member({ seat: 4 }));
    expect(occupied).not.toBe(empty);
  });

  it('keeps the same key when a seated player sits out (no exit)', () => {
    const seated = seatPresenceKey(4, member({ seat: 4, sittingOut: false }));
    const sittingOut = seatPresenceKey(
      4,
      member({ seat: 4, sittingOut: true }),
    );
    expect(sittingOut).toBe(seated);
  });

  it('changes key when a different player takes the seat (swap)', () => {
    const alice = seatPresenceKey(4, member({ seat: 4, username: 'Alice' }));
    const bob = seatPresenceKey(4, member({ seat: 4, username: 'Bob' }));
    expect(bob).not.toBe(alice);
  });

  it('is stable across re-renders for the same occupant', () => {
    const a = seatPresenceKey(4, member({ seat: 4, chips: 100 }));
    const b = seatPresenceKey(4, member({ seat: 4, chips: 250 }));
    expect(a).toBe(b);
  });
});
