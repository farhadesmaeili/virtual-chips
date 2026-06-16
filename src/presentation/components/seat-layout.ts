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
  /** 1-based seat number; slot 1 is the hero seat at bottom center. */
  readonly seat: number;
  /** Center of the seat, as a percentage of the table box (0–100). */
  readonly xPct: number;
  readonly yPct: number;
  /** Unit vector from table center toward the seat — the chips→pot direction. */
  readonly towardCenter: { readonly x: number; readonly y: number };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Distributes `capacity` seats evenly around the oval, seat 1 at bottom center
 * (where the hero sits) and increasing clockwise. `capacity` is clamped to
 * [1, MAX_SEATS].
 */
export function seatSlots(capacity: number): SeatSlot[] {
  const count = Math.max(1, Math.min(MAX_SEATS, Math.floor(capacity)));
  const slots: SeatSlot[] = [];

  for (let i = 0; i < count; i += 1) {
    // 90° points down the screen (y grows downward), so seat 1 lands at bottom.
    const angle = ((90 + (360 * i) / count) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    slots.push({
      seat: i + 1,
      xPct: round(50 + RADIUS_X * cos),
      yPct: round(50 + RADIUS_Y * sin),
      // Kept at full precision so it stays a true unit vector.
      towardCenter: { x: -cos, y: -sin },
    });
  }

  return slots;
}
