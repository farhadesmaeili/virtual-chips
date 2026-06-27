import { describe, expect, it } from 'vitest';
import { endGameSchema, playerClaimSchema } from './schemas';

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
