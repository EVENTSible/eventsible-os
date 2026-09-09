import { execFileSync, spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dockerBin = process.env.EVENTSIBLE_DOCKER_BIN;
const container = process.env.EVENTSIBLE_SUPABASE_DB_CONTAINER ?? "supabase_db_eventsible-os-local-ci";

if (/supabase\.co/i.test(databaseUrl)) throw new Error("Refusing to run Data Readiness verification against a remote or Production database.");

function execute(sql, { expectFailure = false } = {}) {
  let result;
  if (dockerBin) result = spawnSync(dockerBin, ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"], { input: sql, encoding: "utf8" });
  else {
    try {
      const stdout = execFileSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", sql], { encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } });
      result = { status: 0, stdout, stderr: "" };
    } catch (error) {
      result = { status: error.status || 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error.message ?? "") };
    }
  }
  if (expectFailure && result.status === 0) throw new Error(`Expected database denial but command succeeded: ${sql.slice(0, 120)}`);
  if (!expectFailure && result.status !== 0) throw new Error(`Data Readiness database verification failed: ${(result.stderr || result.stdout).slice(0, 900)}`);
  return String(result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

const ids = {
  owner: "11000000-0000-4000-8000-000000000001",
  manager: "11000000-0000-4000-8000-000000000002",
  unauthorized: "11000000-0000-4000-8000-000000000003",
  staff: "11000000-0000-4000-8000-000000000004",
  host: "11000000-0000-4000-8000-000000000005",
  retryUser: "11000000-0000-4000-8000-000000000006",
  retryTeamMember: "51000000-0000-4000-8000-000000000099",
  existingContact: "21000000-0000-4000-8000-000000000001",
  existingEvent: "31000000-0000-4000-8000-000000000001",
  existingLead: "41000000-0000-4000-8000-000000000001",
  existingBooking: "61000000-0000-4000-8000-000000000001",
};

function claims(userId, role) {
  return JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", app_metadata: role ? { role } : {} }).replaceAll("'", "''");
}

function asUser(userId, role, sql) {
  return execute(`begin; set local role authenticated; select set_config('request.jwt.claims', '${claims(userId, role)}', true); ${sql}; commit;`);
}

function denied(userId, role, sql) {
  execute(`begin; set local role authenticated; select set_config('request.jwt.claims', '${claims(userId, role)}', true); ${sql}; commit;`, { expectFailure: true });
}

execute(`
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    ('00000000-0000-0000-0000-000000000000','${ids.owner}','authenticated','authenticated','data-owner@example.invalid','',now(),'','','','', '{"role":"owner"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.manager}','authenticated','authenticated','data-manager@example.invalid','',now(),'','','','', '{"role":"manager"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.unauthorized}','authenticated','authenticated','data-other@example.invalid','',now(),'','','','','{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.staff}','authenticated','authenticated','data-staff@example.invalid','',now(),'','','','', '{"role":"staff"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.host}','authenticated','authenticated','data-host@example.invalid','',now(),'','','','', '{"role":"host"}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.os_contacts(id,display_name,primary_email,source,status,created_by) values ('${ids.existingContact}','Synthetic existing contact','existing-data@example.invalid','manual','active','${ids.owner}') on conflict (id) do nothing;
  insert into public.os_events(id,primary_contact_id,title,event_type,status,starts_at,ends_at,source,created_by) values ('${ids.existingEvent}','${ids.existingContact}','Synthetic existing event','test','inquiry','2026-11-01 18:00','2026-11-01 21:00','manual','${ids.owner}') on conflict (id) do nothing;
  insert into public.os_leads(id,contact_id,event_id,status,source) values ('${ids.existingLead}','${ids.existingContact}','${ids.existingEvent}','new','manual') on conflict (id) do nothing;
  insert into public.os_bookings(id,event_id,payment_status,total_amount,deposit_amount,balance_due) values ('${ids.existingBooking}','${ids.existingEvent}','unpaid',1000,250,750) on conflict (id) do nothing;
`);

if (execute("select exists(select 1 from supabase_migrations.schema_migrations where version='20260909042244')") !== "t") throw new Error("Data Readiness migration is missing from the local migration ledger.");
if (execute("select relrowsecurity from pg_class where oid='public.os_import_batch_items'::regclass") !== "t") throw new Error("Data Readiness staging RLS is not enabled.");
if (execute("select count(*) from pg_constraint where conrelid='public.os_import_batch_items'::regclass and conname in ('os_import_batch_items_key_chk','os_import_batch_items_type_chk','os_import_batch_items_hash_chk','os_import_batch_items_payload_chk','os_import_batch_items_uncertain_chk','os_import_batch_items_status_chk')") !== "6") throw new Error("Data Readiness staging constraints are incomplete.");
if (execute("select count(*) from pg_indexes where schemaname='public' and indexname in ('os_import_batches_approved_by_idx','os_import_batches_rollback_by_idx','os_import_batch_items_batch_status_idx','os_import_batch_items_source_hash_idx','os_import_batch_items_approved_by_idx','os_import_batch_items_applied_by_idx')") !== "6") throw new Error("Data Readiness staging and audit-attribution indexes are incomplete.");
if (execute("select count(*) from pg_policies where schemaname='public' and tablename='os_import_batch_items'") !== "0") throw new Error("Data Readiness staging unexpectedly exposes direct-table policies.");
if (execute("select bool_and(p.prosecdef and r.rolname='postgres' and 'search_path=\"\"'=any(p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname in ('os_data_readiness_snapshot','os_manage_contact','os_manage_event','os_manage_lead','os_stage_intake_manifest','os_approve_intake_batch','os_apply_intake_batch','os_compensate_intake_batch')") !== "t") throw new Error("Data Readiness function ownership, SECURITY DEFINER, or empty search_path contract failed.");
if (execute("select not has_table_privilege('anon','public.os_import_batch_items','select') and not has_table_privilege('authenticated','public.os_import_batch_items','select') and not has_function_privilege('public','public.os_stage_intake_manifest(jsonb)','execute') and not has_function_privilege('anon','public.os_stage_intake_manifest(jsonb)','execute') and has_function_privilege('authenticated','public.os_stage_intake_manifest(jsonb)','execute')") !== "t") throw new Error("Data Readiness grants are broader or narrower than intended.");

for (const [userId, role] of [[ids.manager, "manager"], [ids.staff, "staff"], [ids.host, "host"], [ids.unauthorized, null]]) {
  denied(userId, role, "select public.os_data_readiness_snapshot()");
  denied(userId, role, `select public.os_manage_contact('archive','${ids.existingContact}','{}'::jsonb)`);
}
execute("set role anon; select public.os_stage_intake_manifest('{}'::jsonb)", { expectFailure: true });
if (execute("select data_type||':'||is_nullable||':'||column_default from information_schema.columns where table_schema='public' and table_name='os_service_catalog' and column_name='is_active'") !== "boolean:NO:true") throw new Error("Canonical service-catalog activity column contract changed.");
const ownerSnapshot = JSON.parse(asUser(ids.owner, "owner", "select public.os_data_readiness_snapshot()"));
const activeServiceCode = execute("select code from public.os_service_catalog where is_active is true order by sort_order,id limit 1");
if (!activeServiceCode || !ownerSnapshot.services.some((service) => service.code === activeServiceCode && service.status === "active")) throw new Error("Owner snapshot did not represent an active service with the reviewed response shape.");
if (ownerSnapshot.services.some((service) => Object.keys(service).sort().join(",") !== "code,id,name,status")) throw new Error("Service snapshot exposed fields beyond the reviewed response shape.");
if (execute(`begin; update public.os_service_catalog set is_active=false where code='${activeServiceCode.replaceAll("'", "''")}'; set local role authenticated; select set_config('request.jwt.claims', '${claims(ids.owner, "owner")}', true); select not exists(select 1 from jsonb_array_elements(public.os_data_readiness_snapshot()->'services') service where service->>'code'='${activeServiceCode.replaceAll("'", "''")}'); rollback;`) !== "t") throw new Error("Inactive service remained visible in the Owner readiness snapshot.");
denied(ids.owner, "owner", "select count(*) from public.os_import_batch_items");
execute("set role anon; select count(*) from public.os_import_batch_items", { expectFailure: true });

const managedContact = JSON.parse(asUser(ids.owner, "owner", `select public.os_manage_contact('create',null,'{"displayName":"Synthetic maintenance contact","primaryEmail":"maintenance@example.invalid"}'::jsonb)`));
const managedContactId = managedContact.contactId;
asUser(ids.owner, "owner", `select public.os_manage_contact('update','${managedContactId}','{"displayName":"Synthetic corrected contact","primaryEmail":"maintenance@example.invalid","preferredChannel":"email"}'::jsonb)`);
asUser(ids.owner, "owner", `select public.os_manage_contact('archive','${managedContactId}','{}'::jsonb)`);
asUser(ids.owner, "owner", `select public.os_manage_contact('restore','${managedContactId}','{}'::jsonb)`);
asUser(ids.owner, "owner", `select public.os_manage_event('update','${ids.existingEvent}','{"title":"Synthetic corrected event","eventType":"test","status":"pending","startsAt":"2026-11-01T19:00:00Z","endsAt":"2026-11-01T22:00:00Z","timezone":"America/Indiana/Indianapolis","venueCity":"South Bend","venueState":"Indiana","guestCount":"50"}'::jsonb)`);
asUser(ids.owner, "owner", `select public.os_manage_lead('update','${ids.existingLead}','{"status":"follow_up","nextFollowUpAt":"2026-10-20T12:00:00Z"}'::jsonb)`);

const manifest = {
  contractVersion: "intake_manifest_v1",
  sourceLabel: "Synthetic local Data Readiness verification",
  items: [
    { key: "contact.synthetic-1", type: "contact", sourceHash: "a".repeat(64), sourceRef: "synthetic/contact-1", uncertainFields: [], data: { displayName: "Synthetic imported contact", primaryEmail: "imported@example.invalid" } },
    { key: "event.synthetic-1", type: "event", sourceHash: "b".repeat(64), sourceRef: "synthetic/event-1", uncertainFields: [], data: { primaryContactItemKey: "contact.synthetic-1", title: "Synthetic imported event", eventType: "test", status: "inquiry", startsAt: "2026-12-01T18:00:00Z", endsAt: "2026-12-01T21:00:00Z" } },
    { key: "inquiry.synthetic-1", type: "inquiry", sourceHash: "c".repeat(64), sourceRef: "synthetic/inquiry-1", uncertainFields: [], data: { contactItemKey: "contact.synthetic-1", eventItemKey: "event.synthetic-1", status: "new", summary: "Synthetic local inquiry" } },
  ],
};
const literal = JSON.stringify(manifest).replaceAll("'", "''");
const tooMany = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic item limit", items: Array.from({ length: 251 }, (_, index) => ({ key: `contact.limit-${index}`, type: "contact", sourceHash: index.toString(16).padStart(64, "0"), uncertainFields: [], data: { displayName: `Synthetic ${index}`, primaryEmail: `limit-${index}@example.invalid` } })) };
denied(ids.owner, "owner", `select public.os_stage_intake_manifest('${JSON.stringify(tooMany).replaceAll("'", "''")}'::jsonb)`);
const oversized = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic item size", items: [{ key: "contact.oversized", type: "contact", sourceHash: "f".repeat(64), uncertainFields: [], data: { displayName: "Synthetic oversized", primaryEmail: "oversized@example.invalid", notes: "x".repeat(33000) } }] };
denied(ids.owner, "owner", `select public.os_stage_intake_manifest('${JSON.stringify(oversized).replaceAll("'", "''")}'::jsonb)`);
const oversizedManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic manifest size", items: Array.from({ length: 250 }, (_, index) => ({ key: `contact.size-${index}`, type: "contact", sourceHash: (index + 1000).toString(16).padStart(64, "0"), uncertainFields: [], data: { displayName: `Synthetic size ${index}`, primaryEmail: `size-${index}@example.invalid`, notes: "x".repeat(2200) } })) };
denied(ids.owner, "owner", `select public.os_stage_intake_manifest('${JSON.stringify(oversizedManifest).replaceAll("'", "''")}'::jsonb)`);
const guessed = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic uncertainty", items: [{ key: "contact.uncertain", type: "contact", sourceHash: "1".repeat(64), uncertainFields: ["primaryEmail"], data: { displayName: "Synthetic uncertain", primaryEmail: "uncertain@example.invalid" } }] };
denied(ids.owner, "owner", `select public.os_stage_intake_manifest('${JSON.stringify(guessed).replaceAll("'", "''")}'::jsonb)`);
const staged = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${literal}'::jsonb)`));
if (staged.status !== "previewed" || staged.itemCount !== 3) throw new Error("Manifest dry run did not stage the exact synthetic item set.");
const replayed = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${literal}'::jsonb)`));
if (replayed.status !== "replayed" || replayed.batchId !== staged.batchId) throw new Error("Manifest replay was not idempotent.");
denied(ids.owner, "owner", `select public.os_approve_intake_batch('${staged.batchId}','${"0".repeat(64)}',array['contact.synthetic-1','event.synthetic-1','inquiry.synthetic-1'])`);
denied(ids.owner, "owner", `select public.os_approve_intake_batch('${staged.batchId}','${staged.manifestHash}',array['contact.synthetic-1','missing.synthetic-1'])`);
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${staged.batchId}','${staged.manifestHash}',array['contact.synthetic-1','event.synthetic-1','inquiry.synthetic-1'])`);
const applied = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${staged.batchId}','${staged.manifestHash}')`));
if (applied.status !== "completed" || applied.applied !== 3) {
  const failures = execute(`select coalesce(jsonb_agg(jsonb_build_object('itemKey',item_key,'status',status,'errorCode',error_code) order by item_key),'[]'::jsonb) from public.os_import_batch_items where batch_id='${staged.batchId}'`);
  throw new Error(`Approved linked manifest did not apply exactly once: ${failures}`);
}
const counts = JSON.parse(execute(`select jsonb_build_object('contacts',(select count(*) from public.os_contacts where metadata->>'importBatchId'='${staged.batchId}'),'events',(select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}'),'leads',(select count(*) from public.os_leads where metadata->>'importBatchId'='${staged.batchId}'))`));
if (counts.contacts !== 1 || counts.events !== 1 || counts.leads !== 1) throw new Error("Canonical linked-record counts were not idempotent.");

const duplicateManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic duplicate warning", items: [{ key: "contact.duplicate-1", type: "contact", sourceHash: "d".repeat(64), uncertainFields: [], data: { displayName: "Possible duplicate", primaryEmail: "imported@example.invalid" } }] };
const duplicateLiteral = JSON.stringify(duplicateManifest).replaceAll("'", "''");
const duplicateBatch = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${duplicateLiteral}'::jsonb)`));
const warningCount = execute(`select jsonb_array_length(duplicate_warnings) from public.os_import_batch_items where batch_id='${duplicateBatch.batchId}'`);
if (warningCount !== "1") throw new Error("Exact duplicate did not remain staged with a warning.");

const partialManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic partial failure", items: [{ key: "assignment.invalid-1", type: "staff_assignment", sourceHash: "e".repeat(64), uncertainFields: [], data: { eventId: ids.existingEvent, teamMemberId: ids.retryTeamMember, assignmentRole: "dj" } }] };
const partialLiteral = JSON.stringify(partialManifest).replaceAll("'", "''");
const partialBatch = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${partialLiteral}'::jsonb)`));
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}',array['assignment.invalid-1'])`);
const partial = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}')`));
if (partial.status !== "partial" || partial.failed !== 1) throw new Error("Per-item failure did not remain bounded and retryable.");
execute(`
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values ('00000000-0000-0000-0000-000000000000','${ids.retryUser}','authenticated','authenticated','data-retry@example.invalid','',now(),'','','','','{}','{}',now(),now()) on conflict (id) do nothing;
  insert into public.os_team_members(id,user_id,display_name,created_by_user_id) values ('${ids.retryTeamMember}','${ids.retryUser}','Synthetic retry member','${ids.owner}') on conflict (id) do nothing;
`);
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}',array['assignment.invalid-1'])`);
if (execute(`select status from public.os_import_batch_items where batch_id='${partialBatch.batchId}'`) !== "approved") throw new Error("Failed item was not safely re-approvable.");
const retried = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}')`));
if (retried.status !== "completed" || retried.applied !== 1 || execute(`select count(*) from public.os_staff_assignments where event_id='${ids.existingEvent}' and team_member_id='${ids.retryTeamMember}'`) !== "1") throw new Error("Partial failure retry did not apply exactly once.");
execute(`select public.os_apply_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}')`, { expectFailure: true });

const paymentManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic payment restoration", items: [{ key: "payment.synthetic-1", type: "payment_fact", sourceHash: "2".repeat(64), uncertainFields: [], data: { bookingId: ids.existingBooking, paymentStatus: "partially_paid", totalAmount: "1200", depositAmount: "300", balanceDue: "900" } }] };
const paymentBatch = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${JSON.stringify(paymentManifest).replaceAll("'", "''")}'::jsonb)`));
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${paymentBatch.batchId}','${paymentBatch.manifestHash}',array['payment.synthetic-1'])`);
const paymentApplied = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${paymentBatch.batchId}','${paymentBatch.manifestHash}')`));
if (paymentApplied.status !== "completed" || execute(`select payment_status||':'||total_amount||':'||deposit_amount||':'||balance_due from public.os_bookings where id='${ids.existingBooking}'`) !== "partially_paid:1200.00:300.00:900.00") throw new Error("Payment fact did not apply bounded values.");
asUser(ids.owner, "owner", `select public.os_compensate_intake_batch('${paymentBatch.batchId}','${paymentBatch.manifestHash}')`);
if (execute(`select payment_status||':'||total_amount||':'||deposit_amount||':'||balance_due from public.os_bookings where id='${ids.existingBooking}'`) !== "unpaid:1000.00:250.00:750.00") throw new Error("Compensation did not restore recorded prior payment values.");

const compensated = JSON.parse(asUser(ids.owner, "owner", `select public.os_compensate_intake_batch('${staged.batchId}','${staged.manifestHash}')`));
if (compensated.status !== "compensated" || compensated.itemCount !== 3) throw new Error("Batch compensation did not preserve an auditable result per applied item.");
if (execute(`select count(*) from public.os_contacts where metadata->>'importBatchId'='${staged.batchId}'`) !== "1" || execute(`select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}'`) !== "1" || execute(`select count(*) from public.os_leads where metadata->>'importBatchId'='${staged.batchId}'`) !== "1") throw new Error("Compensation hard-deleted canonical intake history.");
if (execute(`select count(*) from public.os_activity_events where event_type like 'data_readiness.%'`) === "0") throw new Error("Data Readiness provenance was not recorded.");

console.log("Data Readiness local Supabase verification passed: Owner-only maintenance, direct-table denial, manifest validation, linked apply, duplicate warnings, idempotency, partial retry, and non-destructive compensation.");
