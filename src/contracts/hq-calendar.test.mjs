import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { agendaEvents, availabilityForDate, isConfirmedBooked, isInquiryOrHold, localDateKey, monthGrid, shapeCalendarEvent } from "../lib/hq-calendar.mjs";

test("confirmed and completed bookings occupy a date while inquiries and cancellations do not", () => {
  assert.equal(isConfirmedBooked({ bookingStatus: "confirmed", eventStatus: "booked" }), true);
  assert.equal(isConfirmedBooked({ bookingStatus: "completed", eventStatus: "completed" }), true);
  assert.equal(isConfirmedBooked({ bookingStatus: "pending_contract", eventStatus: "quoted" }), false);
  assert.equal(isConfirmedBooked({ bookingStatus: "confirmed", eventStatus: "cancelled" }), false);
  assert.equal(isInquiryOrHold({ bookingStatus: "pending_deposit", eventStatus: "pending" }), true);
  assert.equal(isInquiryOrHold({ eventStatus: "inquiry" }), true);
});

test("date checker distinguishes Open, Booked, and Multiple Events without claiming partial availability", () => {
  const events = [
    { id: "one", dateKey: "2026-09-12", bookingStatus: "confirmed" },
    { id: "two", dateKey: "2026-09-12", eventStatus: "booked" },
    { id: "lead", dateKey: "2026-09-13", eventStatus: "inquiry" },
  ];
  assert.equal(availabilityForDate(events, "2026-09-11").label, "Open");
  assert.equal(availabilityForDate(events.slice(0, 1), "2026-09-12").label, "Booked");
  assert.equal(availabilityForDate(events, "2026-09-12").label, "Multiple events");
  const inquiryDate = availabilityForDate(events, "2026-09-13");
  assert.equal(inquiryDate.label, "Open");
  assert.equal(inquiryDate.inquiries.length, 1);
});

test("events use their canonical timezone for date and time boundaries", () => {
  assert.equal(localDateKey("2026-09-03T03:30:00Z", "America/Indiana/Indianapolis"), "2026-09-02");
  const shaped = shapeCalendarEvent({ event_id: "event-1", title: "Late event", starts_at: "2026-09-03T03:30:00Z", timezone: "America/Indiana/Indianapolis", booking_status: "confirmed", booked_services: [{ service_name: "DJ / MC" }] });
  assert.equal(shaped.dateKey, "2026-09-02");
  assert.equal(shaped.classification, "booked");
  assert.deepEqual(shaped.services, ["DJ / MC"]);
});

test("month and agenda shaping are deterministic and linkable by canonical event ID", () => {
  const grid = monthGrid("2026-09");
  assert.equal(grid.length, 42);
  assert.equal(grid.filter((day) => day.inMonth).length, 30);
  const agenda = agendaEvents([
    { id: "later", dateKey: "2026-09-05", startsAt: "2026-09-05T20:00:00Z" },
    { id: "first", dateKey: "2026-09-03", startsAt: "2026-09-03T18:00:00Z" },
    { id: "outside", dateKey: "2026-10-20", startsAt: "2026-10-20T18:00:00Z" },
  ], "2026-09-01", 30);
  assert.deepEqual(agenda.map((event) => event.id), ["first", "later"]);
});

test("Calendar route is staff-protected and reads only the canonical dashboard composition", () => {
  const page = fs.readFileSync(fileURLToPath(new URL("../app/admin/calendar/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /isStaffRole\(role\)/);
  assert.match(page, /redirect\("\/login\?error=access"\)/);
  assert.match(page, /from\("os_event_dashboard_v"\)/);
  assert.match(page, /result\.error[^]*No date is being represented as Open or Booked[^]*:\s*<HqCalendar/);
  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|createAdminSupabase|SERVICE_ROLE/);
});

test("Calendar UI exposes Month, Agenda, date navigation, and conservative availability wording", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  for (const label of ["Month", "Agenda", "Previous", "Today", "Next", "Jump to date", "Booked / open quick view"]) assert.match(component, new RegExp(label));
  assert.match(component, /href=\{`\/admin\/gigs\/\$\{event\.id\}`\}/);
  assert.match(component, /does not promise partial-day, staff, service, travel, or equipment availability/i);
  assert.doesNotMatch(component, /Partially Available|partially available/i);
});
