import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  executeGigSaladCandidateSync,
  fetchGigSaladIcal,
  GigSaladSyncError,
} from "../lib/gigsalad-ical-sync.mjs";

const actionSource = readFileSync(new URL("../app/admin/imports/actions.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/admin/imports/page.tsx", import.meta.url), "utf8");
const syncActionSource = actionSource.slice(
  actionSource.indexOf("export async function syncGigSaladCandidatesAction"),
  actionSource.indexOf("export async function createManualImportCandidateAction"),
);

function calendar({ uid = "BA-1234567@gigsalad.com", summary = "Sample Reception" } = {}) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:gigsalad.com",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20260902T120000Z",
    `SUMMARY:${summary}`,
    "DESCRIPTION:GigSalad Booking #1234567\\nClient name: Sample Client\\nhttps://example.invalid/gig/12345",
    "DTSTART;TZID=America/New_York:20260919T170000",
    "DTEND;TZID=America/New_York:20260919T220000",
    "LOCATION:123 Example St\\, Sample City\\, NY 10001",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function response(body, init = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "text/calendar", ...init.headers }, ...init });
}

async function errorCode(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    assert.ok(error instanceof GigSaladSyncError);
    return error.code;
  }
}

test("fails safely when the server-only feed setting is missing or invalid", async () => {
  assert.equal(await errorCode(fetchGigSaladIcal("")), "feed_not_configured");
  assert.equal(await errorCode(fetchGigSaladIcal("http://example.invalid/feed.ics")), "feed_configuration_invalid");
});

test("bounds fetch failures, timeouts, and response size without echoing the endpoint", async () => {
  const secretEndpoint = "https://example.invalid/private-feed-token";
  assert.equal(await errorCode(fetchGigSaladIcal(secretEndpoint, { fetchImpl: async () => { throw new Error(secretEndpoint); } })), "feed_fetch_failed");
  assert.equal(await errorCode(fetchGigSaladIcal(secretEndpoint, {
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error(secretEndpoint)))),
  })), "feed_fetch_timeout");
  assert.equal(await errorCode(fetchGigSaladIcal(secretEndpoint, {
    fetchImpl: async () => response("", { headers: { "content-length": "1048577" } }),
  })), "feed_too_large");
});

test("rejects malformed feeds before reading or writing candidates", async () => {
  let reads = 0;
  let writes = 0;
  const code = await errorCode(executeGigSaladCandidateSync({
    actorUserId: "staff-user",
    feedUrl: "https://example.invalid/feed.ics",
    fetchImpl: async () => response("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:broken"),
    loadExistingCandidates: async () => { reads += 1; return []; },
    insertCandidate: async () => { writes += 1; return "created"; },
  }));
  assert.equal(code, "feed_parse_failed");
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test("creates only a bounded GigSalad candidate and returns aggregate counts", async () => {
  const writes = [];
  const result = await executeGigSaladCandidateSync({
    actorUserId: "staff-user",
    feedUrl: "https://example.invalid/feed.ics",
    fetchImpl: async () => response(calendar()),
    loadExistingCandidates: async () => [],
    insertCandidate: async (candidate) => { writes.push(candidate); return "created"; },
  });
  assert.deepEqual(result, {
    counts: { discovered: 1, new: 1, refreshed: 0, unchanged: 0, preserved: 0, skipped: 0, warnings: 0 },
    write_failures: 0,
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].source, "gigsalad_ical");
  assert.equal(writes[0].external_reference, "BA-1234567@gigsalad.com");
  assert.equal(writes[0].created_by_user_id, "staff-user");
  const serialized = JSON.stringify(writes[0]);
  assert.doesNotMatch(serialized, /private-feed-token|example\.invalid\/feed|raw_vevent|raw_feed|feed_url/);
});

test("exact replay creates no duplicate candidate", async () => {
  let writes = 0;
  const first = await executeGigSaladCandidateSync({
    actorUserId: "staff-user",
    feedUrl: "https://example.invalid/feed.ics",
    fetchImpl: async () => response(calendar()),
    loadExistingCandidates: async () => [],
    insertCandidate: async () => { writes += 1; return "created"; },
  });
  let existingCandidate;
  await executeGigSaladCandidateSync({
    actorUserId: "staff-user",
    feedUrl: "https://example.invalid/feed.ics",
    fetchImpl: async () => response(calendar()),
    loadExistingCandidates: async () => [],
    insertCandidate: async (candidate) => { existingCandidate = candidate; return "duplicate"; },
  });
  const replay = await executeGigSaladCandidateSync({
    actorUserId: "staff-user",
    feedUrl: "https://example.invalid/feed.ics",
    fetchImpl: async () => response(calendar()),
    loadExistingCandidates: async () => [{ ...existingCandidate, review_status: "pending" }],
    insertCandidate: async () => { writes += 1; return "created"; },
  });
  assert.equal(first.counts.new, 1);
  assert.equal(replay.counts.unchanged, 1);
  assert.equal(replay.counts.new, 0);
  assert.equal(writes, 1);
});

test("preserves changed pending, review-later, imported, matched, and ignored candidates", async () => {
  for (const status of ["pending", "review_later", "imported", "matched", "ignored"]) {
    let writes = 0;
    const result = await executeGigSaladCandidateSync({
      actorUserId: "staff-user",
      feedUrl: "https://example.invalid/feed.ics",
      fetchImpl: async () => response(calendar({ summary: "Updated source title" })),
      loadExistingCandidates: async () => [{
        source: "gigsalad_ical",
        external_reference: "BA-1234567@gigsalad.com",
        proposed_data: { event: { title: "Reviewed title" } },
        review_status: status,
      }],
      insertCandidate: async () => { writes += 1; return "created"; },
    });
    assert.equal(result.counts.preserved, 1);
    assert.equal(result.counts.refreshed, 0);
    assert.equal(result.counts.warnings, 1);
    assert.equal(writes, 0);
  }
});

test("server action is authenticated staff-only and writes candidates only", () => {
  assert.match(actionSource, /async function requireStaff\(\)/);
  assert.match(actionSource, /supabase\.auth\.getUser\(\)/);
  assert.match(actionSource, /isStaffRole\(user\.app_metadata\?\.role\)/);
  assert.ok(syncActionSource.indexOf("requireStaff()") < syncActionSource.indexOf("executeGigSaladCandidateSync"));
  assert.match(syncActionSource, /GIGSALAD_ICAL_FEED_URL/);
  assert.match(syncActionSource, /\.from\("os_event_import_candidates"\)/);
  assert.doesNotMatch(syncActionSource, /\.from\("os_(?:events|bookings|booking_services|contacts|leads|quote_versions)"\)/);
  assert.doesNotMatch(syncActionSource, /service_role|SUPABASE_SERVICE|console\./);
});

test("feed setting is reduced to a boolean before reaching the client UI", () => {
  assert.match(pageSource, /gigsaladConfigured=\{Boolean\(process\.env\.GIGSALAD_ICAL_FEED_URL\?\.trim\(\)\)\}/);
  assert.doesNotMatch(pageSource, /gigsaladFeedUrl|feedUrl=|GIGSALAD_ICAL_FEED_URL\s*\}/);
});
