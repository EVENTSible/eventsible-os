import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  contactDisplayName,
  dayOfContactOption,
  dayOfContactRelationshipLabel,
  dayOfContactRpcArgs,
  dayOfContactRpcError,
  resolveDayOfContact,
} from "../lib/day-of-contact.mjs";
import { buildGigReadiness, READINESS_STATES } from "../lib/gig-readiness.mjs";

const EVENT_ID = "00000000-0000-4000-8000-000000000301";
const PRIMARY_ID = "00000000-0000-4000-8000-000000000302";
const DAY_OF_ID = "00000000-0000-4000-8000-000000000303";
const MIGRATION = new URL("../../supabase/migrations/20260902004322_day_of_contact_relationship_rpc.sql", import.meta.url);

test("canonical contact name and phone take precedence over legacy metadata", () => {
  const result = resolveDayOfContact({
    event: { primary_contact_id: PRIMARY_ID, day_of_contact_id: DAY_OF_ID },
    primaryContact: { id: PRIMARY_ID },
    dayOfContact: { id: DAY_OF_ID, display_name: "QA Day-Of", primary_phone: "317-555-0100" },
    legacyName: "Legacy Name",
    legacyPhone: "Legacy Phone",
  });
  assert.deepEqual(result, {
    id: DAY_OF_ID,
    name: "QA Day-Of",
    phone: "317-555-0100",
    relationship: "different",
    source: "canonical",
    isCanonical: true,
  });
});

test("same-as-primary is derived only from canonical contact IDs", () => {
  const same = resolveDayOfContact({
    event: { primary_contact_id: PRIMARY_ID, day_of_contact_id: PRIMARY_ID },
    primaryContact: { id: PRIMARY_ID, display_name: "Primary Client", primary_phone: "317-555-0111" },
    dayOfContact: { id: PRIMARY_ID, display_name: "Primary Client", primary_phone: "317-555-0111" },
  });
  assert.equal(same.relationship, "same");
  assert.equal(dayOfContactRelationshipLabel(same.relationship), "Same as primary client");
  assert.equal(dayOfContactRelationshipLabel("different"), "Different from primary client");
});

test("null canonical relationship remains not provided while legacy values stay readable", () => {
  const legacy = resolveDayOfContact({ event: { primary_contact_id: PRIMARY_ID }, legacyName: "Legacy Coordinator", legacyPhone: "317-555-0199" });
  assert.equal(legacy.isCanonical, false);
  assert.equal(legacy.relationship, "not_provided");
  assert.equal(legacy.source, "legacy");
  assert.equal(legacy.name, "Legacy Coordinator");
  const missing = resolveDayOfContact({ event: { primary_contact_id: PRIMARY_ID } });
  assert.equal(missing.name, null);
  assert.equal(dayOfContactRelationshipLabel(missing.relationship), "Not provided");
});

test("canonical relationship resolves readiness without changing the five-state model", () => {
  const readiness = buildGigReadiness({ operational: { dayOfContactId: DAY_OF_ID } });
  assert.equal(readiness.checks.find((check) => check.id === "day-of-contact").state, READINESS_STATES.READY);
  assert.equal(readiness.checks.find((check) => check.id === "staffing").state, READINESS_STATES.UNKNOWN);
  assert.equal("percentage" in readiness, false);
});

test("contact selector exposes only canonical IDs and staff-facing labels", () => {
  assert.equal(contactDisplayName({ first_name: "QA", last_name: "Helper" }), "QA Helper");
  assert.deepEqual(dayOfContactOption({ id: PRIMARY_ID, display_name: "Primary Client", organization_name: "QA Org" }, PRIMARY_ID), {
    id: PRIMARY_ID,
    label: "Primary Client · QA Org · Primary client",
    isPrimary: true,
  });
});

test("RPC arguments require canonical UUIDs and expose only the fixed relationship", () => {
  assert.deepEqual(dayOfContactRpcArgs(EVENT_ID, DAY_OF_ID), { p_event_id: EVENT_ID, p_day_of_contact_id: DAY_OF_ID });
  assert.throws(() => dayOfContactRpcArgs(EVENT_ID, "not-a-contact"), /canonical event and existing contact/i);
  assert.throws(() => dayOfContactRpcArgs("not-an-event", DAY_OF_ID), /canonical event and existing contact/i);
});

test("RPC errors map to controlled messages", () => {
  assert.match(dayOfContactRpcError({ code: "28000" }), /not authorized/i);
  assert.match(dayOfContactRpcError({ code: "42501" }), /not authorized/i);
  assert.match(dayOfContactRpcError({ code: "23503" }), /active existing contact/i);
  assert.match(dayOfContactRpcError({ code: "P0002" }), /could not be found/i);
  assert.match(dayOfContactRpcError({ code: "XX000" }), /nothing was changed/i);
});

test("Server Action uses the authenticated client and fixed RPC without metadata or service-role writes", async () => {
  const source = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const action = source.slice(source.indexOf("export async function updateDayOfContactAction"), source.indexOf("export async function activateWeddingCompanionAction"));
  assert.match(action, /requireStaffSupabase\(\)/);
  assert.match(action, /dayOfContactRpcArgs\(eventId, contactId\)/);
  assert.match(action, /supabase\.rpc\("os_update_event_day_of_contact", rpcArgs\)/);
  assert.match(action, /dayOfContactRpcError\(rpcResult\.error\)/);
  assert.match(action, /revalidatePath\(`\/admin\/gigs\/\$\{eventId\}`\)/);
  assert.doesNotMatch(action, /createAdminSupabase|SUPABASE_SERVICE_ROLE_KEY|metadata|recordActivity\(|\.from\("os_events"\)\.update/s);
});

test("protected Gig Workspace resolves the canonical contact and keeps selector data minimal", async () => {
  const source = await readFile(new URL("../app/admin/gigs/[eventId]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!authData\.user\) redirect\("\/login"\)/);
  assert.match(source, /if \(!isStaffRole/);
  assert.match(source, /primary_contact_id,day_of_contact_id/);
  assert.match(source, /eq\("id", event\.day_of_contact_id\)/);
  assert.match(source, /select\("id,display_name,first_name,last_name,organization_name"\).*eq\("status", "active"\)/s);
  assert.match(source, /resolveDayOfContact/);
  assert.match(source, /DayOfContactEditor/);
  const selectorQuery = source.match(/supabase\.from\("os_contacts"\)\.select\("id,display_name,first_name,last_name,organization_name"\)[^\n]+/)?.[0] ?? "";
  assert.doesNotMatch(selectorQuery, /primary_phone|primary_email/);
});

test("editor selects existing contacts, supports the primary shortcut, Save, and Cancel without contact creation", async () => {
  const source = await readFile(new URL("../components/day-of-contact-editor.tsx", import.meta.url), "utf8");
  assert.match(source, /name="day_of_contact_id"/);
  assert.match(source, /Choose an existing contact/);
  assert.match(source, /Use Primary Client as Day-Of Contact/);
  assert.match(source, /Save day-of contact/);
  assert.match(source, /Cancel/);
  assert.doesNotMatch(source, /name="(display_name|primary_phone|primary_email)"|Create contact|sign.?up/i);
});

test("migration adds only the nullable FK relationship, index, and fixed transactional RPC", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /alter table public\.os_events\s+add column day_of_contact_id uuid;/i);
  assert.match(sql, /constraint os_events_day_of_contact_id_fkey[^]*references public\.os_contacts\(id\)[^]*on delete set null/i);
  assert.match(sql, /create index os_events_day_of_contact_idx\s+on public\.os_events \(day_of_contact_id\)/i);
  assert.match(sql, /create function public\.os_update_event_day_of_contact\(\s*p_event_id uuid,\s*p_day_of_contact_id uuid\s*\)/i);
  assert.match(sql, /security definer[^]*set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /public\.os_is_staff\(\)/i);
  assert.match(sql, /public\.os_has_event_access\(p_event_id\)/i);
  assert.match(sql, /from public\.os_events[^]*for update/i);
  assert.match(sql, /from public\.os_contacts[^]*id = p_day_of_contact_id[^]*status = 'active'/i);
  assert.match(sql, /update public\.os_events\s+set day_of_contact_id = p_day_of_contact_id/i);
  assert.match(sql, /event\.day_of_contact_updated/i);
  assert.match(sql, /revoke all on function[^]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[^]*to authenticated/i);
  assert.doesNotMatch(sql, /create policy|alter policy|grant insert|service_role|os_bookings|day_of_contact_name|day_of_contact_phone/i);
  assert.doesNotMatch(sql, /\b(delete from|truncate|drop table|update public\.os_contacts|insert into public\.os_contacts)\b/i);
});

test("migration enforces no-op and one atomic activity without caller-controlled actor or clearing", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /p_day_of_contact_id is null[^]*raise exception/i);
  assert.match(sql, /v_current_contact_id = p_day_of_contact_id[^]*'status', 'noop'/i);
  assert.equal((sql.match(/update public\.os_events/gi) ?? []).length, 1);
  assert.equal((sql.match(/insert into public\.os_activity_events/gi) ?? []).length, 1);
  assert.match(sql, /actor_user_id[^]*v_actor_user_id/i);
  assert.match(sql, /visibility[^]*'staff'/i);
  assert.doesNotMatch(sql, /p_actor|p_visibility|p_payload|set day_of_contact_id = null/i);
});
