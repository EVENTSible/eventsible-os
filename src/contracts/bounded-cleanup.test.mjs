import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read=(path)=>fs.readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const migration=read("../../supabase/migrations/20260910185316_hq_bounded_cleanup_and_records_intake.sql");
const actions=read("../app/admin/data-readiness/actions.ts");
const page=read("../app/admin/data-readiness/page.tsx");
const workspace=read("../components/records-intake-workspace.tsx");
const dashboard=read("../app/admin/page.tsx");
const calendar=read("../app/admin/calendar/page.tsx");

test("cleanup executor accepts only the exact reviewed manifest and protected item set",()=>{
  assert.match(migration,/os_cleanup_manifest_scopes/);
  assert.match(migration,/91dce9c0177ef89406ab70624b97fb0cf95bb4e1613c34baee56ade803c8d109/);
  assert.match(migration,/contact_count = 17 and lead_count = 25 and event_count = 26/);
  assert.match(migration,/integration_outbox_count = 21 and automation_outbox_count = 36/);
  assert.match(migration,/os_contact_users cu where cu\.contact_id = any\(v_contact_ids\)/);
  assert.match(migration,/Unresolved outbox work cannot be quarantined/);
  assert.doesNotMatch(migration,/@(?:example|gmail)\.|574-\d{3}-\d{4}/i);
});

test("cleanup operations are atomic, idempotent, reversible, and never delete or replay",()=>{
  for(const name of ["os_execute_cleanup_customer_archive","os_restore_cleanup_customer_archive","os_execute_cleanup_outbox_quarantine","os_restore_cleanup_outbox_quarantine"]) assert.match(migration,new RegExp(`function public\\.${name}`));
  assert.match(migration,/already_archived/);
  assert.match(migration,/already_quarantined/);
  assert.match(migration,/prior_state=jsonb_build_object\('status'/);
  assert.match(migration,/status='quarantined'/);
  assert.doesNotMatch(migration,/\bdelete\s+from\b/i);
  assert.doesNotMatch(migration,/dispatch|replay/i);
});

test("cleanup tables and RPCs are default-deny and Owner checked",()=>{
  assert.match(migration,/enable row level security/g);
  assert.match(migration,/revoke all on table public\.os_cleanup_manifest_scopes, public\.os_cleanup_batches, public\.os_cleanup_batch_items from public, anon, authenticated/);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/os_has_hq_capability\('data\.readiness\.manage'\)/);
  assert.match(migration,/security definer set search_path = ''/g);
  assert.match(migration,/revoke all on function public\.os_preview_cleanup_manifest\(text\) from public, anon, authenticated/);
  assert.match(actions,/authorizeHqCapability\("data\.readiness\.manage"\)/);
  assert.doesNotMatch(actions,/service.role|createAdminSupabase/i);
});

test("cleanup audit actor foreign keys have supporting indexes",()=>{
  for(const name of ["os_cleanup_batch_items_applied_by_idx","os_cleanup_batch_items_restored_by_idx","os_cleanup_batches_customer_applied_by_idx","os_cleanup_batches_customer_restored_by_idx","os_cleanup_batches_outbox_applied_by_idx","os_cleanup_batches_outbox_restored_by_idx"]) assert.match(migration,new RegExp(`create index ${name}`));
});

test("normal HQ surfaces hide archived records and explicit history remains Owner-only",()=>{
  assert.match(migration,/where e\.status<>'archived' and coalesce\(c\.status,'active'\)<>'archived'/);
  assert.match(migration,/create or replace function public\.os_has_event_access[\s\S]*?e\.status<>'archived'/);
  assert.match(migration,/create or replace function public\.os_has_contact_access[\s\S]*?c\.status<>'archived'/);
  assert.match(migration,/create or replace function public\.os_has_assignment_access[\s\S]*?e\.status<>'archived'/);
  assert.match(dashboard,/from\("os_leads"\)[\s\S]*?neq\("status", "archived"\)/);
  assert.match(dashboard,/from\("os_contacts"\)[\s\S]*?neq\("status", "archived"\)/);
  assert.match(calendar,/from\("os_events"\)\.select\("id,settings"\)\.neq\("status", "archived"\)/);
  assert.match(page,/hasHqCapability\(role,"data\.readiness\.manage"\)/);
});

test("Records & Intake is search-first, bounded, responsive, and keeps one editor open",()=>{
  assert.match(workspace,/Records &amp; Intake/);
  assert.match(workspace,/Reviewed Intake/);
  assert.match(workspace,/Search names, titles, source/);
  assert.match(workspace,/<option key=\{value\} value=\{value\}>\{value\.replaceAll\("_"," "\)\}<\/option>/);
  assert.match(workspace,/slice\(safePage\*10,safePage\*10\+10\)/);
  assert.match(workspace,/record-editor-backdrop/);
  assert.match(workspace,/aria-modal="true"/);
  assert.match(workspace,/cleanupEnabled/);
  assert.match(workspace,/Archived/);
  assert.match(workspace,/Advanced details/);
});
