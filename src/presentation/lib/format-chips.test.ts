import { describe, expect, it } from 'vitest';
import { formatStackChips, stackHasHiddenPrecision } from './format-chips';

describe('formatStackChips', () => {
  // Below the 100K threshold: exact, grouped thousands — precision matters here.
  it('renders stacks under 100K exact and grouped', () => {
    expect(formatStackChips(0)).toBe('0');
    expect(formatStackChips(999)).toBe('999');
    expect(formatStackChips(9_999)).toBe('9,999');
    expect(formatStackChips(99_999)).toBe('99,999');
  });

  // At/above the threshold: pure, truncating compact notation. Every tier
  // (K/M/B/T) keeps a single decimal; values round toward zero (never up), and a
  // trailing zero / a bare trailing dot is trimmed.
  it('renders stacks 100K–1M in truncated "K" notation', () => {
    expect(formatStackChips(100_000)).toBe('100K');
    expect(formatStackChips(100_550)).toBe('100.5K');
    expect(formatStackChips(120_450)).toBe('120.4K');
    expect(formatStackChips(999_999)).toBe('999.9K'); // truncates, never 1M
    expect(formatStackChips(999_990)).toBe('999.9K');
    expect(formatStackChips(100_500)).toBe('100.5K'); // trailing zero trimmed
  });

  it('renders stacks 1M–1B in truncated "M" notation', () => {
    expect(formatStackChips(1_000_000)).toBe('1M');
    expect(formatStackChips(1_574_532)).toBe('1.5M');
    expect(formatStackChips(1_500_000)).toBe('1.5M'); // trailing zero trimmed
    expect(formatStackChips(12_345_678)).toBe('12.3M');
    expect(formatStackChips(12_000_000)).toBe('12M');
    expect(formatStackChips(1_234_567)).toBe('1.2M');
    expect(formatStackChips(999_999_999)).toBe('999.9M'); // top of tier, never 1B
  });

  it('renders stacks 1B–1T in truncated "B" notation', () => {
    expect(formatStackChips(1_000_000_000)).toBe('1B');
    expect(formatStackChips(1_500_000_000)).toBe('1.5B');
    expect(formatStackChips(2_000_000_000)).toBe('2B'); // trailing zero trimmed
    expect(formatStackChips(999_999_999_999)).toBe('999.9B'); // top of tier, the bug value
  });

  it('renders stacks at/above 1T in truncated "T" notation', () => {
    expect(formatStackChips(1_000_000_000_000)).toBe('1T');
  });

  // Defensive: non-finite / negative never produce a misleading compact string.
  it('falls back to plain grouping for negative and non-finite values', () => {
    expect(formatStackChips(-1)).toBe('-1');
    expect(formatStackChips(-1_000_000)).toBe('-1,000,000');
    expect(formatStackChips(Number.NaN)).toBe('NaN');
    expect(formatStackChips(Number.POSITIVE_INFINITY)).toBe('∞');
  });
});

describe('stackHasHiddenPrecision', () => {
  // Below the compaction threshold the compact string equals the exact grouped
  // value, so revealing the exact balance would add nothing.
  it('returns false when compact already shows the full grouped value', () => {
    expect(stackHasHiddenPrecision(5_000)).toBe(false);
    expect(stackHasHiddenPrecision(99_999)).toBe(false); // just under threshold
    expect(stackHasHiddenPrecision(0)).toBe(false);
  });

  // At/above the threshold the compact notation drops precision, so the exact
  // value is worth revealing.
  it('returns true when compact notation hides precision', () => {
    expect(stackHasHiddenPrecision(100_000)).toBe(true); // at threshold
    expect(stackHasHiddenPrecision(1_000_000)).toBe(true);
    expect(stackHasHiddenPrecision(999_999_999)).toBe(true);
    expect(stackHasHiddenPrecision(1_254_783_925)).toBe(true);
  });

  // Defensive inputs route through the same plain-grouping fallback in
  // formatStackChips, so compact === exact and there is nothing to reveal.
  it('returns false for negative and non-finite values', () => {
    expect(stackHasHiddenPrecision(-5_000)).toBe(false);
    expect(stackHasHiddenPrecision(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
