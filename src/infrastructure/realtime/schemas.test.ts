import { describe, expect, it } from 'vitest';
import { endGameSchema } from './schemas';

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
