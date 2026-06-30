import { describe, expect, it } from 'vitest';
import {
  toChipBigInt,
  toChipBigIntOrNull,
  toChipNumber,
  toChipNumberOrNull,
} from './chip-codec';

describe('chip-codec round-trip', () => {
  it('round-trips representative values number -> bigint -> number', () => {
    for (const n of [0, 1, 20, 100_000_000, -800]) {
      expect(toChipNumber(toChipBigInt(n))).toBe(n);
    }
  });

  it('round-trips a value above int32 (proves the bigint migration)', () => {
    // 3_000_000_000 overflows a signed int32 (max 2_147_483_647) but is well
    // within 2^53, so it survives the boundary exactly.
    const n = 3_000_000_000;
    expect(toChipNumber(toChipBigInt(n))).toBe(n);
  });
});

describe('toChipNumber', () => {
  it('throws for a bigint above Number.MAX_SAFE_INTEGER', () => {
    expect(() => toChipNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
  });

  it('throws for a bigint below -Number.MAX_SAFE_INTEGER', () => {
    expect(() =>
      toChipNumber(-(BigInt(Number.MAX_SAFE_INTEGER) + 1n)),
    ).toThrow();
  });
});

describe('toChipBigInt', () => {
  it('throws on a non-integer', () => {
    expect(() => toChipBigInt(1.5)).toThrow();
  });

  it('throws on a number above Number.MAX_SAFE_INTEGER', () => {
    expect(() => toChipBigInt(Number.MAX_SAFE_INTEGER + 2)).toThrow();
  });
});

describe('nullable variants', () => {
  it('pass null through unchanged in both directions', () => {
    expect(toChipNumberOrNull(null)).toBeNull();
    expect(toChipBigIntOrNull(null)).toBeNull();
  });

  it('convert a non-null value like their base helpers', () => {
    expect(toChipNumberOrNull(40n)).toBe(40);
    expect(toChipBigIntOrNull(40)).toBe(40n);
  });
});
