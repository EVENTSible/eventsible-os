import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildExistingGigMatchEvidence,
  buildManualExistingGigProposal,
  eventLocalDateTimeToIso,
  EXISTING_GIG_CANDIDATE_VERSION,
} from "../lib/existing-gig-intake.mjs";

const migration = readFileSync(new URL("../../supabase/migrations/20260902172423_existing_gig_intake_foundation.sql", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/admin/imports/actions.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/admin/imports/page.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/existing-gig-import-review.tsx", import.meta.url), "utf8");
const schemaDdl = migration.split("create function public.os_import_existing_gig")[0];
const authenticatedUpdateGrant = migration.match(/grant update \([^]*?\) on table public\.os_event_import_candidates to authenticated;/i)?.[0] ?? "";

function validInput(overrides = {}) {
  return {
    event_title: "TEST ONLY / DO NOT CONTACT Intake",
    event_type: "Synthetic Event",
    event_date: "2026-09-19",
    start_time: "18:00",
    end_time: "22:00",
    timezone: "America/Indiana/Indianapolis",
    venue_name: "Test Hall",
    venue_address_1: "100 Test Way",
    venue_city: "South Bend",
    venue_state: "IN",
    venue_postal_code: "46601",
    contact_mode: "reuse",
    contact_id: "11111111-1111-4111-8111-111111111111",
    contact_display_name: "",
    contact_email: "",
    contact_phone: "",
    service_ids: ["22222222-2222-4222-8222-222222222222"],
    booked_amount: "1250",
    notes: "Synthetic reviewed intake.",
    ...overrides,
  };
}

test("manual proposal preserves event-local time and emits the bounded v1 contract", () => {
  assert.equal(eventLocalDateTimeToIso("2026-09-19", "18:00", "America/Indiana/Indianapolis"), "2026-09-19T22:00:00.000Z");
  const built = buildManualExistingGigProposal(validInput());
  assert.deepEqual(built.errors, {});
  assert.equal(built.proposal.event.starts_at, "2026-09-19T22:00:00.000Z");
  assert.equal(built.proposal.contact.mode, "reuse");
  assert.deepEqual(built.proposal.service_ids, ["22222222-2222-4222-8222-222222222222"]);
  assert.equal(built.proposal.provenance.summary, "Staff-entered existing booked gig.");
  assert.equal(EXISTING_GIG_CANDIDATE_VERSION, "existing_gig_candidate_v1");
  assert.equal("raw_payload" in built.proposal, false);
});

test("manual proposal rejects malformed timing, ambiguous contacts, services, and oversized notes", () => {
  const built = buildManualExistingGigProposal(validInput({
    start_time: "25:00",
    contact_mode: "create",
    contact_display_name: "",
    contact_email: "",
    contact_phone: "",
    service_ids: [],
    notes: "x".repeat(2001),
  }));
  assert.ok(built.errors.start_time);
  assert.ok(built.errors.contact_display_name);
  assert.ok(built.errors.contact_email);
  assert.ok(built.errors.service_ids);
  assert.ok(built.errors.notes);
  assert.equal(built.proposal, null);
});

test("duplicate evidence is deterministic and never auto-merges", () => {
  const proposal = buildManualExistingGigProposal(validInput()).proposal;
  const evidence = buildExistingGigMatchEvidence(proposal, [{
    event_id: "33333333-3333-4333-8333-333333333333",
    title: proposal.event.title,
    event_status: "planning",
    starts_at: proposal.event.starts_at,
    timezone: proposal.event.timezone,
    venue_name: proposal.event.venue_name,
    primary_contact_id: proposal.contact.contact_id,
  }]);
  assert.equal(evidence.match_warnings.length, 1);
  assert.match(evidence.match_warnings[0].reason, /selected contact and start time/i);
  assert.equal(evidence.date_conflicts.length, 1);
  assert.equal("automatic_match" in evidence, false);
});

test("candidate schema is staff-private, bounded, unique, and has no delete capability", () => {
  assert.match(migration, /create table public\.os_event_import_candidates/i);
  assert.match(migration, /unique \(source, external_reference\)/i);
  assert.match(migration, /octet_length\(proposed_data::text\) <= 65536/i);
  assert.match(migration, /review_status in \('pending', 'review_later', 'ignored', 'matched', 'imported'\)/i);
  assert.match(migration, /alter table public\.os_event_import_candidates enable row level security/i);
  assert.match(migration, /for select\s+to authenticated\s+using \(\(select public\.os_is_staff\(\)\)\)/i);
  assert.match(migration, /for insert\s+to authenticated\s+with check[^]*created_by_user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(migration, /create policy[^;]+for delete/i);
  assert.doesNotMatch(migration, /grant delete/i);
});

test("direct staff review cannot claim an imported result", () => {
  assert.match(migration, /grant update \([^]*review_status[^]*matched_event_id[^]*updated_at[^]*\) on table public\.os_event_import_candidates to authenticated/i);
  assert.doesNotMatch(authenticatedUpdateGrant, /imported_event_id|imported_contact_id|imported_booking_id/i);
  assert.match(migration, /review_status in \('pending', 'review_later', 'ignored', 'matched'\)/i);
  assert.match(actions, /\.neq\("review_status", "imported"\)/);
});

test("import RPC is fixed, authenticated, staff-only, and internally derives the actor", () => {
  assert.match(migration, /create function public\.os_import_existing_gig\(p_candidate_id uuid\)/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /v_actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /if not public\.os_is_staff\(\)/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /revoke all on function public\.os_import_existing_gig\(uuid\)\s+from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.os_import_existing_gig\(uuid\)\s+to authenticated/i);
  assert.doesNotMatch(migration, /p_actor|actor_user_id uuid\s*[,)]/i);
});

test("RPC validates fixed event/contact/service semantics and cannot accept arbitrary business JSON", () => {
  assert.match(migration, /supplied_key not in \([^]*'event'[^]*'contact'[^]*'service_ids'/i);
  assert.match(migration, /supplied_key not in \([^]*'title'[^]*'event_type'[^]*'starts_at'/i);
  assert.match(migration, /v_contact_mode = 'reuse'/i);
  assert.match(migration, /v_contact_mode = 'create'/i);
  assert.match(migration, /from public\.os_service_catalog catalog[^]*where catalog\.is_active/i);
  assert.doesNotMatch(migration, /os_builder_submissions|os_leads|os_quote_versions|os_quote_items/i);
});

test("RPC creates services before confirmation so canonical bootstrap observes them atomically", () => {
  const pendingInsert = migration.indexOf("insert into public.os_bookings");
  const serviceInsert = migration.indexOf("insert into public.os_booking_services");
  const confirmation = migration.indexOf("set status = 'confirmed'");
  const candidateImported = migration.indexOf("set review_status = 'imported'");
  const activity = migration.indexOf("'event.existing_gig_imported'");
  assert.ok(pendingInsert > 0 && serviceInsert > pendingInsert && confirmation > serviceInsert && candidateImported > confirmation && activity > candidateImported);
  assert.match(migration, /insert into public\.os_bookings[^]*'pending'[^]*insert into public\.os_booking_services[^]*update public\.os_bookings[^]*'confirmed'/i);
  assert.match(migration, /idempotency_key[^]*'candidate:' \|\| v_candidate\.id::text \|\| ':existing-gig-imported'/i);
});

test("replay returns stable canonical IDs without duplicate inserts", () => {
  assert.match(migration, /if v_candidate\.review_status = 'imported' then\s+return jsonb_build_object\([^]*'status', 'replayed'[^]*'contact_id', v_candidate\.imported_contact_id[^]*'event_id', v_candidate\.imported_event_id[^]*'booking_id', v_candidate\.imported_booking_id/i);
  assert.match(migration, /where id = p_candidate_id\s+for update/i);
  assert.match(actions, /\["imported", "replayed"\]/);
});

test("protected Import Review UI exposes decisions without raw JSON or direct gig writes", () => {
  assert.match(page, /if \(!user\) redirect\("\/login"\)/);
  assert.match(page, /if \(!isStaffRole\(role\)\) redirect\("\/login\?error=access"\)/);
  assert.match(component, /Import as New Gig/);
  assert.match(component, /Match Existing/);
  assert.match(component, /Review Later/);
  assert.match(component, /Ignore \/ Skip/);
  assert.match(component, /creates a staff-private candidate only/i);
  assert.doesNotMatch(component, /JSON\.stringify\(candidate\.proposed_data/);
  assert.doesNotMatch(actions, /from\("os_events"\)\.insert|from\("os_bookings"\)\.insert|createAdminSupabase|SERVICE_ROLE/);
});

test("migration rollback is narrow and contains no backfill or unrelated table changes", () => {
  assert.doesNotMatch(schemaDdl, /alter table public\.(os_events|os_contacts|os_bookings|os_booking_services|os_activity_events)/i);
  assert.doesNotMatch(schemaDdl, /delete from|truncate|drop table public\.(os_events|os_contacts|os_bookings|os_booking_services)/i);
  assert.doesNotMatch(schemaDdl, /update public\.(os_events|os_contacts|os_bookings|os_booking_services)\s+set/i);
});
