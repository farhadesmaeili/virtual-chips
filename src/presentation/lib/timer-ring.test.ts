import { describe, expect, it } from 'vitest';
import {
  WARNING_THRESHOLD_FLOOR_MS,
  WARNING_THRESHOLD_RATIO,
  isWarning,
  remainingMs,
  ringFillFraction,
  ringSnapshot,
  warningThresholdMs,
} from './timer-ring';

describe('remainingMs', () => {
  it('returns the gap to the deadline', () => {
    expect(remainingMs(10_000, 4_000)).toBe(6_000);
  });

  it('clamps a passed deadline to zero (never negative)', () => {
    expect(remainingMs(10_000, 12_000)).toBe(0);
  });

  it('is zero exactly at the deadline', () => {
    expect(remainingMs(10_000, 10_000)).toBe(0);
  });
});

describe('warningThresholdMs', () => {
  it('uses the ratio when 25% of total exceeds the floor', () => {
    // 60s turn -> 25% = 15s, above the 5s floor.
    expect(warningThresholdMs(60_000)).toBe(15_000);
  });

  it('uses the floor when 25% of total is below it', () => {
    // 10s turn -> 25% = 2.5s, floored to 5s.
    expect(warningThresholdMs(10_000)).toBe(WARNING_THRESHOLD_FLOOR_MS);
  });

  it('returns the floor at the crossover (total = floor / ratio)', () => {
    const crossover = WARNING_THRESHOLD_FLOOR_MS / WARNING_THRESHOLD_RATIO; // 20s
    expect(warningThresholdMs(crossover)).toBe(WARNING_THRESHOLD_FLOOR_MS);
  });
});

describe('ringFillFraction', () => {
  const total = 20_000;

  it('is 1 with the full turn left', () => {
    expect(ringFillFraction(total, total)).toBe(1);
  });

  it('is 0.5 at half the turn', () => {
    expect(ringFillFraction(10_000, total)).toBe(0.5);
  });

  it('is 0 when expired', () => {
    expect(ringFillFraction(0, total)).toBe(0);
  });

  it('clamps negative remaining to 0', () => {
    expect(ringFillFraction(-5_000, total)).toBe(0);
  });

  it('clamps remaining beyond total (time-bank extension) to 1', () => {
    expect(ringFillFraction(30_000, total)).toBe(1);
  });

  it('is 0 for a non-positive total (avoids divide-by-zero)', () => {
    expect(ringFillFraction(5_000, 0)).toBe(0);
  });
});

describe('isWarning', () => {
  const total = 20_000; // threshold = max(5s, 5s) = 5s

  it('is false with plenty of time left', () => {
    expect(isWarning(10_000, total)).toBe(false);
  });

  it('is true exactly at the threshold (inclusive)', () => {
    expect(isWarning(warningThresholdMs(total), total)).toBe(true);
  });

  it('is true just inside the threshold', () => {
    expect(isWarning(4_999, total)).toBe(true);
  });

  it('is true when expired (zero remaining)', () => {
    expect(isWarning(0, total)).toBe(true);
  });
});

describe('ringSnapshot (mid-turn mount / resync faithfulness)', () => {
  const total = 30_000;
  const now = 1_000_000;

  it('starts from the real remaining time when mounting mid-turn', () => {
    // Reconnecting with 7s left on a 30s timer: fill ≈ 7/30, tween over 7s —
    // NOT a fresh full turn.
    const snap = ringSnapshot(now + 7_000, now, total);
    expect(snap.remainingMs).toBe(7_000);
    expect(snap.remainingSec).toBe(7);
    expect(snap.fraction).toBeCloseTo(7 / 30, 10);
    expect(snap.fraction).not.toBe(1);
  });

  it('is a full ring tweening over the whole turn at the very start', () => {
    const snap = ringSnapshot(now + total, now, total);
    expect(snap.remainingMs).toBe(total);
    expect(snap.fraction).toBe(1);
    expect(snap.remainingSec).toBe(30);
  });

  it('is an empty, zero-duration ring when the turn has already expired', () => {
    const snap = ringSnapshot(now - 2_000, now, total);
    expect(snap.remainingMs).toBe(0);
    expect(snap.fraction).toBe(0);
    expect(snap.remainingSec).toBe(0);
  });
});
