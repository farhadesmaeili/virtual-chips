import { describe, expect, it } from 'vitest';
import { formatCountdown, secondsRemaining } from './countdown';

describe('secondsRemaining', () => {
  it('rounds up to whole seconds left', () => {
    expect(secondsRemaining(10_000, 0)).toBe(10);
    expect(secondsRemaining(10_000, 9_100)).toBe(1); // 900ms left → 1s
    expect(secondsRemaining(10_000, 9_999)).toBe(1);
  });

  it('never goes negative once the deadline has passed', () => {
    expect(secondsRemaining(10_000, 10_000)).toBe(0);
    expect(secondsRemaining(10_000, 25_000)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatCountdown(23)).toBe('0:23');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(75)).toBe('1:15');
  });

  it('clamps negatives to 0:00', () => {
    expect(formatCountdown(-4)).toBe('0:00');
  });
});
