import { describe, expect, it } from 'vitest';
import { defaultMaxBuyIn, defaultMinBuyIn } from './buy-in-defaults';

describe('defaultMinBuyIn / defaultMaxBuyIn', () => {
  it('derives 10x/20x of the big blind', () => {
    expect(defaultMinBuyIn(2)).toBe(20);
    expect(defaultMaxBuyIn(2)).toBe(40);
    expect(defaultMinBuyIn(20)).toBe(200);
    expect(defaultMaxBuyIn(20)).toBe(400);
  });
});
