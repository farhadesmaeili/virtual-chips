// Maps server error codes to friendly, user-facing messages (interface voice:
// give direction, never apologize or stay vague — see vc-design §6).
const MESSAGES: Readonly<Record<string, string>> = {
  RATE_LIMITED: 'You are doing that too fast — slow down a moment.',
  ROOM_FULL: 'That table is full.',
  ROOM_NOT_FOUND: 'No table found with that code.',
  ALREADY_IN_ROOM: 'You are already at that table.',
  NOT_ROOM_MEMBER: 'You are not seated at that table.',
  INVALID_PAYLOAD: 'That request was not valid.',
  INTERNAL: 'Something went wrong. Try again.',
  // Betting actions (task 4.3)
  NOT_YOUR_TURN: 'It is not your turn yet — hold on for the table.',
  INSUFFICIENT_CHIPS: 'Not enough chips for that — go all in instead.',
  INVALID_RAISE: 'That raise is below the minimum. Raise by more.',
  INVALID_ACTION: 'You can not do that right now.',
  HAND_NOT_IN_BETTING: 'Betting is closed for this hand.',
  NO_ACTIVE_HAND: 'No hand is in play yet.',
  // Banker / hand lifecycle (task 4.6; minimal start in 4.3)
  NOT_ENOUGH_PLAYERS: 'You need at least two funded players to deal.',
  HAND_IN_PROGRESS: 'A hand is already in play.',
  NOT_BANKER: 'Only the banker can do that.',
};

/** Returns a friendly message for an error code, falling back to a default. */
export function friendlyError(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? 'Something went wrong.';
}
