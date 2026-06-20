import { describe, expect, it } from 'vitest';
import { formatBlinds } from './blinds-readout';

describe('formatBlinds', () => {
  it('joins the small and big blind with a slash', () => {
    expect(formatBlinds(1, 2)).toBe('1 / 2');
    expect(formatBlinds(5, 10)).toBe('5 / 10');
  });

  it('groups thousands using the locale formatter', () => {
    // Compare against toLocaleString so the assertion holds under any locale.
    const expected = `${(1000).toLocaleString()} / ${(2000).toLocaleString()}`;
    expect(formatBlinds(1000, 2000)).toBe(expected);
  });
});
