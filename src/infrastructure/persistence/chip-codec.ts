/**
 * Conversion boundary between the persistence layer's `bigint` chip columns and
 * the `number`-based domain/application layers.
 *
 * Chip/monetary columns are stored as Postgres BIGINT (int64) so the chip
 * ceiling can be raised without overflow, but Prisma returns a BIGINT as a JS
 * `bigint`. The domain is pure and operates on JS `number`, so every chip value
 * is converted here at the repository/mapper boundary: `bigint -> number` on
 * read, `number -> bigint` on write. The domain and application layers never see
 * a `bigint`.
 *
 * Safe because every chip value is far below `Number.MAX_SAFE_INTEGER` (2^53) at
 * the current ceiling; the helpers assert that bound so an out-of-range value can
 * never silently lose precision.
 */

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Converts a chip column (`bigint`) to a `number` for the domain. Throws if the
 * value is outside the safe-integer range, where `Number(value)` would lose
 * precision.
 */
export function toChipNumber(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new RangeError(
      `chip value ${value} is outside the safe integer range (+/-2^53)`,
    );
  }
  return Number(value);
}

/**
 * Converts a `number` from the domain to a chip column (`bigint`) for write.
 * Throws on a non-integer or a value above the safe-integer range — an imprecise
 * value must never be persisted.
 */
export function toChipBigInt(value: number): bigint {
  if (!Number.isInteger(value)) {
    throw new TypeError(`chip value ${value} is not an integer`);
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `chip value ${value} is outside the safe integer range (+/-2^53)`,
    );
  }
  return BigInt(value);
}

/** Nullable {@link toChipNumber}: `null` passes through unchanged. */
export function toChipNumberOrNull(value: bigint | null): number | null {
  return value === null ? null : toChipNumber(value);
}

/** Nullable {@link toChipBigInt}: `null` passes through unchanged. */
export function toChipBigIntOrNull(value: number | null): bigint | null {
  return value === null ? null : toChipBigInt(value);
}
