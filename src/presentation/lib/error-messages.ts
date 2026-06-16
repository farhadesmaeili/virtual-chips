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
};

/** Returns a friendly message for an error code, falling back to a default. */
export function friendlyError(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? 'Something went wrong.';
}
