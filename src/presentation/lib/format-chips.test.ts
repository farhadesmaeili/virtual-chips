import { describe, expect, it } from 'vitest';
import { formatStackChips } from './format-chips';

describe('formatStackChips', () => {
  // Below the 100K threshold: exact, grouped thousands — precision matters here.
  it('renders stacks under 100K exact and grouped', () => {
    expect(formatStackChips(0)).toBe('0');
    expect(formatStackChips(999)).toBe('999');
    expect(formatStackChips(9_999)).toBe('9,999');
    expect(formatStackChips(99_999)).toBe('99,999');
  });

  // At/above the threshold: compact notation. These strings are whatever Intl
  // emits (uppercase K/M, rounded to one fraction digit) — locked here so a
  // formatting drift is caught.
  it('renders stacks at/above 100K in compact notation', () => {
    expect(formatStackChips(100_000)).toBe('100K');
    expect(formatStackChips(999_999)).toBe('1M');
    expect(formatStackChips(1_000_000)).toBe('1M');
    expect(formatStackChips(1_234_567)).toBe('1.2M');
    expect(formatStackChips(12_345_678)).toBe('12.3M');
  });

  // Defensive: non-finite / negative never produce a misleading compact string.
  it('falls back to plain grouping for negative and non-finite values', () => {
    expect(formatStackChips(-1)).toBe('-1');
    expect(formatStackChips(-1_000_000)).toBe('-1,000,000');
    expect(formatStackChips(Number.NaN)).toBe('NaN');
    expect(formatStackChips(Number.POSITIVE_INFINITY)).toBe('∞');
  });
});
