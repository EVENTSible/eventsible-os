import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GIGSALAD_ICAL_SOURCE,
  parseGigSaladIcal,
  planGigSaladCandidateSync,
} from "../lib/gigsalad-ical.mjs";

const library = readFileSync(new URL("../lib/gigsalad-ical.mjs", import.meta.url), "utf8");

function calendar(eventLines, extra = []) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Synthetic Test//EN", ...extra, "BEGIN:VEVENT", ...eventLines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

function verifiedGigSaladCalendar(eventBlocks) {
  return [
    "BEGIN:VCALENDAR",
    "PRODID:gigsalad.com",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...eventBlocks.flatMap((event) => ["BEGIN:VEVENT", ...event, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

test("maps bounded RFC VEVENT fields without inventing canonical business facts", () => {
  const parsed = parseGigSaladIcal(calendar([
    "UID:test-booking-100@example.test",
    "SUMMARY:TEST ONLY / DO NOT CONTACT DJ Booking",
    "DTSTART;TZID=America/Chicago:20260919T170000",
    "DTEND;TZID=America/Chicago:20260919T210000",
    "LOCATION:Test Ballroom",
    "DESCRIPTION:Use west dock\\, then freight elevator.\\nSynthetic only.",
    "URL:https://example.test/bookings/100",
    "STATUS:CONFIRMED",
    "LAST-MODIFIED:20260901T120000Z",
  ], ["X-WR-CALNAME:Synthetic GigSalad-shaped calendar"]));

  assert.equal(parsed.discovered, 1);
  assert.equal(parsed.skipped, 0);
  assert.equal(parsed.candidates.length, 1);
  const candidate = parsed.candidates[0];
  assert.equal(candidate.source, GIGSALAD_ICAL_SOURCE);
  assert.equal(candidate.external_reference, "test-booking-100@example.test");
  assert.equal(candidate.review_status, "pending");
  assert.equal(candidate.proposed_data.event.title, "TEST ONLY / DO NOT CONTACT DJ Booking");
  assert.equal(candidate.proposed_data.event.starts_at, "2026-09-19T22:00:00.000Z");
  assert.equal(candidate.proposed_data.event.ends_at, "2026-09-20T02:00:00.000Z");
  assert.equal(candidate.proposed_data.event.timezone, "America/Chicago");
  assert.equal(candidate.proposed_data.event.venue_name, null);
  assert.equal(candidate.proposed_data.event.venue_address_1, "Test Ballroom");
  assert.equal(candidate.proposed_data.notes, "Use west dock, then freight elevator.\nSynthetic only.");
  assert.deepEqual(candidate.proposed_data.contact, { mode: "unresolved", display_name: null, primary_email: null, primary_phone: null });
  assert.deepEqual(candidate.proposed_data.service_ids, []);
  assert.equal(candidate.proposed_data.booked_amount, null);
  assert.equal(candidate.proposed_data.provenance.source_link_present, true);
  assert.equal("source_url" in candidate.proposed_data.provenance, false);
  assert.ok(candidate.proposed_data.missing_fields.includes("event.event_type"));
  assert.ok(candidate.proposed_data.missing_fields.includes("contact.decision"));
  assert.ok(candidate.proposed_data.missing_fields.includes("service_ids"));
});

test("maps the verified GigSalad VEVENT shape without persisting its source link", () => {
  const feed = verifiedGigSaladCalendar([[
    "UID:BA-1234567@gigsalad.com",
    "DTSTAMP:20260902T120000Z",
    "SUMMARY:Synthetic Celebration Alpha",
    "DESCRIPTION:GigSalad Booking #1234567\\nClient name: Sample Client\\nhttps://example.inva",
    " lid/gig/12345",
    "DTSTART;TZID=America/New_York:20260919T170000",
    "DTEND;TZID=America/New_York:20260919T220000",
    "LOCATION:123 Example St\\, Sample City\\, IN 46000",
  ]]);
  const parsed = parseGigSaladIcal(feed);
  assert.equal(parsed.discovered, 1);
  assert.equal(parsed.skipped, 0);
  const proposal = parsed.candidates[0].proposed_data;
  assert.equal(parsed.candidates[0].external_reference, "BA-1234567@gigsalad.com");
  assert.equal(proposal.event.title, "Synthetic Celebration Alpha");
  assert.equal(proposal.event.event_type, null);
  assert.equal(proposal.event.starts_at, "2026-09-19T21:00:00.000Z");
  assert.equal(proposal.event.ends_at, "2026-09-20T02:00:00.000Z");
  assert.equal(proposal.event.timezone, "America/New_York");
  assert.equal(proposal.event.venue_name, null);
  assert.equal(proposal.event.venue_address_1, "123 Example St, Sample City, IN 46000");
  assert.deepEqual(proposal.contact, { mode: "unresolved", display_name: "Sample Client", primary_email: null, primary_phone: null });
  assert.equal(proposal.notes, null);
  assert.equal(proposal.provenance.gigsalad_booking_number, "1234567");
  assert.equal(proposal.provenance.calendar_product_is_gigsalad, true);
  assert.equal(proposal.provenance.calendar_timezone_declared, true);
  assert.equal(proposal.provenance.source_link_present, true);
  assert.equal(proposal.provenance.source_timestamp, "2026-09-02T12:00:00.000Z");
  assert.equal(JSON.stringify(proposal).includes("example.invalid"), false);
  assert.ok(proposal.missing_fields.includes("contact.decision"));
  assert.ok(!proposal.missing_fields.includes("contact.display_name"));
  assert.ok(proposal.missing_fields.includes("service_ids"));
  assert.ok(proposal.missing_fields.includes("booking.total_amount"));
});

test("preserves a verified GigSalad event that crosses local midnight", () => {
  const parsed = parseGigSaladIcal(verifiedGigSaladCalendar([[
    "UID:BA-2345678@gigsalad.com",
    "DTSTAMP:20260902T120000Z",
    "SUMMARY:Synthetic Late Event Beta",
    "DESCRIPTION:GigSalad Booking #2345678\\nClient name: Example Person\\nhttps://example.invalid/gig/23456",
    "DTSTART;TZID=America/New_York:20261010T220000",
    "DTEND;TZID=America/New_York:20261011T010000",
    "LOCATION:456 Sample Ave\\, Example City\\, NY 10001",
  ]]));
  const event = parsed.candidates[0].proposed_data.event;
  assert.equal(event.starts_at, "2026-10-11T02:00:00.000Z");
  assert.equal(event.ends_at, "2026-10-11T05:00:00.000Z");
  assert.ok(Date.parse(event.ends_at) > Date.parse(event.starts_at));
});

test("warns on missing demonstrated labels and malformed booking identity", () => {
  const parsed = parseGigSaladIcal(verifiedGigSaladCalendar([[
    "UID:unexpected-uid-shape",
    "DTSTAMP:20260902T120000Z",
    "SUMMARY:Synthetic Example Gamma",
    "DESCRIPTION:GigSalad Booking #not-a-number\\nhttps://example.invalid/gig/34567",
    "DTSTART;TZID=America/New_York:20260919T170000",
    "DTEND;TZID=America/New_York:20260919T180000",
    "LOCATION:789 Fictional Rd\\, Example City\\, NY 10001",
  ]]));
  const proposal = parsed.candidates[0].proposed_data;
  assert.equal(proposal.provenance.gigsalad_booking_number, null);
  assert.equal(proposal.contact.display_name, null);
  assert.ok(proposal.source_warnings.includes("malformed_gigsalad_booking_number"));
  assert.ok(proposal.source_warnings.includes("unexpected_gigsalad_uid_shape"));
  assert.ok(proposal.source_warnings.includes("missing_gigsalad_client_name"));
  assert.ok(proposal.missing_fields.includes("contact.display_name"));
});

test("de-duplicates the full verified GigSalad UID boundary", () => {
  const event = [
    "UID:BA-4567890@gigsalad.com",
    "DTSTAMP:20260902T120000Z",
    "SUMMARY:Synthetic Duplicate Boundary",
    "DESCRIPTION:GigSalad Booking #4567890\\nClient name: Duplicate Test Person\\nhttps://example.invalid/gig/45678",
    "DTSTART;TZID=America/New_York:20260919T170000",
    "DTEND;TZID=America/New_York:20260919T180000",
    "LOCATION:100 Test Blvd\\, Fictional City\\, NY 10001",
  ];
  const parsed = parseGigSaladIcal(verifiedGigSaladCalendar([event, event]));
  assert.equal(parsed.discovered, 2);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.skipped, 1);
  assert.ok(parsed.warnings.some((entry) => entry.warning === "duplicate_external_reference_in_feed"));
});

test("handles UTC, TZID, floating, and all-day values without server-timezone shifts", () => {
  const utc = parseGigSaladIcal(calendar(["UID:utc", "SUMMARY:UTC", "DTSTART:20260920T010203Z"]));
  assert.equal(utc.candidates[0].proposed_data.event.starts_at, "2026-09-20T01:02:03.000Z");
  assert.equal(utc.candidates[0].proposed_data.event.timezone, "UTC");

  const floating = parseGigSaladIcal(calendar(["UID:floating", "SUMMARY:Floating", "DTSTART:20260919T170000"]));
  assert.equal(floating.candidates[0].proposed_data.event.starts_at, null);
  assert.ok(floating.candidates[0].proposed_data.source_warnings.includes("floating_time_requires_timezone"));

  const configured = parseGigSaladIcal(calendar(["UID:configured", "SUMMARY:Configured", "DTSTART:20260919T170000"]), { defaultTimeZone: "America/New_York" });
  assert.equal(configured.candidates[0].proposed_data.event.starts_at, "2026-09-19T21:00:00.000Z");
  assert.equal(configured.candidates[0].proposed_data.event.timezone, "America/New_York");

  const allDay = parseGigSaladIcal(calendar(["UID:all-day", "SUMMARY:All day", "DTSTART;VALUE=DATE:20260919"]));
  assert.equal(allDay.candidates[0].proposed_data.event.starts_at, null);
  assert.equal(allDay.candidates[0].proposed_data.provenance.calendar_start_date, "2026-09-19");
  assert.ok(allDay.candidates[0].proposed_data.source_warnings.includes("all_day_date_requires_staff_review"));
});

test("preserves folded text, reports missing end, and bounds descriptions", () => {
  const description = "A".repeat(2_050);
  const parsed = parseGigSaladIcal(calendar([
    "UID:folded",
    "SUMMARY:Folded",
    " description",
    "DTSTART:20260919T170000Z",
    `DESCRIPTION:${description}`,
  ]));
  const proposal = parsed.candidates[0].proposed_data;
  assert.equal(proposal.event.title, "Foldeddescription");
  assert.equal(proposal.event.ends_at, null);
  assert.equal(proposal.notes.length, 2_000);
  assert.ok(proposal.source_warnings.includes("missing_end_time"));
  assert.ok(proposal.source_warnings.includes("description_notes_truncated"));
});

test("rejects malformed structures and skips missing or unsafe UIDs", () => {
  assert.throws(() => parseGigSaladIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:broken"), /Unterminated VEVENT/);
  const missing = parseGigSaladIcal(calendar(["SUMMARY:No UID", "DTSTART:20260919T170000Z"]));
  assert.equal(missing.discovered, 1);
  assert.equal(missing.skipped, 1);
  assert.equal(missing.candidates.length, 0);
  assert.equal(missing.warnings[0].warning, "event_skipped_missing_or_unsafe_uid");
});

test("surfaces cancellation and recurrence for review without cancelling or expanding", () => {
  const parsed = parseGigSaladIcal(calendar([
    "UID:cancelled-recurring",
    "SUMMARY:Cancelled source event",
    "DTSTART:20260919T170000Z",
    "STATUS:CANCELLED",
    "RRULE:FREQ=WEEKLY;COUNT=3",
  ]));
  const proposal = parsed.candidates[0].proposed_data;
  assert.equal(proposal.provenance.source_status, "CANCELLED");
  assert.equal(proposal.provenance.recurrence_present, true);
  assert.ok(proposal.source_warnings.includes("source_marks_event_cancelled_review_only"));
  assert.ok(proposal.source_warnings.includes("recurrence_requires_source_verification"));
  assert.equal(parsed.candidates.length, 1);
});

test("uses recurrence identity deterministically and de-duplicates repeated references in one feed", () => {
  const feed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:series-1",
    "RECURRENCE-ID:20260919T170000Z",
    "SUMMARY:First occurrence",
    "DTSTART:20260919T170000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:series-1",
    "RECURRENCE-ID:20260919T170000Z",
    "SUMMARY:Duplicate occurrence",
    "DTSTART:20260919T170000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const parsed = parseGigSaladIcal(feed);
  assert.equal(parsed.discovered, 2);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].external_reference, "series-1#20260919T170000Z");
  assert.equal(parsed.skipped, 1);
  assert.ok(parsed.warnings.some((entry) => entry.warning === "duplicate_external_reference_in_feed"));
});

test("plans UID-idempotent creates and exact replays without duplicates", () => {
  const candidate = parseGigSaladIcal(calendar(["UID:stable", "SUMMARY:Stable", "DTSTART:20260919T170000Z"])).candidates[0];
  const first = planGigSaladCandidateSync([candidate], []);
  assert.equal(first.new, 1);
  assert.equal(first.create.length, 1);
  const replay = planGigSaladCandidateSync([candidate], [{ ...candidate, id: "candidate-id" }]);
  assert.equal(replay.new, 0);
  assert.equal(replay.unchanged, 1);
  assert.equal(replay.create.length, 0);
});

test("reports conservative manual-sync planning counts", () => {
  const first = parseGigSaladIcal(calendar(["UID:first", "SUMMARY:First", "DTSTART:20260919T170000Z"])).candidates[0];
  const second = parseGigSaladIcal(calendar(["UID:second", "SUMMARY:Second", "DTSTART:20260920T170000Z"])).candidates[0];
  const changed = parseGigSaladIcal(calendar(["UID:changed", "SUMMARY:Changed", "DTSTART:20260921T170000Z"])).candidates[0];
  const plan = planGigSaladCandidateSync([first, second, changed], [
    { ...first, review_status: "pending" },
    { ...changed, review_status: "review_later", proposed_data: { ...changed.proposed_data, notes: "Earlier source value" } },
  ]);
  assert.deepEqual({
    discovered: plan.discovered,
    new: plan.new,
    refreshed: plan.refreshed,
    unchanged: plan.unchanged,
    preserved: plan.preserved,
    skipped: plan.skipped,
    warnings: plan.warning_count,
  }, { discovered: 3, new: 1, refreshed: 0, unchanged: 1, preserved: 1, skipped: 0, warnings: 1 });
  assert.equal(plan.create[0].external_reference, "second");
});

test("never overwrites changed pending, imported, matched, or ignored candidates", () => {
  const candidate = parseGigSaladIcal(calendar(["UID:protected", "SUMMARY:New source title", "DTSTART:20260919T170000Z"])).candidates[0];
  for (const status of ["pending", "review_later", "imported", "matched", "ignored"]) {
    const plan = planGigSaladCandidateSync([candidate], [{
      source: GIGSALAD_ICAL_SOURCE,
      external_reference: candidate.external_reference,
      proposed_data: { ...candidate.proposed_data, event: { ...candidate.proposed_data.event, title: "Reviewed title" } },
      review_status: status,
    }]);
    assert.equal(plan.new, 0);
    assert.equal(plan.refreshed, 0);
    assert.equal(plan.preserved, 1);
    assert.equal(plan.skipped, 0);
    assert.equal(plan.create.length, 0);
    assert.equal(plan.warning_count, 1);
  }
});

test("keeps feed configuration and canonical business writes out of adapter infrastructure", () => {
  assert.doesNotMatch(library, /GIGSALAD_.*(?:URL|TOKEN|SECRET)/);
  assert.doesNotMatch(library, /process\.env|console\.|fetch\(/);
  assert.doesNotMatch(library, /\.from\(["']os_(?:events|bookings|booking_services|contacts|leads|quote_versions)["']\)/);
  assert.doesNotMatch(library, /feed_url|raw_vevent|raw_payload/);
});

test("enforces bounded feed and fallback-timezone inputs", () => {
  assert.throws(() => parseGigSaladIcal("A".repeat(1_048_577)), /bounded feed limit/);
  assert.throws(() => parseGigSaladIcal(calendar(["UID:timezone", "SUMMARY:Timezone", "DTSTART:20260919T170000"]), { defaultTimeZone: "Not/A_Timezone" }), /fallback timezone/);
});
