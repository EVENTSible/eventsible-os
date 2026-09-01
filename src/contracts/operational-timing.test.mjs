import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildGigReadiness, extractOperationalDetails, READINESS_STATES } from "../lib/gig-readiness.mjs";
import {
  buildOperationalTimingMutation,
  formatClockTime,
  formatLoadInWindow,
  operationalTimingFacts,
  operationalTimingFormValues,
  operationalTimingRpcArgs,
  operationalTimingRpcError,
  OPERATIONAL_TIMING_FACT_KEYS,
} from "../lib/operational-timing.mjs";

const EVENT_ID = "00000000-0000-4000-8000-000000000101";
const USER_ID = "00000000-0000-4000-8000-000000000102";

test("operational timing reads only canonical allow-listed event facts", () => {
  const facts = operationalTimingFacts([
    { fact_key: OPERATIONAL_TIMING_FACT_KEYS.arrivalTime, value: "14:30" },
    { fact_key: OPERATIONAL_TIMING_FACT_KEYS.loadInWindow, value: { start: "13:45", end: "14:15" } },
    { fact_key: OPERATIONAL_TIMING_FACT_KEYS.setupComplete, value: "15:00" },
    { fact_key: "builder.full_submission", value: { private: true } },
  ]);
  assert.equal(facts.arrivalTime, "14:30");
  assert.deepEqual(facts.loadInWindow, { start: "13:45", end: "14:15" });
  assert.equal(facts.setupComplete, "15:00");
  assert.equal(JSON.stringify(facts).includes("private"), false);
});

test("missing operational timing renders honestly and hydrates blank inputs", () => {
  assert.equal(formatClockTime(null), "Not provided");
  assert.equal(formatLoadInWindow(null), "Not provided");
  assert.deepEqual(operationalTimingFormValues({}), {
    arrival_time: "", load_in_start: "", load_in_end: "", setup_complete_by: "", breakdown_start: "", must_be_out: "",
  });
});

test("legacy human-readable timing text remains visible without being rewritten", () => {
  assert.equal(formatClockTime("After ceremony"), "After ceremony");
  assert.equal(formatLoadInWindow("3:00–4:00 PM"), "3:00–4:00 PM");
});

test("edit form hydration preserves normalized clock values without timezone conversion", () => {
  assert.deepEqual(operationalTimingFormValues({
    arrivalTime: "2:30 PM",
    loadInWindow: { start: "13:45", end: "14:15" },
    setupComplete: "15:00",
    breakdownStart: "22:00",
    mustBeOut: "23:00",
  }), {
    arrival_time: "14:30", load_in_start: "13:45", load_in_end: "14:15", setup_complete_by: "15:00", breakdown_start: "22:00", must_be_out: "23:00",
  });
});

test("successful save targets the five canonical event fact keys", () => {
  const result = buildOperationalTimingMutation({
    eventId: EVENT_ID,
    userId: USER_ID,
    submitted: { arrival_time: "14:30", load_in_start: "13:45", load_in_end: "14:15", setup_complete_by: "15:00", breakdown_start: "22:00", must_be_out: "23:00" },
    current: {},
  });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(new Set(result.rows.map((row) => row.fact_key)), new Set(Object.values(OPERATIONAL_TIMING_FACT_KEYS)));
  assert.equal(result.rows.every((row) => row.event_id === EVENT_ID && row.updated_by === USER_ID && row.source === "staff"), true);
});

test("malformed time rejects the entire save", () => {
  const result = buildOperationalTimingMutation({ eventId: EVENT_ID, userId: USER_ID, submitted: { arrival_time: "25:90", setup_complete_by: "15:00" }, current: {} });
  assert.match(result.errors.arrival_time, /valid time/i);
  assert.equal(result.rows.length, 0);
});

test("blank inputs preserve existing facts and do not act as clearing", () => {
  const result = buildOperationalTimingMutation({
    eventId: EVENT_ID,
    userId: USER_ID,
    submitted: { arrival_time: "", load_in_start: "", load_in_end: "", setup_complete_by: "", breakdown_start: "", must_be_out: "" },
    current: { arrivalTime: "14:30", loadInWindow: { start: "13:45", end: "14:15" }, setupComplete: "15:00", breakdownStart: "22:00", mustBeOut: "23:00" },
  });
  assert.deepEqual(result, { errors: {}, rows: [], changedLabels: [] });
});

test("no-op save creates no fact rows or activity-worthy changes", () => {
  const current = { arrivalTime: "14:30", loadInWindow: { start: "13:45", end: "14:15" }, setupComplete: "15:00", breakdownStart: "22:00", mustBeOut: "23:00" };
  const result = buildOperationalTimingMutation({ eventId: EVENT_ID, userId: USER_ID, submitted: operationalTimingFormValues(current), current });
  assert.equal(result.rows.length, 0);
  assert.equal(result.changedLabels.length, 0);
});

test("RPC arguments expose only the five fixed operational timing parameters", () => {
  const args = operationalTimingRpcArgs(EVENT_ID, [
    { fact_key: OPERATIONAL_TIMING_FACT_KEYS.arrivalTime, value: "14:30" },
    { fact_key: OPERATIONAL_TIMING_FACT_KEYS.loadInWindow, value: { start: "13:45", end: null } },
  ]);
  assert.deepEqual(args, {
    p_event_id: EVENT_ID,
    p_arrival_time: "14:30",
    p_load_in_window: { start: "13:45", end: null },
    p_setup_complete_by: null,
    p_breakdown_start: null,
    p_must_be_out: null,
  });
  assert.throws(() => operationalTimingRpcArgs(EVENT_ID, [{ fact_key: "event.private_payload", value: "no" }]), /unsupported/i);
});

test("RPC errors become controlled staff-facing action messages", () => {
  assert.match(operationalTimingRpcError({ code: "42501" }), /not authorized/i);
  assert.match(operationalTimingRpcError({ code: "22023" }), /nothing was saved/i);
  assert.match(operationalTimingRpcError({ code: "P0002" }), /could not be found/i);
  assert.match(operationalTimingRpcError({ code: "XX000" }), /nothing was changed/i);
});

test("operational facts refresh the existing readiness check without changing its model", () => {
  const operational = extractOperationalDetails({ facts: [{ fact_key: OPERATIONAL_TIMING_FACT_KEYS.arrivalTime, value: "14:30" }] });
  const readiness = buildGigReadiness({ operational });
  assert.equal(readiness.checks.find((check) => check.id === "operations-times").state, READINESS_STATES.READY);
  assert.equal(readiness.checks.find((check) => check.id === "staffing").state, READINESS_STATES.UNKNOWN);
});

test("server action preserves staff authorization and canonical event targeting", async () => {
  const source = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const action = source.slice(source.indexOf("export async function updateOperationalTimingAction"), source.indexOf("export async function activateWeddingCompanionAction"));
  assert.match(action, /requireStaffSupabase\(\)/);
  assert.match(action, /from\("os_events"\).*eq\("id", eventId\)/s);
  assert.match(action, /supabase\.rpc\("os_update_event_operational_timing", operationalTimingRpcArgs\(eventId, mutation\.rows\)\)/);
  assert.match(action, /operationalTimingRpcError\(rpcResult\.error\)/);
  assert.match(action, /revalidatePath\(`\/admin\/gigs\/\$\{eventId\}`\)/);
  assert.doesNotMatch(action, /createAdminSupabase|SUPABASE_SERVICE_ROLE_KEY|from\("os_event_facts"\)\.upsert|recordActivity\(/);
});

test("migration defines one narrow transactional staff RPC without general activity RLS", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260901173856_event_operational_timing_rpc.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.os_update_event_operational_timing\(/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /public\.os_is_staff\(\)/i);
  assert.match(sql, /public\.os_has_event_access\(p_event_id\)/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /event\.operational_timing_updated/i);
  assert.match(sql, /visibility[\s\S]*'staff'/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy|alter policy|grant insert|service_role/i);
  assert.doesNotMatch(sql, /\b(delete|truncate|drop table|alter table)\b/i);
});
