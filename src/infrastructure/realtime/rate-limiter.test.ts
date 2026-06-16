import { describe, expect, it } from 'vitest';
import { TokenBucketRateLimiter } from './rate-limiter';

function setup(capacity: number, refillPerSecond: number) {
  const time = { ms: 0 };
  const limiter = new TokenBucketRateLimiter(
    { capacity, refillPerSecond },
    { now: () => time.ms },
  );
  return { limiter, time };
}

describe('TokenBucketRateLimiter', () => {
  it('allows up to the capacity, then blocks', () => {
    const { limiter } = setup(3, 1);
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(false);
  });

  it('refills over time at the configured rate', () => {
    const { limiter, time } = setup(3, 1); // 1 token/sec
    for (let i = 0; i < 3; i++) limiter.tryAcquire('u');
    expect(limiter.tryAcquire('u')).toBe(false);

    time.ms += 1000; // one token back
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(false);
  });

  it('never refills beyond the capacity', () => {
    const { limiter, time } = setup(2, 100);
    limiter.tryAcquire('u');
    time.ms += 10_000; // would refill 1000 tokens, but capped at 2
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(false);
  });

  it('tracks each key independently', () => {
    const { limiter } = setup(1, 1);
    expect(limiter.tryAcquire('a')).toBe(true);
    expect(limiter.tryAcquire('a')).toBe(false);
    // a different key has its own full bucket
    expect(limiter.tryAcquire('b')).toBe(true);
  });
});
