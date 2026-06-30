import { describe, expect, it } from 'vitest';
import { MAX_CHIP_TOTAL } from '@/domain/entities';
import {
  adjustChipsSchema,
  chipsRequestSchema,
  endGameSchema,
  playerClaimSchema,
  roomSettingsSchema,
} from './schemas';

describe('roomSettingsSchema buy-in bounds', () => {
  it('accepts positive integer minBuyIn / maxBuyIn', () => {
    expect(
      roomSettingsSchema.safeParse({ minBuyIn: 100, maxBuyIn: 1000 }).success,
    ).toBe(true);
  });

  it('accepts a null maxBuyIn (no maximum)', () => {
    expect(
      roomSettingsSchema.safeParse({ minBuyIn: 100, maxBuyIn: null }).success,
    ).toBe(true);
  });

  it('accepts omitting both (server derives them)', () => {
    expect(roomSettingsSchema.safeParse({ bigBlind: 10 }).success).toBe(true);
  });

  it('rejects a maxBuyIn below the minBuyIn', () => {
    expect(
      roomSettingsSchema.safeParse({ minBuyIn: 1000, maxBuyIn: 100 }).success,
    ).toBe(false);
  });

  it('rejects a non-positive or non-integer minBuyIn', () => {
    expect(roomSettingsSchema.safeParse({ minBuyIn: 0 }).success).toBe(false);
    expect(roomSettingsSchema.safeParse({ minBuyIn: 1.5 }).success).toBe(false);
  });
});

describe('chip-amount wire caps (technical ceiling)', () => {
  it('chipsRequestSchema accepts an amount exactly at the technical ceiling', () => {
    expect(
      chipsRequestSchema.safeParse({ roomId: 'r1', amount: MAX_CHIP_TOTAL })
        .success,
    ).toBe(true);
  });

  it('chipsRequestSchema rejects an amount one over the technical ceiling', () => {
    expect(
      chipsRequestSchema.safeParse({ roomId: 'r1', amount: MAX_CHIP_TOTAL + 1 })
        .success,
    ).toBe(false);
  });

  it('chipsRequestSchema accepts a buy-in well past the old 100M product cap', () => {
    expect(
      chipsRequestSchema.safeParse({ roomId: 'r1', amount: 1_380_000_000 })
        .success,
    ).toBe(true);
  });

  it('adjustChipsSchema accepts a credit/debit exactly at the technical ceiling', () => {
    expect(
      adjustChipsSchema.safeParse({
        roomId: 'r1',
        seat: 1,
        amount: MAX_CHIP_TOTAL,
      }).success,
    ).toBe(true);
    expect(
      adjustChipsSchema.safeParse({
        roomId: 'r1',
        seat: 1,
        amount: -MAX_CHIP_TOTAL,
      }).success,
    ).toBe(true);
  });

  it('adjustChipsSchema rejects an amount one over the technical ceiling (either sign)', () => {
    expect(
      adjustChipsSchema.safeParse({
        roomId: 'r1',
        seat: 1,
        amount: MAX_CHIP_TOTAL + 1,
      }).success,
    ).toBe(false);
    expect(
      adjustChipsSchema.safeParse({
        roomId: 'r1',
        seat: 1,
        amount: -(MAX_CHIP_TOTAL + 1),
      }).success,
    ).toBe(false);
  });
});

describe('endGameSchema', () => {
  it('accepts a payload with a non-empty roomId', () => {
    expect(endGameSchema.safeParse({ roomId: 'r1' }).success).toBe(true);
  });

  it('rejects a missing or empty roomId', () => {
    expect(endGameSchema.safeParse({}).success).toBe(false);
    expect(endGameSchema.safeParse({ roomId: '' }).success).toBe(false);
  });

  it('rejects a non-string roomId', () => {
    expect(endGameSchema.safeParse({ roomId: 123 }).success).toBe(false);
  });

  it('rejects unknown fields (strict — no smuggled userId)', () => {
    expect(
      endGameSchema.safeParse({ roomId: 'r1', userId: 'attacker' }).success,
    ).toBe(false);
  });
});

describe('playerClaimSchema', () => {
  it("accepts a 'win' or 'muck' claim with a non-empty roomId", () => {
    expect(
      playerClaimSchema.safeParse({ roomId: 'r1', claim: 'win' }).success,
    ).toBe(true);
    expect(
      playerClaimSchema.safeParse({ roomId: 'r1', claim: 'muck' }).success,
    ).toBe(true);
  });

  it('rejects a missing or empty roomId', () => {
    expect(playerClaimSchema.safeParse({ claim: 'win' }).success).toBe(false);
    expect(
      playerClaimSchema.safeParse({ roomId: '', claim: 'win' }).success,
    ).toBe(false);
  });

  it('rejects an unknown claim verb', () => {
    expect(
      playerClaimSchema.safeParse({ roomId: 'r1', claim: 'fold' }).success,
    ).toBe(false);
    expect(
      playerClaimSchema.safeParse({ roomId: 'r1', claim: '' }).success,
    ).toBe(false);
  });

  it('rejects a missing claim', () => {
    expect(playerClaimSchema.safeParse({ roomId: 'r1' }).success).toBe(false);
  });

  it('rejects unknown fields (strict — seat/user never from the payload)', () => {
    expect(
      playerClaimSchema.safeParse({ roomId: 'r1', claim: 'win', seat: 3 })
        .success,
    ).toBe(false);
  });
});
