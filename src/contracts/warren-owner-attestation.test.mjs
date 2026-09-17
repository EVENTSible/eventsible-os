import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration=readFileSync("supabase/migrations/20260917172431_warren_owner_attestation_promotion.sql","utf8");
const actions=readFileSync("src/app/admin/data-readiness/actions.ts","utf8");
const workspace=readFileSync("src/components/records-intake-workspace.tsx","utf8");

test("bounded promotion pins the exact candidate without committing private contact data",()=>{
  assert.match(migration,/15ce422a-18e3-4a53-a005-2e5a919be572/);
  assert.match(migration,/expected_phone_hash/);
  assert.match(migration,/expected_contact_name_hash/);
  assert.doesNotMatch(migration,/Dorthy|Williams|15742741194|\(574\)\s*274-1194/);
  assert.match(migration,/p_contact_display_name/);
  assert.match(migration,/p_normalized_phone/);
  assert.match(migration,/Contact does not match reviewed Owner attestation/);
});

test("preview and apply preserve the exact Owner-attested noncommercial boundaries",()=>{
  assert.match(migration,/Warren’s 70th Birthday/);
  assert.match(migration,/2026-09-26T21:00:00Z/);
  assert.match(migration,/2026-09-27T02:00:00Z/);
  assert.match(migration,/America\/Indiana\/Indianapolis/);
  assert.match(migration,/Wingate by Wyndham/);
  assert.match(migration,/total_amount,deposit_amount,balance_due/);
  assert.match(migration,/300\.00,null,300\.00/);
  assert.match(migration,/serviceLinesCreated',0/);
  assert.match(migration,/paymentFactsCreated',0/);
  assert.doesNotMatch(migration,/insert into public\.os_(booking_services|booking_payment_facts|staff_assignments|import_source_provenance|notification_deliveries|integration_outbox|automation_outbox)/i);
});

test("promotion is Owner-only, atomic, fingerprinted, idempotent, and compensatable",()=>{
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/os_has_hq_capability\('data\.readiness\.manage'\)/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/private\.os_warren_owner_attestation_fingerprint\(\)/);
  assert.match(migration,/status','replayed'/);
  assert.match(migration,/COMPENSATE WARREN OWNER ATTESTATION/);
  assert.match(migration,/set status='archived'/);
  assert.doesNotMatch(migration,/delete\s+from/i);
  assert.match(migration,/security definer[\s\S]*set search_path = ''/i);
  assert.match(migration,/revoke all on function public\.os_apply_warren_owner_attestation\(text,text,text,text\) from public, anon, authenticated/);
});

test("Owner UI requires preview fingerprint, private phone entry, and exact confirmation",()=>{
  assert.match(actions,/os_preview_warren_owner_attestation/);
  assert.match(actions,/os_apply_warren_owner_attestation/);
  assert.match(actions,/os_compensate_warren_owner_attestation/);
  assert.match(workspace,/Preview exact promotion/);
  assert.match(workspace,/Owner-confirmed contact name/);
  assert.match(workspace,/Owner-confirmed normalized phone/);
  assert.match(workspace,/PROMOTE WARREN OWNER ATTESTATION/);
  assert.match(workspace,/No services, payments, staff, notifications, or outbox work are created/);
});
