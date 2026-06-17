import { describe, expect, it } from 'vitest';
import { chipColor, topDenomination } from './chip-denominations';

describe('topDenomination', () => {
  it('rounds down to the largest denomination not exceeding the amount', () => {
    expect(topDenomination(0)).toBe(1);
    expect(topDenomination(3)).toBe(1);
    expect(topDenomination(5)).toBe(5);
    expect(topDenomination(24)).toBe(5);
    expect(topDenomination(25)).toBe(25);
    expect(topDenomination(99)).toBe(25);
    expect(topDenomination(100)).toBe(100);
    expect(topDenomination(499)).toBe(100);
    expect(topDenomination(500)).toBe(500);
    expect(topDenomination(1000)).toBe(1000);
    expect(topDenomination(7500)).toBe(1000);
  });
});

describe('chipColor', () => {
  it('maps a denomination to its CSS variable', () => {
    expect(chipColor(25)).toBe('var(--vc-chip-25)');
    expect(chipColor(1000)).toBe('var(--vc-chip-1000)');
  });
});
