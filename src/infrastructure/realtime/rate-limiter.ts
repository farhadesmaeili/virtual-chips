import type { Clock } from '@/application/ports';

export interface RateLimitConfig {
  /** Maximum burst — the bucket size. */
  readonly capacity: number;
  /** Sustained refill rate, in tokens per second. */
  readonly refillPerSecond: number;
}

export interface RateLimiter {
  /** Consumes a token for `key`, returning true if allowed, false if limited. */
  tryAcquire(key: string): boolean;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Per-key token-bucket rate limiter. Each key (here: a user id) gets a bucket
 * that refills over time, allowing short bursts while capping the sustained
 * rate. Pure given the injected clock, so it is fully unit-testable.
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: RateLimitConfig,
    private readonly clock: Clock,
  ) {}

  tryAcquire(key: string): boolean {
    const now = this.clock.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.config.capacity,
      updatedAt: now,
    };

    const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
    const tokens = Math.min(
      this.config.capacity,
      bucket.tokens + elapsedSeconds * this.config.refillPerSecond,
    );

    if (tokens >= 1) {
      this.buckets.set(key, { tokens: tokens - 1, updatedAt: now });
      return true;
    }
    this.buckets.set(key, { tokens, updatedAt: now });
    return false;
  }
}

/**
 * Default limits (configurable). Tuned to be generous for normal play while
 * blocking spam/abuse: a small burst of expensive room creations, and a larger
 * burst of frequent actions.
 */
export const ROOM_CREATE_LIMIT: RateLimitConfig = {
  capacity: 3,
  refillPerSecond: 0.5,
};

export const PLAYER_ACT_LIMIT: RateLimitConfig = {
  capacity: 10,
  refillPerSecond: 5,
};

/** Chip requests are infrequent; keep them anti-spam without being annoying. */
export const CHIP_REQUEST_LIMIT: RateLimitConfig = {
  capacity: 5,
  refillPerSecond: 0.5,
};
