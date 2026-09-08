import { execFileSync, spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dockerBin = process.env.EVENTSIBLE_DOCKER_BIN;
const container = process.env.EVENTSIBLE_SUPABASE_DB_CONTAINER ?? "supabase_db_eventsible-os-local-ci";

function execute(sql, { expectFailure = false } = {}) {
  let status = 0;
  let stdout = "";
  let stderr = "";
  if (dockerBin) {
    const result = spawnSync(dockerBin, ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"], { input: sql, encoding: "utf8" });
    status = result.status ?? 1;
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } else {
    try {
      stdout = execFileSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", sql], { encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } });
    } catch (error) {
      status = error.status || 1;
      stdout = String(error.stdout ?? "");
      stderr = String(error.stderr ?? "");
    }
  }
  if (expectFailure && status === 0) throw new Error(`Expected database denial but command succeeded: ${sql.slice(0, 100)}`);
  if (!expectFailure && status !== 0) throw new Error(`Database verification failed: ${(stderr || stdout).slice(0, 600)}`);
  return stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000002",
  staff: "10000000-0000-4000-8000-000000000003",
  host: "10000000-0000-4000-8000-000000000004",
  unauthorized: "10000000-0000-4000-8000-000000000005",
  contact: "20000000-0000-4000-8000-000000000001",
  event: "30000000-0000-4000-8000-000000000001",
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
  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    confirmation_token,recovery_token,email_change_token_new,email_change,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  )
  values
    ('00000000-0000-0000-0000-000000000000','${ids.owner}','authenticated','authenticated','owner@test.invalid','',now(),'','','','', '{"role":"owner"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.manager}','authenticated','authenticated','manager@test.invalid','',now(),'','','','', '{"role":"manager"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.staff}','authenticated','authenticated','staff@test.invalid','',now(),'','','','', '{"role":"staff"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.host}','authenticated','authenticated','host@test.invalid','',now(),'','','','', '{"role":"host"}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','${ids.unauthorized}','authenticated','authenticated','other@test.invalid','',now(),'','','','','{}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.os_contacts(id,display_name,primary_email) values ('${ids.contact}','Synthetic calendar contact','calendar@test.invalid') on conflict (id) do nothing;
  insert into public.os_events(id,primary_contact_id,title,event_type,status,starts_at,ends_at,timezone)
  values ('${ids.event}','${ids.contact}','Synthetic EVENTSible gig','test','booked','2026-10-10 18:00','2026-10-10 22:00','America/Indiana/Indianapolis')
  on conflict (id) do nothing;
`);

const memberIds = {};
for (const [role, userId] of Object.entries({ owner: ids.owner, manager: ids.manager, staff: ids.staff, host: ids.host })) {
  const output = asUser(userId, role, `select (public.os_ensure_my_team_member('${role} synthetic','America/Indiana/Indianapolis')->>'team_member_id')`);
  memberIds[role] = output;
  if (!/^[0-9a-f-]{36}$/i.test(output)) throw new Error(`${role} team-member bootstrap failed.`);
}
denied(ids.unauthorized, null, "select public.os_ensure_my_team_member('unauthorized','America/Indiana/Indianapolis')");
execute(`set role anon; select public.os_upsert_team_availability(null,'${memberIds.manager}','{}'::jsonb)`, { expectFailure: true });

const beforeBusiness = execute("select jsonb_build_object('contacts',(select count(*) from public.os_contacts),'events',(select count(*) from public.os_events),'leads',(select count(*) from public.os_leads),'bookings',(select count(*) from public.os_bookings))");
const supportedEntries = [];
for (const [index, entryType] of ["available", "unavailable", "outside_booking", "vacation", "reminder", "note"].entries()) {
  const privacy = entryType === "available" ? "team_details" : ["reminder", "note"].includes(entryType) ? "private" : "busy_only";
  const entryId = asUser(ids.manager, "manager", `select (public.os_upsert_team_availability(null,'${memberIds.manager}','{"entryType":"${entryType}","allDay":true,"startsOn":"2026-10-${String(21 + index).padStart(2, "0")}","endsOn":"2026-10-${String(21 + index).padStart(2, "0")}","timezone":"America/Indiana/Indianapolis","title":"Synthetic ${entryType}","privateNotes":"synthetic ${entryType} note","privacy":"${privacy}"}'::jsonb)->>'entry_id')`);
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) throw new Error(`${entryType} creation failed.`);
  supportedEntries.push({ entryId, entryType });
}

const editableLegacyUnavailable = asUser(ids.manager, "manager", `select (public.os_upsert_team_availability(null,'${memberIds.manager}','{"entryType":"unavailable","allDay":true,"startsOn":"2026-10-29","endsOn":"2026-10-29","timezone":"America/Indiana/Indianapolis","title":"Existing unavailable","privateNotes":"existing synthetic note","privacy":"private"}'::jsonb)->>'entry_id')`);
asUser(ids.manager, "manager", `select public.os_upsert_team_availability('${editableLegacyUnavailable}','${memberIds.manager}','{"entryType":"reminder","allDay":false,"startsAt":"2026-10-29T13:00:00Z","endsAt":"2026-10-29T14:00:00Z","timezone":"America/Indiana/Indianapolis","title":"Edited reminder","privateNotes":"edited synthetic note","privacy":"private"}'::jsonb)`);
const managerEntry = asUser(ids.manager, "manager", `select (public.os_upsert_team_availability(null,'${memberIds.manager}','{"entryType":"outside_booking","allDay":false,"startsAt":"2026-10-10T21:00:00Z","endsAt":"2026-10-11T01:00:00Z","timezone":"America/Indiana/Indianapolis","title":"Private outside client","privateNotes":"private manager note","privacy":"private"}'::jsonb)->>'entry_id')`);
asUser(ids.manager, "manager", `select public.os_upsert_team_availability('${managerEntry}','${memberIds.manager}','{"entryType":"outside_booking","allDay":false,"startsAt":"2026-10-10T20:30:00Z","endsAt":"2026-10-11T01:00:00Z","timezone":"America/Indiana/Indianapolis","title":"Private outside client","privateNotes":"updated private manager note","privacy":"private"}'::jsonb)`);
denied(ids.manager, "manager", `select public.os_upsert_team_availability(null,'${memberIds.staff}','{"entryType":"unavailable","allDay":true,"startsOn":"2026-10-11","endsOn":"2026-10-11","timezone":"America/Indiana/Indianapolis","privacy":"busy_only"}'::jsonb)`);

for (const role of ["staff", "host"]) {
  asUser(ids[role], role, `select public.os_upsert_team_availability(null,'${memberIds[role]}','{"entryType":"unavailable","allDay":true,"startsOn":"2026-10-12","endsOn":"2026-10-12","timezone":"America/Indiana/Indianapolis","privacy":"busy_only"}'::jsonb)`);
}

const ownerPrivate = asUser(ids.owner, "owner", `select (public.os_upsert_team_availability(null,'${memberIds.owner}','{"entryType":"vacation","allDay":true,"startsOn":"2026-10-15","endsOn":"2026-10-17","timezone":"America/Indiana/Indianapolis","title":"Owner private vacation","privateNotes":"owner private note","privacy":"private"}'::jsonb)->>'entry_id')`);
asUser(ids.owner, "owner", `select public.os_upsert_team_availability(null,'${memberIds.staff}','{"entryType":"unavailable","allDay":true,"startsOn":"2026-10-20","endsOn":"2026-10-20","timezone":"America/Indiana/Indianapolis","title":"Owner correction","privacy":"team_details"}'::jsonb)`);

const assignment = asUser(ids.owner, "owner", `select (public.os_manage_staff_assignment('upsert',null,'${ids.event}','${memberIds.manager}','dj','2026-10-10T20:00:00Z')->>'assignment_id')`);
if (!/^[0-9a-f-]{36}$/i.test(assignment)) throw new Error("Owner assignment creation failed.");
denied(ids.manager, "manager", `select public.os_manage_staff_assignment('upsert',null,'${ids.event}','${memberIds.staff}','assistant',null)`);
denied(ids.staff, "staff", `select public.os_manage_team_member('${memberIds.staff}','Changed','America/Indiana/Indianapolis','active')`);
asUser(ids.owner, "owner", `select public.os_manage_team_member('${memberIds.staff}','Staff synthetic','America/Indiana/Indianapolis','active')`);
denied(ids.owner, "owner", `select public.os_remove_team_availability('${managerEntry}')`);

for (const [role, userId] of Object.entries({ owner: ids.owner, manager: ids.manager, staff: ids.staff, host: ids.host })) {
  denied(userId, role, "select count(*) from public.os_team_availability");
  denied(userId, role, "delete from public.os_staff_assignments");
}
denied(ids.unauthorized, null, "select public.os_team_calendar_snapshot('2026-10-01','2026-10-31')");
execute("set role anon; select public.os_team_calendar_snapshot('2026-10-01','2026-10-31')", { expectFailure: true });

const managerSnapshot = JSON.parse(asUser(ids.manager, "manager", "select public.os_team_calendar_snapshot('2026-10-01','2026-10-31')"));
const managerOwn = managerSnapshot.availability.find((entry) => entry.id === managerEntry);
const managerSeesOwner = managerSnapshot.availability.find((entry) => entry.id === ownerPrivate);
if (managerOwn?.privateNotes !== "updated private manager note" || managerOwn?.title !== "Private outside client") throw new Error("Manager did not receive their own private details.");
if (managerSeesOwner?.privateNotes !== null || managerSeesOwner?.title !== "Unavailable" || managerSeesOwner?.entryType !== "unavailable" || managerSeesOwner?.privacy !== "busy_only") throw new Error("Another member's private details were not redacted.");
for (const { entryId, entryType } of supportedEntries) {
  const entry = managerSnapshot.availability.find((candidate) => candidate.id === entryId);
  if (entry?.entryType !== entryType || entry?.canEdit !== true || entry?.canRemove !== true) throw new Error(`${entryType} did not round-trip as an editable owned entry.`);
}
const editedEntry = managerSnapshot.availability.find((entry) => entry.id === editableLegacyUnavailable);
if (editedEntry?.entryType !== "reminder" || editedEntry?.allDay !== false || editedEntry?.title !== "Edited reminder" || editedEntry?.privateNotes !== "edited synthetic note") throw new Error("Existing unavailable entry did not support a full-field edit.");

const ownerSnapshot = JSON.parse(asUser(ids.owner, "owner", "select public.os_team_calendar_snapshot('2026-10-01','2026-10-31')"));
const ownerSeesManager = ownerSnapshot.availability.find((entry) => entry.id === managerEntry);
if (ownerSeesManager?.privateNotes !== null || ownerSeesManager?.title !== "Busy" || ownerSeesManager?.entryType !== "unavailable" || ownerSeesManager?.privacy !== "busy_only") throw new Error("Owner bypassed privacy-safe Busy redaction.");
if (ownerSeesManager?.canEdit !== true || ownerSeesManager?.canRemove !== false) throw new Error("Owner correction/removal boundaries were not preserved.");
for (const hiddenType of ["reminder", "note"]) {
  const hidden = supportedEntries.find((entry) => entry.entryType === hiddenType);
  if (ownerSnapshot.availability.some((entry) => entry.id === hidden.entryId)) throw new Error(`Private ${hiddenType} leaked into another user's snapshot.`);
}
const sharedAvailable = supportedEntries.find((entry) => entry.entryType === "available");
if (!ownerSnapshot.availability.some((entry) => entry.id === sharedAvailable.entryId && entry.entryType === "available" && entry.title === "Synthetic available")) throw new Error("Team-visible availability was not shared safely.");
if (ownerSnapshot.assignments.length !== 1) throw new Error("Owner assignment snapshot was incomplete.");

const afterBusiness = execute("select jsonb_build_object('contacts',(select count(*) from public.os_contacts),'events',(select count(*) from public.os_events),'leads',(select count(*) from public.os_leads),'bookings',(select count(*) from public.os_bookings))");
if (beforeBusiness !== afterBusiness) throw new Error("Personal scheduling writes changed canonical business record counts.");

asUser(ids.manager, "manager", `select public.os_remove_team_availability('${managerEntry}')`);
for (const { entryId } of supportedEntries) asUser(ids.manager, "manager", `select public.os_remove_team_availability('${entryId}')`);
asUser(ids.manager, "manager", `select public.os_remove_team_availability('${editableLegacyUnavailable}')`);
denied(ids.manager, "manager", `select public.os_remove_team_availability('${ownerPrivate}')`);
asUser(ids.owner, "owner", `select public.os_manage_staff_assignment('remove','${assignment}',null,null,null,null)`);

console.log("Team Calendar local Supabase verification passed: six entry types, full-field edits, self-service ownership, Owner boundaries, privacy redaction, direct-table denial, and canonical-record isolation.");
