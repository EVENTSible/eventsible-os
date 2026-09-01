import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildEventDayLogisticsMutation,
  eventDayLogisticsFormValues,
  eventDayLogisticsHasChanges,
  eventDayLogisticsRpcArgs,
  eventDayLogisticsRpcError,
  EVENT_DAY_LOGISTICS_LIMITS,
} from "../lib/event-day-logistics.mjs";
import { buildGigReadiness, extractOperationalDetails, READINESS_STATES } from "../lib/gig-readiness.mjs";

const EVENT_ID = "00000000-0000-4000-8000-000000000201";
const MIGRATION = new URL("../../supabase/migrations/20260901184836_event_day_logistics_rpc.sql", import.meta.url);

test("event-day logistics hydrates current values and honest missing states", () => {
  assert.deepEqual(eventDayLogisticsFormValues({}), {
    staff_call_time: "", setup_start: "", room_area: "", load_in_details: "",
  });
  assert.deepEqual(eventDayLogisticsFormValues({
    staffCallTime: "2:30 PM",
    setupStart: "15:00",
    roomArea: " Ballroom A ",
    loadInDetails: " Use west loading dock. ",
  }), {
    staff_call_time: "14:30",
    setup_start: "15:00",
    room_area: "Ballroom A",
    load_in_details: "Use west loading dock.",
  });
});

test("canonical event settings take precedence over read-only legacy fallbacks", () => {
  const operational = extractOperationalDetails({
    event: { settings: { staff_call_time: "14:30", setup_start: "15:00", room_area: "Ballroom A", load_in_details: "West dock" } },
    booking: { metadata: { staff_call_time: "13:00", setup_start: "13:30", room_area: "Legacy Room", load_in_details: "Legacy entrance" } },
  });
  assert.deepEqual(eventDayLogisticsFormValues(operational), {
    staff_call_time: "14:30", setup_start: "15:00", room_area: "Ballroom A", load_in_details: "West dock",
  });
});

test("valid multi-field save normalizes time and whitespace into fixed RPC arguments", () => {
  const mutation = buildEventDayLogisticsMutation({
    submitted: { staff_call_time: "2:30 PM", setup_start: "15:00", room_area: " Ballroom A ", load_in_details: " Use west dock. " },
    currentSettings: { unrelated: "preserve" },
  });
  assert.deepEqual(mutation.errors, {});
  assert.deepEqual(eventDayLogisticsRpcArgs(EVENT_ID, mutation.args), {
    p_event_id: EVENT_ID,
    p_staff_call_time: "14:30",
    p_setup_start: "15:00",
    p_room_area: "Ballroom A",
    p_load_in_details: "Use west dock.",
  });
  assert.equal(eventDayLogisticsHasChanges(mutation.args), true);
});

test("malformed time rejects the whole client-side mutation", () => {
  const mutation = buildEventDayLogisticsMutation({
    submitted: { staff_call_time: "25:90", setup_start: "15:00", room_area: "Ballroom A" },
  });
  assert.match(mutation.errors.staff_call_time, /valid time/i);
  assert.equal(eventDayLogisticsHasChanges(mutation.args), false);
  assert.deepEqual(mutation.changedLabels, []);
});

test("text bounds reject oversized room and load-in values without partial arguments", () => {
  const mutation = buildEventDayLogisticsMutation({
    submitted: {
      staff_call_time: "14:30",
      room_area: "r".repeat(EVENT_DAY_LOGISTICS_LIMITS.roomArea + 1),
      load_in_details: "n".repeat(EVENT_DAY_LOGISTICS_LIMITS.loadInDetails + 1),
    },
  });
  assert.match(mutation.errors.room_area, /160/);
  assert.match(mutation.errors.load_in_details, /1,500/);
  assert.equal(eventDayLogisticsHasChanges(mutation.args), false);
});

test("blank values preserve canonical settings and exact values are no-ops", () => {
  const currentSettings = { staff_call_time: "14:30", setup_start: "15:00", room_area: "Ballroom A", load_in_details: "West dock", unrelated: true };
  const blank = buildEventDayLogisticsMutation({ submitted: { staff_call_time: "", setup_start: "", room_area: "", load_in_details: "" }, currentSettings });
  assert.equal(eventDayLogisticsHasChanges(blank.args), false);
  const same = buildEventDayLogisticsMutation({ submitted: currentSettings, currentSettings });
  assert.equal(eventDayLogisticsHasChanges(same.args), false);
  assert.deepEqual(same.changedLabels, []);
});

test("legacy-only values are promoted to canonical settings on an intentional save", () => {
  const mutation = buildEventDayLogisticsMutation({ submitted: { room_area: "Legacy Room" }, currentSettings: {} });
  assert.equal(mutation.args.p_room_area, "Legacy Room");
});

test("RPC errors map to controlled staff-facing messages", () => {
  assert.match(eventDayLogisticsRpcError({ code: "28000" }), /not authorized/i);
  assert.match(eventDayLogisticsRpcError({ code: "42501" }), /not authorized/i);
  assert.match(eventDayLogisticsRpcError({ code: "22023" }), /nothing was saved/i);
  assert.match(eventDayLogisticsRpcError({ code: "P0002" }), /could not be found/i);
  assert.match(eventDayLogisticsRpcError({ code: "XX000" }), /nothing was changed/i);
});

test("new logistics fields do not broaden readiness or count Unknown as Ready", () => {
  const operational = extractOperationalDetails({ event: { settings: { staff_call_time: "14:30", setup_start: "15:00", room_area: "Ballroom A", load_in_details: "West dock" } } });
  const readiness = buildGigReadiness({ operational });
  assert.equal(readiness.checks.find((check) => check.id === "operations-times").state, READINESS_STATES.UNKNOWN);
  assert.equal(readiness.checks.find((check) => check.id === "staffing").state, READINESS_STATES.UNKNOWN);
  assert.equal("percentage" in readiness, false);
});

test("Server Action uses authenticated client, canonical event, and fixed logistics RPC", async () => {
  const source = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const action = source.slice(source.indexOf("export async function updateEventDayLogisticsAction"), source.indexOf("export async function activateWeddingCompanionAction"));
  assert.match(action, /requireStaffSupabase\(\)/);
  assert.match(action, /from\("os_events"\).*eq\("id", eventId\)/s);
  assert.match(action, /supabase\.rpc\("os_update_event_day_logistics", eventDayLogisticsRpcArgs\(eventId, mutation\.args\)\)/);
  assert.match(action, /eventDayLogisticsRpcError\(rpcResult\.error\)/);
  assert.match(action, /revalidatePath\(`\/admin\/gigs\/\$\{eventId\}`\)/);
  assert.doesNotMatch(action, /createAdminSupabase|SUPABASE_SERVICE_ROLE_KEY|os_bookings.*update|recordActivity\(/s);
});

test("editor exposes bounded fixed fields, Save, Cancel, and no signup or arbitrary JSON", async () => {
  const source = await readFile(new URL("../components/event-day-logistics-editor.tsx", import.meta.url), "utf8");
  for (const field of ["staff_call_time", "setup_start", "room_area", "load_in_details"]) assert.match(source, new RegExp(`name=\\"${field}\\"`));
  assert.match(source, /maxLength=\{160\}/);
  assert.match(source, /maxLength=\{1500\}/);
  assert.match(source, /Save logistics/);
  assert.match(source, /Cancel/);
  assert.doesNotMatch(source, /JSON|settings|sign.?up/i);
});

test("migration is one fixed transactional RPC with least-privilege execution", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /create or replace function public\.os_update_event_day_logistics\(\s*p_event_id uuid,\s*p_staff_call_time text[^]*p_setup_start text[^]*p_room_area text[^]*p_load_in_details text/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /public\.os_is_staff\(\)/i);
  assert.match(sql, /public\.os_has_event_access\(p_event_id\)/i);
  assert.match(sql, /from public\.os_events[^]*for update/i);
  assert.match(sql, /v_next_settings := v_current_settings/i);
  for (const key of ["staff_call_time", "setup_start", "room_area", "load_in_details"]) assert.match(sql, new RegExp(`jsonb_set\\(v_next_settings, '\\{${key}\\}'`));
  assert.match(sql, /event\.event_day_logistics_updated/i);
  assert.match(sql, /visibility[^]*'staff'/i);
  assert.match(sql, /revoke all on function[^]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[^]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy|alter policy|grant insert|alter table|drop table|truncate|os_bookings/i);
  assert.doesNotMatch(sql, /p_actor|p_visibility|p_settings|service_role/i);
});

test("migration validates all input before its atomic update and single activity insert", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const updateAt = sql.indexOf("update public.os_events");
  const activityAt = sql.indexOf("insert into public.os_activity_events");
  assert.ok(updateAt > sql.indexOf("char_length(v_load_in_details)"));
  assert.ok(activityAt > updateAt);
  assert.equal((sql.match(/insert into public\.os_activity_events/gi) ?? []).length, 1);
  assert.match(sql, /cardinality\(v_changed_fields\) = 0[^]*return jsonb_build_object\('status', 'noop'/i);
  assert.doesNotMatch(sql, /settings\s*=\s*jsonb_build_object/i);
});
