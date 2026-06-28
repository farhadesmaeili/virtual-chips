import { describe, expect, it } from 'vitest';
import {
  buildContenderRoster,
  claimStatusOf,
  deriveConfirmGate,
  isContender,
} from './showdown-claim-model';
import type {
  PlayerState,
  PublicHandPlayer,
  PublicRoomMember,
} from '@/presentation/lib/socket-events';

const player = (
  seat: number,
  over: Partial<PublicHandPlayer> = {},
): PublicHandPlayer => ({
  seat,
  stack: 100,
  committedThisStreet: 0,
  committedTotal: 0,
  state: 'active',
  hasActedThisStreet: false,
  lastAction: null,
  timeExtensionsRemaining: 0,
  ...over,
});

const member = (
  seat: number,
  username: string,
  over: Partial<PublicRoomMember> = {},
): PublicRoomMember => ({
  seat,
  username,
  chips: 0,
  buyInTotal: 0,
  isBanker: false,
  sittingOut: false,
  ...over,
});

describe('isContender', () => {
  // The contender rule is duplicated on the client (claim controls) and the
  // server (record-claim.ts rejects state !== 'active' && state !== 'all_in').
  // A `Record<PlayerState, boolean>` forces every state in the union to be
  // listed: if a new PlayerState is ever added, this object stops compiling, so
  // the two predicates cannot silently drift apart.
  const EXPECTED: Record<PlayerState, boolean> = {
    active: true,
    all_in: true,
    folded: false,
    sitting_out: false,
  };

  it('matches the server contender rule (active || all_in) for every PlayerState', () => {
    for (const [state, expected] of Object.entries(EXPECTED)) {
      expect(isContender(state as PlayerState)).toBe(expected);
    }
  });

  it('treats active and all_in as contenders, everyone else not', () => {
    expect(isContender('active')).toBe(true);
    expect(isContender('all_in')).toBe(true);
    expect(isContender('folded')).toBe(false);
    expect(isContender('sitting_out')).toBe(false);
  });
});

describe('claimStatusOf', () => {
  it('maps win -> claimed, muck -> mucked, undefined -> waiting', () => {
    expect(claimStatusOf('win')).toBe('claimed');
    expect(claimStatusOf('muck')).toBe('mucked');
    expect(claimStatusOf(undefined)).toBe('waiting');
  });
});

describe('buildContenderRoster', () => {
  const members = [member(0, 'alice'), member(1, 'bob'), member(2, 'carol')];

  it('includes only active / all-in players, ordered by seat', () => {
    const players = [
      player(2, { state: 'all_in', claim: 'win' }),
      player(0, { state: 'active' }),
      player(1, { state: 'folded' }),
    ];
    const roster = buildContenderRoster(players, members, null);
    expect(roster.map((r) => r.seat)).toEqual([0, 2]); // folded seat 1 excluded
  });

  it('maps each contender to its claim status', () => {
    const players = [
      player(0, { state: 'active', claim: 'win' }),
      player(1, { state: 'all_in', claim: 'muck' }),
      player(2, { state: 'active' }),
    ];
    const roster = buildContenderRoster(players, members, null);
    expect(roster.find((r) => r.seat === 0)?.status).toBe('claimed');
    expect(roster.find((r) => r.seat === 1)?.status).toBe('mucked');
    expect(roster.find((r) => r.seat === 2)?.status).toBe('waiting');
  });

  it('flags the hero row and resolves names with a Seat <n> fallback', () => {
    const players = [
      player(0, { state: 'active' }),
      player(5, { state: 'active' }),
    ];
    const roster = buildContenderRoster(players, members, 0);
    expect(roster.find((r) => r.seat === 0)?.isHero).toBe(true);
    expect(roster.find((r) => r.seat === 5)?.isHero).toBe(false);
    expect(roster.find((r) => r.seat === 0)?.username).toBe('alice');
    expect(roster.find((r) => r.seat === 5)?.username).toBe('Seat 5'); // no member
  });
});

describe('deriveConfirmGate', () => {
  it('blocks quietly (no reason) while any contender is still waiting', () => {
    const players = [
      player(0, { state: 'active', claim: 'win' }),
      player(1, { state: 'active' }), // not yet acted
    ];
    const gate = deriveConfirmGate(players);
    expect(gate.canConfirm).toBe(false);
    expect(gate.reason).toBeNull();
  });

  it('ignores folded / sitting-out players when checking resolution', () => {
    const players = [
      player(0, { state: 'active', claim: 'win' }),
      player(1, { state: 'folded' }), // no claim, but not a contender
      player(2, { state: 'sitting_out' }),
    ];
    const gate = deriveConfirmGate(players);
    expect(gate.canConfirm).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it('enables confirm once every contender resolved and at least one claimed win', () => {
    const players = [
      player(0, { state: 'active', claim: 'win' }),
      player(1, { state: 'all_in', claim: 'muck' }),
    ];
    const gate = deriveConfirmGate(players);
    expect(gate.canConfirm).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it('blocks with a clear message when all contenders mucked (no winner)', () => {
    const players = [
      player(0, { state: 'active', claim: 'muck' }),
      player(1, { state: 'all_in', claim: 'muck' }),
    ];
    const gate = deriveConfirmGate(players);
    expect(gate.canConfirm).toBe(false);
    expect(gate.reason).toBe('No winner claimed — someone must claim win.');
  });

  it('does not enable confirm when there are no contenders at all', () => {
    const players = [player(0, { state: 'folded' })];
    const gate = deriveConfirmGate(players);
    expect(gate.canConfirm).toBe(false);
  });
});
