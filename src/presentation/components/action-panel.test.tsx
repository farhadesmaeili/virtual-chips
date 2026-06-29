import { describe, expect, it } from 'vitest';
import { commitAmount } from './action-panel';

// `commitAmount` is the commit-time coercion for the exact-amount betting
// field: it runs on blur / Enter / confirm, never per keystroke, so a leading
// digit smaller than `min` is no longer swallowed while typing. The value it
// returns is always inside the tested [min, max] betting bounds.
describe('commitAmount', () => {
  const min = 20;
  const max = 100;

  it('keeps an in-range value as typed', () => {
    expect(commitAmount('50', min, max)).toBe(50);
  });

  it('clamps a value above max down to max', () => {
    expect(commitAmount('150', min, max)).toBe(max);
  });

  it('clamps a value below min up to min', () => {
    expect(commitAmount('10', min, max)).toBe(min);
  });

  it('snaps a non-numeric entry to min', () => {
    expect(commitAmount('abc', min, max)).toBe(min);
  });

  it('snaps an empty entry to min', () => {
    expect(commitAmount('', min, max)).toBe(min);
  });

  it('snaps "0" to min (documents the `|| min` falsy-zero behavior)', () => {
    expect(commitAmount('0', min, max)).toBe(min);
  });
});
