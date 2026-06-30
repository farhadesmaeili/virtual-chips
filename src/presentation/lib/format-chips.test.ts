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

  // At/above the threshold: pure, truncating compact notation. K keeps up to 2
  // decimals, M up to 3; values round toward zero (never up), and trailing
  // zeros / a bare trailing dot are trimmed.
  it('renders stacks 100K–1M in truncated "K" notation', () => {
    expect(formatStackChips(100_000)).toBe('100K');
    expect(formatStackChips(100_550)).toBe('100.55K');
    expect(formatStackChips(120_450)).toBe('120.45K');
    expect(formatStackChips(999_999)).toBe('999.99K'); // truncates, never 1M
    expect(formatStackChips(999_990)).toBe('999.99K');
    expect(formatStackChips(100_500)).toBe('100.5K'); // trailing zero trimmed
  });

  it('renders stacks at/above 1M in truncated "M" notation', () => {
    expect(formatStackChips(1_000_000)).toBe('1M');
    expect(formatStackChips(1_574_532)).toBe('1.574M');
    expect(formatStackChips(1_500_000)).toBe('1.5M'); // trailing zeros trimmed
    expect(formatStackChips(12_345_678)).toBe('12.345M');
    expect(formatStackChips(12_000_000)).toBe('12M');
    expect(formatStackChips(1_234_567)).toBe('1.234M');
  });

  // Defensive: non-finite / negative never produce a misleading compact string.
  it('falls back to plain grouping for negative and non-finite values', () => {
    expect(formatStackChips(-1)).toBe('-1');
    expect(formatStackChips(-1_000_000)).toBe('-1,000,000');
    expect(formatStackChips(Number.NaN)).toBe('NaN');
    expect(formatStackChips(Number.POSITIVE_INFINITY)).toBe('∞');
  });
});
