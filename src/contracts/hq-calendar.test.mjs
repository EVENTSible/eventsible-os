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

test("date checker distinguishes no booked event, Booked, and Multiple Events without claiming team availability", () => {
  const events = [
    { id: "one", dateKey: "2026-09-12", bookingStatus: "confirmed" },
    { id: "two", dateKey: "2026-09-12", eventStatus: "booked" },
    { id: "lead", dateKey: "2026-09-13", eventStatus: "inquiry" },
  ];
  assert.equal(availabilityForDate(events, "2026-09-11").label, "No booked event");
  assert.equal(availabilityForDate(events.slice(0, 1), "2026-09-12").label, "Booked");
  assert.equal(availabilityForDate(events, "2026-09-12").label, "Multiple events");
  const inquiryDate = availabilityForDate(events, "2026-09-13");
  assert.equal(inquiryDate.label, "No booked event");
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
  assert.match(page, /authorizeHqCapability\("schedule\.read"\)/);
  assert.match(page, /"\/login" : "\/access-denied"/);
  assert.match(page, /from\("os_event_dashboard_v"\)/);
  assert.match(page, /os_team_calendar_snapshot/);
  assert.doesNotMatch(page, /createAdminSupabase|SERVICE_ROLE/);
});

test("Calendar UI exposes Month, Upcoming, date navigation, and conservative availability wording", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  for (const label of ["Month", "Upcoming", "Previous", "Today", "Next", "Jump to date", "No booked event"]) assert.match(component, new RegExp(label));
  assert.match(component, /href=\{`\/admin\/gigs\/\$\{event\.id\}`\}/);
  assert.match(component, /not a promise that the team, services, travel window, or equipment are available/i);
  assert.doesNotMatch(component, /Partially Available|partially available/i);
});

test("Calendar-first layout keeps the month and selected day ahead of entry and owner controls", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  const page = fs.readFileSync(fileURLToPath(new URL("../app/admin/calendar/page.tsx", import.meta.url)), "utf8");
  assert.ok(component.indexOf('className="calendar-toolbar"') < component.indexOf('className="calendar-primary-layout"'));
  assert.ok(component.indexOf('className="calendar-primary-layout"') < component.indexOf('id="add-availability"'));
  assert.ok(component.indexOf('id="selected-day-agenda"') < component.indexOf('id="add-availability"'));
  assert.ok(component.indexOf('id="add-availability"') < component.indexOf('className="calendar-owner-tools"'));
  assert.match(component, /<details className="calendar-owner-tools">/);
  assert.match(component, /aria-controls="calendar-filters"/);
  assert.doesNotMatch(page, /calendar-header|Mission Control/);
  assert.match(page, /<h1 className="sr-only">Team Calendar<\/h1>/);
});

test("occupied dates select the day, empty dates prefill a new entry, and compact overflow stays in month context", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  assert.match(component, /onClick=\{\(\) => totalItems \? selectDay\(day\.key\) : startEntry\(day\.key\)\}/);
  assert.match(component, /calendar-indicator-overflow/);
  assert.doesNotMatch(component, /setView\("agenda"\).*more/);
});

test("mobile Month is a fixed six-row, seven-column overview with compact indicators", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  const styles = fs.readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-toolbar\s*\{[^}]*margin-inline:\s*-14px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-grid\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);[^}]*grid-template-rows:\s*repeat\(6,\s*54px\)/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-weekdays\s*\{[^}]*display:\s*grid/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-day-events\s*\{[^}]*display:\s*none/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-day-indicators\s*\{[^}]*display:\s*flex/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.calendar-day-number\s*\{[^}]*width:\s*min\(44px,\s*100%\);\s*height:\s*44px;/);
  assert.match(component, /const visibleIndicators = indicators\.slice\(0, 3\)/);
  assert.match(component, /calendar-indicator-overflow/);
  assert.match(component, /data-calendar-month-grid/);
});

test("Calendar exposes one contextual Add action and keeps the editor out of the layout until opened", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/hq-calendar.tsx", import.meta.url)), "utf8");
  assert.match(component, /editorOpen \? <section className="calendar-add-panel panel"/);
  assert.doesNotMatch(component, /calendar-entry-panel-heading/);
  assert.match(component, /calendar-empty-day"><p>No entries for this date\.<\/p><\/div>/);
  assert.doesNotMatch(component, /calendar-empty-day[\s\S]{0,180}Add entry/);
});
