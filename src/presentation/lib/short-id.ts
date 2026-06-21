/**
 * Shortens a long id for display (task 4.17): the first `head` characters
 * followed by an ellipsis. Ids already at or under `head` are returned
 * unchanged, so a short id never gets a misleading ellipsis. Display only — the
 * full id is what gets copied; this never alters the real value.
 */
export function shortenId(id: string, head = 6): string {
  const take = Math.max(0, head);
  if (id.length <= take) return id;
  return `${id.slice(0, take)}…`;
}
