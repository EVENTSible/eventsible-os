/**
 * Prioritize current/upcoming canonical gigs before undated and recent past gigs.
 * Does not change dates, booking states or records, and does not drop history.
 * @template {{starts_at?: string|null, ends_at?: string|null}} T
 * @param {T[]} rows
 * @param {number} now
 * @returns {T[]}
 */
export function orderGigBoardRows(rows, now) {
  const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const group = row => {
    const start = instant(row.starts_at), end = instant(row.ends_at);
    if (start === null) return 1;
    return Math.max(start, end ?? start) >= now ? 0 : 2;
  };
  return [...rows].sort((a, b) => {
    const aGroup = group(a), bGroup = group(b);
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (aGroup === 1) return 0;
    const delta = instant(a.starts_at) - instant(b.starts_at);
    return aGroup === 2 ? -delta : delta;
  });
}
