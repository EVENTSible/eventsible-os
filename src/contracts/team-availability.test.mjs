import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TEAM_AVAILABILITY_TYPES, availabilityDateKeys, availabilityPrivacyDefault, availabilityTypeLabel, detectScheduleConflicts, isBlockingAvailability, localDateTimeToIso, operationalConflictWindow } from "../lib/team-availability.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

test("all-day ranges include every occupied date", () => {
  assert.deepEqual(availabilityDateKeys({ allDay: true, startsOn: "2026-09-10", endsOn: "2026-09-12" }), ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

test("conflicts use half-open boundaries and include all-day blocks", () => {
  const events = [{ id: "event-a", startsAt: "2026-09-10T18:00:00Z", endsAt: "2026-09-10T22:00:00Z" }];
  const assignments = [
    { id: "assignment-a", eventId: "event-a", teamMemberId: "member-a", callTime: "2026-09-10T17:00:00Z" },
  ];
  const touching = [{ id: "touching", teamMemberId: "member-a", entryType: "unavailable", allDay: false, startsAt: "2026-09-10T22:00:00Z", endsAt: "2026-09-10T23:00:00Z" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: touching, visibleTeamMemberId: "member-a" }).length, 0);
  const overlapping = [{ ...touching[0], id: "overlap", startsAt: "2026-09-10T21:59:00Z" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: overlapping, visibleTeamMemberId: "member-a" }).length, 1);
  const allDay = [{ id: "day", teamMemberId: "member-a", entryType: "unavailable", allDay: true, startsOn: "2026-09-10", endsOn: "2026-09-10" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: allDay, visibleTeamMemberId: "member-a" }).length, 1);
});

test("only unavailable, outside booking, and vacation entries block schedules", () => {
  assert.deepEqual(TEAM_AVAILABILITY_TYPES, ["available", "unavailable", "outside_booking", "vacation", "reminder", "note"]);
  for (const entryType of ["unavailable", "outside_booking", "vacation"]) assert.equal(isBlockingAvailability({ entryType }), true);
  for (const entryType of ["available", "reminder", "note"]) assert.equal(isBlockingAvailability({ entryType }), false);

  const events = [{ id: "event-a", startsAt: "2026-09-10T18:00:00Z", endsAt: "2026-09-10T22:00:00Z" }];
  const assignments = [{ id: "assignment-a", eventId: "event-a", teamMemberId: "member-a" }];
  const window = { teamMemberId: "member-a", allDay: false, startsAt: "2026-09-10T19:00:00Z", endsAt: "2026-09-10T20:00:00Z" };
  for (const entryType of ["available", "reminder", "note"]) {
    assert.equal(detectScheduleConflicts({ events, assignments, availability: [{ ...window, id: entryType, entryType }], visibleTeamMemberId: "member-a" }).length, 0);
  }
  assert.equal(detectScheduleConflicts({ events, assignments, availability: [{ ...window, id: "unavailable", entryType: "unavailable" }], visibleTeamMemberId: "member-a" }).length, 1);
});

test("entry labels and privacy defaults match the calendar contract", () => {
  assert.equal(availabilityPrivacyDefault("available"), "team_details");
  assert.equal(availabilityPrivacyDefault("reminder"), "private");
  assert.equal(availabilityPrivacyDefault("note"), "private");
  assert.equal(availabilityPrivacyDefault("outside_booking"), "busy_only");
  assert.equal(availabilityTypeLabel("note"), "Note / idea");
});

test("non-owners receive only conflicts involving their own schedule", () => {
  const events = [
    { id: "one", startsAt: "2026-09-10T18:00:00Z", endsAt: "2026-09-10T20:00:00Z" },
    { id: "two", startsAt: "2026-09-10T19:00:00Z", endsAt: "2026-09-10T21:00:00Z" },
  ];
  const assignments = [
    { id: "a", eventId: "one", teamMemberId: "other" },
    { id: "b", eventId: "two", teamMemberId: "other" },
  ];
  assert.equal(detectScheduleConflicts({ events, assignments, visibleTeamMemberId: "self", canViewAll: false }).length, 0);
  assert.equal(detectScheduleConflicts({ events, assignments, visibleTeamMemberId: "self", canViewAll: true }).length, 1);
});

test("local time conversion and operational windows preserve canonical timezones", () => {
  assert.equal(localDateTimeToIso("2026-09-10T18:00", "America/Indiana/Indianapolis"), "2026-09-10T22:00:00.000Z");
  const event = { id: "event-a", dateKey: "2026-09-10", startsAt: "2026-09-10T22:00:00Z", endsAt: "2026-09-11T02:00:00Z", timezone: "America/Indiana/Indianapolis" };
  const window = operationalConflictWindow(event, { setup_start: "16:00", must_be_out: "23:30" }, []);
  assert.equal(window.conflictStartsAt, "2026-09-10T20:00:00.000Z");
  assert.equal(window.conflictEndsAt, "2026-09-11T03:30:00.000Z");
});

test("migration keeps private schedule tables off direct browser access and exposes bounded RPCs", async () => {
  const sql = await read("supabase/migrations/20260908124113_team_availability_calendar_phase_1.sql");
  const correction = await read("supabase/migrations/20260908133323_team_calendar_entry_controls.sql");
  for (const table of ["os_team_members", "os_team_availability", "os_staff_assignments"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /auth\.uid\(\)/);
  assert.doesNotMatch(sql, /user_metadata/);
  assert.match(sql, /case when a\.team_member_id = v_self_member_id then a\.private_notes else null end/);
  assert.match(sql, /when a\.privacy = 'team_details' then a\.title/);
  assert.match(sql, /when a\.team_member_id = v_self_member_id or a\.privacy = 'team_details' then a\.entry_type[^]*else 'unavailable'/);
  assert.match(sql, /when a\.team_member_id = v_self_member_id then a\.privacy[^]*else 'busy_only'/);
  assert.match(sql, /v_entry_type := v_existing\.entry_type/);
  assert.match(sql, /v_privacy := v_existing\.privacy/);
  assert.match(sql, /'canRemove', a\.team_member_id = v_self_member_id/);
  assert.match(sql, /Only your own schedule may be changed/);
  assert.match(sql, /schedule\.assignments\.manage/);
  assert.doesNotMatch(sql, /references public\.os_(contacts|leads|bookings|quote_versions)/);
  assert.match(correction, /check \(entry_type in \('available', 'unavailable', 'outside_booking', 'vacation', 'reminder', 'note'\)\)/);
  assert.match(correction, /security definer[^]*set search_path = ''/);
  assert.match(correction, /auth\.uid\(\)/);
  assert.match(correction, /a\.entry_type in \('unavailable', 'outside_booking', 'vacation'\)/);
  assert.match(correction, /revoke all on function public\.os_upsert_team_availability\(uuid, uuid, jsonb\) from public, anon, authenticated/);
  assert.doesNotMatch(correction, /user_metadata|delete from|truncate|service_role/);
});

test("calendar UI retains canonical routes and offers master, personal, filters, and assignment controls", async () => {
  const component = await read("src/components/hq-calendar.tsx");
  for (const label of ["Master calendar", "My schedule", "Add calendar entry", "Available", "Unavailable", "Outside booking", "Vacation / time off", "Reminder", "Note / idea", "Staff assignments", "No booked event"]) assert.match(component, new RegExp(label));
  assert.match(component, /href=\{`\/admin\/gigs\/\$\{event\.id\}`\}/);
  assert.match(component, /Personal entries never create a lead, contact, booking, or EVENTSible event/);
  assert.match(component, /Add calendar entry on/);
  assert.match(component, /View or edit/);
  assert.match(component, /Remove this calendar entry\?/);
  assert.match(component, /type="button" onClick=\{cancelEditor\}>Cancel/);
});
