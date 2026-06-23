import { describe, expect, it } from 'vitest';
import type { PublicHandState } from '@/presentation/lib/socket-events';
import { turnBannerLabelKind } from './turn-banner-label';

function mkHand(overrides: Partial<PublicHandState> = {}): PublicHandState {
  return {
    id: 'h1',
    roomId: 'r1',
    street: 0,
    buttonSeat: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    actingSeat: null,
    actionDeadline: null,
    status: 'betting',
    players: [],
    pots: [],
    totalPot: 0,
    ...overrides,
  };
}

describe('turnBannerLabelKind', () => {
  it('labels a live turn as your-turn for the hero, to-act for others', () => {
    const hand = mkHand({ status: 'betting', actingSeat: 2 });
    expect(turnBannerLabelKind(hand, 2)).toEqual({ kind: 'your-turn' });
    expect(turnBannerLabelKind(hand, 0)).toEqual({ kind: 'to-act', seat: 2 });
  });

  it('labels awaiting_street as deal-next with the next street index', () => {
    const hand = mkHand({ status: 'awaiting_street', street: 1 });
    expect(turnBannerLabelKind(hand, 0)).toEqual({
      kind: 'deal-next',
      street: 2,
    });
  });

  it('labels awaiting_showdown as settle', () => {
    const hand = mkHand({ status: 'awaiting_showdown' });
    expect(turnBannerLabelKind(hand, 0)).toEqual({ kind: 'settle' });
  });

  it('returns none for no hand, a settled hand, or an unexpected betting/no-actor state', () => {
    expect(turnBannerLabelKind(null, 0)).toEqual({ kind: 'none' });
    expect(turnBannerLabelKind(mkHand({ status: 'settled' }), 0)).toEqual({
      kind: 'none',
    });
    // betting with no acting seat must not mislabel as "settle".
    expect(
      turnBannerLabelKind(mkHand({ status: 'betting', actingSeat: null }), 0),
    ).toEqual({ kind: 'none' });
  });
});
