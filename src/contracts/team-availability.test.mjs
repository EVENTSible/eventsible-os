import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { availabilityDateKeys, detectScheduleConflicts, localDateTimeToIso, operationalConflictWindow } from "../lib/team-availability.mjs";

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
  const touching = [{ id: "touching", teamMemberId: "member-a", allDay: false, startsAt: "2026-09-10T22:00:00Z", endsAt: "2026-09-10T23:00:00Z" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: touching, visibleTeamMemberId: "member-a" }).length, 0);
  const overlapping = [{ ...touching[0], id: "overlap", startsAt: "2026-09-10T21:59:00Z" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: overlapping, visibleTeamMemberId: "member-a" }).length, 1);
  const allDay = [{ id: "day", teamMemberId: "member-a", allDay: true, startsOn: "2026-09-10", endsOn: "2026-09-10" }];
  assert.equal(detectScheduleConflicts({ events, assignments, availability: allDay, visibleTeamMemberId: "member-a" }).length, 1);
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
  const sql = await read("supabase/migrations/20260908045800_team_availability_calendar_phase_1.sql");
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
});

test("calendar UI retains canonical routes and offers master, personal, filters, and assignment controls", async () => {
  const component = await read("src/components/hq-calendar.tsx");
  for (const label of ["Master calendar", "My schedule", "Add availability", "Outside booking", "Vacation / time off", "Staff assignments", "No booked event"]) assert.match(component, new RegExp(label));
  assert.match(component, /href=\{`\/admin\/gigs\/\$\{event\.id\}`\}/);
  assert.match(component, /Personal entries never create a lead, contact, booking, or EVENTSible event/);
});
