import { describe, expect, it } from 'vitest';
import { shortenId } from './short-id';

describe('shortenId', () => {
  it('truncates a long id to head + ellipsis', () => {
    expect(shortenId('clx2abcd9876', 6)).toBe('clx2ab…');
  });

  it('leaves an id at exactly head length unchanged (no ellipsis)', () => {
    expect(shortenId('abcdef', 6)).toBe('abcdef');
  });

  it('leaves an id shorter than head unchanged', () => {
    expect(shortenId('abc', 6)).toBe('abc');
  });

  it('handles an empty id', () => {
    expect(shortenId('', 6)).toBe('');
  });

  it('defaults to a 6-character head', () => {
    expect(shortenId('clx2abcd9876')).toBe('clx2ab…');
  });

  it('clamps a negative head to zero (ellipsis only)', () => {
    expect(shortenId('abcdef', -3)).toBe('…');
  });
});
