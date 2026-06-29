// Pure geometry for placing seats around the oval table. No DOM, no React —
// kept testable. Positions are percentages of the table box, so they follow the
// container's aspect ratio automatically (portrait on mobile, landscape on
// desktop) without recomputing.

/** Largest table we lay out (poker 9-max). */
export const MAX_SEATS = 9;

/** Horizontal / vertical radii of the seat ring, as % of the table box. */
const RADIUS_X = 46;
const RADIUS_Y = 41;

export interface SeatSlot {
  /** 0-based seat index (matches the domain); seat 0 is the hero at bottom. */
  readonly seat: number;
  /** Center of the seat, as a percentage of the table box (0–100). */
  readonly xPct: number;
  readonly yPct: number;
  /** Unit vector from table center toward the seat — the chips→pot direction. */
  readonly towardCenter: { readonly x: number; readonly y: number };
}

/**
 * A point on the table as a percentage of the seat-overlay box (0–100), the
 * shared coordinate space for seats, the pot, and flying chips. Lives here in
 * the geometry module so seat positions and chip endpoints have one source.
 */
export interface Point {
  readonly xPct: number;
  readonly yPct: number;
}

/**
 * The pot / table center. `seatSlots` arranges seats around (50, 50), so this is
 * the geometric center of the seat ring — derived from the layout, not a magic
 * spot. Also the fallback for an unknown seat.
 */
export const TABLE_CENTER: Point = { xPct: 50, yPct: 50 };

/**
 * In-front chip-slot inset: how far, toward the table center, a seat's chips sit
 * from the avatar — as a percentage of the seat-overlay box. This is the single
 * source for where committed/awarded chips rest, matching the live in-front bet
 * chips in `seat.tsx`.
 *
 * Choice of 5%: the live bet chips shift 28px isotropically along `towardCenter`
 * (`seat.tsx`). A percentage inset, by contrast, scales the x-offset by the box
 * width and the y-offset by its height, so on a non-square box no single percent
 * equals 28px on both axes. At the landscape reference box (max-w 44rem = 704px
 * wide, 16/10 aspect ⇒ 440px tall) the geometric-mean dimension is
 * √(704·440) ≈ 556px, and 28 / 556 ≈ 5.0%. So 5% reproduces the 28px in-front
 * offset to ~1px on that mean scale, splitting the small anisotropy evenly
 * between the axes.
 */
export const CHIP_ANCHOR_INSET_PCT = 5;

/**
 * The in-front chip anchor for `seat`: the seat center nudged toward the table
 * center by {@link CHIP_ANCHOR_INSET_PCT}, so chips rest in the slot in front of
 * the avatar (between the player and the pot) rather than on the nameplate. This
 * is correct for every seat by construction — the offset follows each seat's own
 * `towardCenter` vector, so its sign flips with the seat's quadrant. Unknown
 * seats fall back to {@link TABLE_CENTER}, mirroring `seatPoint`.
 */
export function seatChipAnchor(seat: number, capacity = MAX_SEATS): Point {
  const slot = seatSlots(capacity).find((s) => s.seat === seat);
  if (!slot) return TABLE_CENTER;
  return {
    xPct: slot.xPct + slot.towardCenter.x * CHIP_ANCHOR_INSET_PCT,
    yPct: slot.yPct + slot.towardCenter.y * CHIP_ANCHOR_INSET_PCT,
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Distributes `capacity` seats evenly around the oval, seat 0 at bottom center
 * (where the hero sits) and increasing clockwise. Seat indices are 0-based to
 * match the domain. `capacity` is clamped to [1, MAX_SEATS].
 */
export function seatSlots(capacity: number): SeatSlot[] {
  const count = Math.max(1, Math.min(MAX_SEATS, Math.floor(capacity)));
  const slots: SeatSlot[] = [];

  for (let i = 0; i < count; i += 1) {
    // 90° points down the screen (y grows downward), so seat 0 lands at bottom.
    const angle = ((90 + (360 * i) / count) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    slots.push({
      seat: i,
      xPct: round(50 + RADIUS_X * cos),
      yPct: round(50 + RADIUS_Y * sin),
      // Kept at full precision so it stays a true unit vector.
      towardCenter: { x: -cos, y: -sin },
    });
  }

  return slots;
}
