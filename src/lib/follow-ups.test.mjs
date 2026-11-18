import test from "node:test";
import assert from "node:assert/strict";
import { followUpDue, followUpKey, followUpState, safeGigSaladUrl } from "./follow-ups.mjs";

test("booked leads leave the active queue and due dates follow canonical tasks", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  assert.equal(followUpState({ status: "won" }), "Booked");
  assert.equal(followUpDue({ status: "won", next_follow_up_at: "2026-11-01T00:00:00Z" }, null, now), false);
  assert.equal(followUpDue({ status: "follow_up" }, { due_at: "2026-11-17T00:00:00Z", status: "todo" }, now), true);
  assert.equal(followUpDue({ status: "follow_up" }, { due_at: "2026-11-17T00:00:00Z", status: "completed" }, now), false);
  assert.equal(followUpKey("lead-1"), "hq-follow-up:lead-1");
});

test("external links allow only direct HTTPS GigSalad hosts", () => {
  assert.equal(safeGigSaladUrl("https://www.gigsalad.com/inbox/thread/123"), "https://www.gigsalad.com/inbox/thread/123");
  for (const value of ["javascript:alert(1)", "https://gigsalad.com.evil.test/", "https://user:password@gigsalad.com/", "http://gigsalad.com/"]) {
    assert.equal(safeGigSaladUrl(value), null);
  }
});
