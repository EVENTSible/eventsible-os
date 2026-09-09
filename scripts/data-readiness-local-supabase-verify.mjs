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
  existingContact: "21000000-0000-4000-8000-000000000001",
  existingEvent: "31000000-0000-4000-8000-000000000001",
  existingLead: "41000000-0000-4000-8000-000000000001",
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
    ('00000000-0000-0000-0000-000000000000','${ids.unauthorized}','authenticated','authenticated','data-other@example.invalid','',now(),'','','','','{}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.os_contacts(id,display_name,primary_email,source,status,created_by) values ('${ids.existingContact}','Synthetic existing contact','existing-data@example.invalid','manual','active','${ids.owner}') on conflict (id) do nothing;
  insert into public.os_events(id,primary_contact_id,title,event_type,status,starts_at,ends_at,source,created_by) values ('${ids.existingEvent}','${ids.existingContact}','Synthetic existing event','test','inquiry','2026-11-01 18:00','2026-11-01 21:00','manual','${ids.owner}') on conflict (id) do nothing;
  insert into public.os_leads(id,contact_id,event_id,status,source) values ('${ids.existingLead}','${ids.existingContact}','${ids.existingEvent}','new','manual') on conflict (id) do nothing;
`);

denied(ids.manager, "manager", "select public.os_data_readiness_snapshot()");
denied(ids.unauthorized, null, "select public.os_data_readiness_snapshot()");
execute("set role anon; select public.os_stage_intake_manifest('{}'::jsonb)", { expectFailure: true });
denied(ids.manager, "manager", `select public.os_manage_contact('archive','${ids.existingContact}','{}'::jsonb)`);
denied(ids.owner, "owner", "select count(*) from public.os_import_batch_items");

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
const staged = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${literal}'::jsonb)`));
if (staged.status !== "previewed" || staged.itemCount !== 3) throw new Error("Manifest dry run did not stage the exact synthetic item set.");
const replayed = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${literal}'::jsonb)`));
if (replayed.status !== "replayed" || replayed.batchId !== staged.batchId) throw new Error("Manifest replay was not idempotent.");
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${staged.batchId}','${staged.manifestHash}',array['contact.synthetic-1','event.synthetic-1','inquiry.synthetic-1'])`);
const applied = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${staged.batchId}','${staged.manifestHash}')`));
if (applied.status !== "completed" || applied.applied !== 3) throw new Error("Approved linked manifest did not apply exactly once.");
const counts = JSON.parse(execute(`select jsonb_build_object('contacts',(select count(*) from public.os_contacts where metadata->>'importBatchId'='${staged.batchId}'),'events',(select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}'),'leads',(select count(*) from public.os_leads where metadata->>'importBatchId'='${staged.batchId}'))`));
if (counts.contacts !== 1 || counts.events !== 1 || counts.leads !== 1) throw new Error("Canonical linked-record counts were not idempotent.");

const duplicateManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic duplicate warning", items: [{ key: "contact.duplicate-1", type: "contact", sourceHash: "d".repeat(64), uncertainFields: [], data: { displayName: "Possible duplicate", primaryEmail: "imported@example.invalid" } }] };
const duplicateLiteral = JSON.stringify(duplicateManifest).replaceAll("'", "''");
const duplicateBatch = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${duplicateLiteral}'::jsonb)`));
const warningCount = execute(`select jsonb_array_length(duplicate_warnings) from public.os_import_batch_items where batch_id='${duplicateBatch.batchId}'`);
if (warningCount !== "1") throw new Error("Exact duplicate did not remain staged with a warning.");

const partialManifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic partial failure", items: [{ key: "assignment.invalid-1", type: "staff_assignment", sourceHash: "e".repeat(64), uncertainFields: [], data: { eventId: ids.existingEvent, teamMemberId: "51000000-0000-4000-8000-000000000099", assignmentRole: "dj" } }] };
const partialLiteral = JSON.stringify(partialManifest).replaceAll("'", "''");
const partialBatch = JSON.parse(asUser(ids.owner, "owner", `select public.os_stage_intake_manifest('${partialLiteral}'::jsonb)`));
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}',array['assignment.invalid-1'])`);
const partial = JSON.parse(asUser(ids.owner, "owner", `select public.os_apply_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}')`));
if (partial.status !== "partial" || partial.failed !== 1) throw new Error("Per-item failure did not remain bounded and retryable.");
asUser(ids.owner, "owner", `select public.os_approve_intake_batch('${partialBatch.batchId}','${partialBatch.manifestHash}',array['assignment.invalid-1'])`);
if (execute(`select status from public.os_import_batch_items where batch_id='${partialBatch.batchId}'`) !== "approved") throw new Error("Failed item was not safely re-approvable.");

const compensated = JSON.parse(asUser(ids.owner, "owner", `select public.os_compensate_intake_batch('${staged.batchId}','${staged.manifestHash}')`));
if (compensated.status !== "compensated" || compensated.itemCount !== 3) throw new Error("Batch compensation did not preserve an auditable result per applied item.");
if (execute(`select count(*) from public.os_activity_events where event_type like 'data_readiness.%'`) === "0") throw new Error("Data Readiness provenance was not recorded.");

console.log("Data Readiness local Supabase verification passed: Owner-only maintenance, direct-table denial, manifest validation, linked apply, duplicate warnings, idempotency, partial retry, and non-destructive compensation.");
