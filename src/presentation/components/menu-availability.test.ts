import { describe, expect, it } from 'vitest';
import { deriveMenuItems, type MenuInput } from './menu-availability';

// A seated, sat-in, non-banker player in an idle room with no requests. Each
// test overrides only the fields it exercises.
const BASE: MenuInput = {
  seated: true,
  sittingOut: false,
  isBanker: false,
  handInPlay: false,
  gameInPlay: false,
  handSettled: false,
  hasOwnRequest: false,
  requestCount: 0,
  pending: false,
};

const make = (
  over: Partial<MenuInput> = {},
): ReturnType<typeof deriveMenuItems> => deriveMenuItems({ ...BASE, ...over });

describe('deriveMenuItems', () => {
  it('hides the menu entirely for a non-seated, non-banker watcher', () => {
    const m = make({ seated: false });
    expect(m.hasAny).toBe(false);
    expect(m.sitOut.show).toBe(false);
    expect(m.sitIn.show).toBe(false);
    expect(m.leave.show).toBe(false);
    expect(m.requestChips.show).toBe(false);
    expect(m.startHand.show).toBe(false);
    expect(m.requestQueue.show).toBe(false);
  });

  it('offers sit out (not sit in) for a seated, sat-in player', () => {
    const m = make();
    expect(m.hasAny).toBe(true);
    expect(m.sitOut.show).toBe(true);
    expect(m.sitIn.show).toBe(false);
    expect(m.leave.show).toBe(true);
    expect(m.requestChips.show).toBe(true);
    expect(m.ownRequestPending).toBe(false);
  });

  it('swaps to sit in when the player is sitting out', () => {
    const m = make({ sittingOut: true });
    expect(m.sitIn.show).toBe(true);
    expect(m.sitOut.show).toBe(false);
  });

  it('blocks leave during a live hand with a reason', () => {
    const m = make({ handInPlay: true });
    expect(m.leave.show).toBe(true);
    expect(m.leave.disabled).toBe(true);
    expect(m.leave.reason).toBe('You cannot leave during a hand');
  });

  it('blocks the banker from leaving mid-game with a banker-specific reason', () => {
    const m = make({ isBanker: true, gameInPlay: true });
    expect(m.leave.disabled).toBe(true);
    expect(m.leave.reason).toBe('The banker cannot leave mid-game');
  });

  it('leaves the banker reason when blocked mid-hand too (matches 4.14 guard)', () => {
    const m = make({ isBanker: true, handInPlay: true, gameInPlay: true });
    expect(m.leave.disabled).toBe(true);
    expect(m.leave.reason).toBe('The banker cannot leave mid-game');
  });

  it('allows leave when idle (no hand, no running game)', () => {
    const m = make();
    expect(m.leave.disabled).toBe(false);
    expect(m.leave.reason).toBeUndefined();
  });

  it('disables every one-shot item while a request is pending', () => {
    const m = make({ pending: true });
    expect(m.sitOut.disabled).toBe(true);
    expect(m.leave.disabled).toBe(true);
    expect(m.requestChips.disabled).toBe(true);
  });

  it('shows a waiting note instead of the request form when one is open', () => {
    const m = make({ hasOwnRequest: true });
    expect(m.requestChips.show).toBe(false);
    expect(m.ownRequestPending).toBe(true);
  });

  it('labels start hand for the banker when no hand is in play', () => {
    const m = make({ isBanker: true });
    expect(m.startHand.show).toBe(true);
    expect(m.startHand.label).toBe('Start hand');
  });

  it('reads "Start next hand" once a hand has settled', () => {
    const m = make({ isBanker: true, handSettled: true });
    expect(m.startHand.show).toBe(true);
    expect(m.startHand.label).toBe('Start next hand');
  });

  it('hides start hand while a hand is in play', () => {
    const m = make({ isBanker: true, handInPlay: true });
    expect(m.startHand.show).toBe(false);
  });

  it('never offers start hand or the queue to a non-banker', () => {
    const m = make({ requestCount: 3 });
    expect(m.startHand.show).toBe(false);
    expect(m.requestQueue.show).toBe(false);
  });

  it('shows the approve/deny queue only when the banker has requests', () => {
    expect(make({ isBanker: true, requestCount: 0 }).requestQueue.show).toBe(
      false,
    );
    expect(make({ isBanker: true, requestCount: 2 }).requestQueue.show).toBe(
      true,
    );
  });

  it('offers end game to the banker only while a game is in play', () => {
    expect(make({ isBanker: true, gameInPlay: true }).endGame.show).toBe(true);
    // No running game yet → nothing to end.
    expect(make({ isBanker: true, gameInPlay: false }).endGame.show).toBe(
      false,
    );
    // Never offered to a non-banker, even mid-game.
    expect(make({ gameInPlay: true }).endGame.show).toBe(false);
  });

  it('disables end game during a live hand with a "settle the hand first" reason', () => {
    const m = make({ isBanker: true, gameInPlay: true, handInPlay: true });
    expect(m.endGame.show).toBe(true);
    expect(m.endGame.disabled).toBe(true);
    expect(m.endGame.reason).toBe('Settle the hand first');
  });

  it('enables end game between hands (no live hand) with no reason', () => {
    const m = make({ isBanker: true, gameInPlay: true });
    expect(m.endGame.disabled).toBe(false);
    expect(m.endGame.reason).toBeUndefined();
  });

  it('disables end game while a request is pending', () => {
    const m = make({ isBanker: true, gameInPlay: true, pending: true });
    expect(m.endGame.disabled).toBe(true);
  });

  it('offers reset hand to the banker only while a hand is in play (6.6)', () => {
    expect(make({ isBanker: true, handInPlay: true }).resetHand.show).toBe(
      true,
    );
    // No live hand → nothing to reset.
    expect(make({ isBanker: true, handInPlay: false }).resetHand.show).toBe(
      false,
    );
    // Never offered to a non-banker, even mid-hand.
    expect(make({ handInPlay: true }).resetHand.show).toBe(false);
  });

  it('disables reset hand while a request is pending', () => {
    const m = make({ isBanker: true, handInPlay: true, pending: true });
    expect(m.resetHand.show).toBe(true);
    expect(m.resetHand.disabled).toBe(true);
  });

  it('offers adjust chips to the banker only between hands (6.7)', () => {
    // Between hands (no live hand) → shown.
    expect(make({ isBanker: true, handInPlay: false }).adjustChips.show).toBe(
      true,
    );
    // Mid-hand → hidden (server enforces HandInProgressError too).
    expect(make({ isBanker: true, handInPlay: true }).adjustChips.show).toBe(
      false,
    );
    // Never offered to a non-banker.
    expect(make({ handInPlay: false }).adjustChips.show).toBe(false);
  });

  it('disables adjust chips while a request is pending', () => {
    const m = make({ isBanker: true, handInPlay: false, pending: true });
    expect(m.adjustChips.show).toBe(true);
    expect(m.adjustChips.disabled).toBe(true);
  });

  it('keeps the menu present (hasAny) through phase states for a seated banker', () => {
    // awaiting_street: hand in play, no start-hand, but presence still shows.
    expect(make({ isBanker: true, handInPlay: true }).hasAny).toBe(true);
    // awaiting_showdown is also handInPlay from the menu's perspective.
    expect(
      make({ isBanker: true, handInPlay: true, gameInPlay: true }).hasAny,
    ).toBe(true);
    // settled: start-hand returns.
    expect(make({ isBanker: true, handSettled: true }).startHand.show).toBe(
      true,
    );
  });
});
