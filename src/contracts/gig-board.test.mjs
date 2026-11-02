import test from "node:test";
import assert from "node:assert/strict";
import { orderGigBoardRows } from "../lib/gig-board.mjs";

const now = Date.parse("2026-11-02T15:00:00Z");
test("upcoming wedding remains in the first ten despite older completed bookings", () => {
  const old = Array.from({ length: 15 }, (_, i) => ({ id: `old-${i}`, starts_at: `2025-01-${String(i + 1).padStart(2, "0")}T18:00:00Z` }));
  const wedding = { id: "synthetic-wedding", starts_at: "2026-11-08T00:00:00Z", ends_at: "2026-11-08T05:00:00Z" };
  const input = [...old, wedding], before = JSON.stringify(input);
  const ordered = orderGigBoardRows(input, now);
  assert.equal(ordered[0].id, wedding.id);
  assert.ok(ordered.slice(0, 10).some(x => x.id === wedding.id));
  assert.equal(ordered.length, input.length);
  assert.equal(JSON.stringify(input), before);
});
test("ongoing gigs precede future gigs, then undated and recent past; unknown dates stay unknown", () => {
  const rows = [
    { id: "past-old", starts_at: "2026-10-01T00:00:00Z" },
    { id: "unknown", starts_at: "invalid" },
    { id: "future", starts_at: "2026-11-07T18:00:00-06:00" },
    { id: "past-recent", starts_at: "2026-11-01T18:00:00-05:00" },
    { id: "ongoing", starts_at: "2026-11-02T14:00:00Z", ends_at: "2026-11-02T16:00:00Z" },
  ];
  assert.deepEqual(orderGigBoardRows(rows, now).map(x => x.id), ["ongoing", "future", "unknown", "past-recent", "past-old"]);
  assert.equal(orderGigBoardRows(rows, now).find(x => x.id === "unknown").starts_at, "invalid");
});
