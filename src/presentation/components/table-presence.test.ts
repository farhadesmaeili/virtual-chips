import { describe, expect, it } from 'vitest';
import type {
  HandStatus,
  PublicHandState,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';
import { highlightSeat, seatPresenceKey } from './table-presence';

function handWith(
  status: HandStatus,
  actingSeat: number | null,
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
    players: [],
    pots: [],
    totalPot: 0,
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
