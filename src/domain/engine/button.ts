/**
 * Dealer-button placement between hands. Pure and testable: takes the occupied
 * seats and the previous button, returns the next button seat.
 */

/** The first button for a fresh table: the lowest occupied seat. */
export function firstButtonSeat(occupiedSeats: readonly number[]): number {
  if (occupiedSeats.length === 0) {
    throw new Error('cannot place the button with no occupied seats');
  }
  return Math.min(...occupiedSeats);
}

/**
 * The next dealer-button seat: the first occupied seat clockwise after
 * `previousButtonSeat` (ascending by seat number, wrapping to the lowest seat).
 *
 * Robust to the previous button's player having left — it rotates by seat
 * position, so it always lands on the next *occupied* seat past the old button,
 * whether or not that seat is still taken.
 */
export function nextButtonSeat(
  occupiedSeats: readonly number[],
  previousButtonSeat: number,
): number {
  const sorted = [...new Set(occupiedSeats)].sort((a, b) => a - b);
  if (sorted.length === 0) {
    throw new Error('cannot place the button with no occupied seats');
  }
  // First seat strictly clockwise of the old button, else wrap to the lowest.
  return sorted.find((seat) => seat > previousButtonSeat) ?? sorted[0]!;
}
