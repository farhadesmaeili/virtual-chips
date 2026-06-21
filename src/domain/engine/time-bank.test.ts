import { describe, expect, it } from 'vitest';
import { createHand, createPlayerInHand, type Hand } from '@/domain/entities';
import {
  HandNotInBettingError,
  NoTimeBankError,
  NotYourTurnError,
} from '@/domain/errors';
import { extendDeadline, TIME_EXTENSION_MS } from './time-bank';

// A two-handed betting hand: seat 1 is acting, deadline at 1000, default budget.
function bettingHand(over: Partial<Hand> = {}): Hand {
  const base = createHand({
    id: 'h1',
    roomId: 'r1',
    players: [
      createPlayerInHand({ seat: 0, userId: 'a', stack: 100 }),
      createPlayerInHand({ seat: 1, userId: 'b', stack: 100 }),
    ],
    buttonSeat: 0,
  });
  return { ...base, actingSeat: 1, actionDeadline: 1000, ...over };
}

const budgetOf = (hand: Hand, seat: number): number | undefined =>
  hand.players.find((p) => p.seat === seat)?.timeExtensionsRemaining;

describe('extendDeadline', () => {
  it('pushes the deadline out by exactly the extension and decrements the budget', () => {
    const out = extendDeadline(bettingHand(), 1, TIME_EXTENSION_MS, 999_999);
    // Based on the existing deadline (1000), not `now`.
    expect(out.actionDeadline).toBe(1000 + TIME_EXTENSION_MS);
    expect(budgetOf(out, 1)).toBe(1);
  });

  it('only touches the acting seat (others keep their budget)', () => {
    const out = extendDeadline(bettingHand(), 1, TIME_EXTENSION_MS, 0);
    expect(budgetOf(out, 0)).toBe(2);
  });

  it('does not mutate the input hand', () => {
    const hand = bettingHand();
    extendDeadline(hand, 1, TIME_EXTENSION_MS, 0);
    expect(hand.actionDeadline).toBe(1000);
    expect(budgetOf(hand, 1)).toBe(2);
  });

  it('rejects when the seat has no extensions left', () => {
    const drained = bettingHand({
      players: bettingHand().players.map((p) =>
        p.seat === 1 ? { ...p, timeExtensionsRemaining: 0 } : p,
      ),
    });
    expect(() => extendDeadline(drained, 1, TIME_EXTENSION_MS, 0)).toThrow(
      NoTimeBankError,
    );
  });

  it("rejects when it is not the requesting seat's turn", () => {
    expect(() =>
      extendDeadline(bettingHand(), 0, TIME_EXTENSION_MS, 0),
    ).toThrow(NotYourTurnError);
  });

  it.each(['awaiting_street', 'awaiting_showdown', 'settled'] as const)(
    'rejects when the hand is %s (no pending turn)',
    (status) => {
      expect(() =>
        extendDeadline(bettingHand({ status }), 1, TIME_EXTENSION_MS, 0),
      ).toThrow(HandNotInBettingError);
    },
  );

  it('rejects when no seat is acting', () => {
    expect(() =>
      extendDeadline(
        bettingHand({ actingSeat: null }),
        1,
        TIME_EXTENSION_MS,
        0,
      ),
    ).toThrow(HandNotInBettingError);
  });
});
