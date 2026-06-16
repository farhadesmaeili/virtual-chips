import { describe, expect, it } from 'vitest';
import { friendlyError } from './error-messages';

describe('friendlyError', () => {
  it('maps known codes to friendly messages', () => {
    expect(friendlyError('ROOM_FULL')).toContain('full');
    expect(friendlyError('RATE_LIMITED')).toContain('slow down');
  });

  it('maps betting action codes', () => {
    expect(friendlyError('NOT_YOUR_TURN')).toContain('turn');
    expect(friendlyError('INSUFFICIENT_CHIPS')).toContain('all in');
    expect(friendlyError('INVALID_RAISE')).toContain('minimum');
  });

  it('uses the fallback for unknown codes', () => {
    expect(friendlyError('WAT', 'custom fallback')).toBe('custom fallback');
  });

  it('has a default when no fallback is given', () => {
    expect(friendlyError('WAT')).toBe('Something went wrong.');
  });
});
