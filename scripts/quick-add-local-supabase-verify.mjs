import { execFileSync, spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dockerBin = process.env.EVENTSIBLE_DOCKER_BIN;
const container = process.env.EVENTSIBLE_SUPABASE_DB_CONTAINER ?? "supabase_db_eventsible-os-local-ci";
if (/supabase\.co/i.test(databaseUrl)) throw new Error("Refusing to run Quick Add verification against a remote database.");

function sql(statement, { expectFailure = false } = {}) {
  let result;
  if (dockerBin) result = spawnSync(dockerBin, ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"], { input: statement, encoding: "utf8" });
  else {
    try {
      result = { status: 0, stdout: execFileSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", statement], { encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } }), stderr: "" };
    } catch (error) {
      result = { status: error.status || 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error.message ?? "") };
    }
  }
  if (expectFailure && result.status === 0) throw new Error(`Expected denial but statement succeeded: ${statement.slice(0,120)}`);
  if (!expectFailure && result.status !== 0) throw new Error(`Quick Add database verification failed: ${(result.stderr || result.stdout).slice(0,1000)}`);
  return String(result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

const ids = {
  owner: "13000000-0000-4000-8000-000000000001",
  manager: "13000000-0000-4000-8000-000000000002",
  staff: "13000000-0000-4000-8000-000000000003",
  host: "13000000-0000-4000-8000-000000000004",
  unrelated: "13000000-0000-4000-8000-000000000005",
};
const claims = (id, role) => JSON.stringify({ sub:id, role:"authenticated", aud:"authenticated", app_metadata:role ? { role } : {} }).replaceAll("'","''");
const asUser = (id, role, statement) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${statement}; commit;`);
const denied = (id, role, statement) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${statement}; commit;`, { expectFailure:true });
const literal = (value) => JSON.stringify(value).replaceAll("'","''");

sql(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','${ids.owner}','authenticated','authenticated','quick-owner@example.invalid','',now(),'','','','', '{"role":"owner"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.manager}','authenticated','authenticated','quick-manager@example.invalid','',now(),'','','','', '{"role":"manager"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.staff}','authenticated','authenticated','quick-staff@example.invalid','',now(),'','','','', '{"role":"staff"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.host}','authenticated','authenticated','quick-host@example.invalid','',now(),'','','','', '{"role":"host"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.unrelated}','authenticated','authenticated','quick-other@example.invalid','',now(),'','','','','{}','{}',now(),now()) on conflict(id) do nothing;`);

if (sql("select exists(select 1 from supabase_migrations.schema_migrations where version='20260917210520')") !== "t") throw new Error("Quick Add migration is missing from the local ledger.");
if (sql("select p.prosecdef and r.rolname='postgres' and 'search_path=\"\"'=any(p.proconfig) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname='os_owner_quick_add'") !== "t") throw new Error("Quick Add ownership, SECURITY DEFINER, or empty search path is incorrect.");
if (sql("select not has_function_privilege('public','public.os_owner_quick_add(text,jsonb,boolean)','execute') and not has_function_privilege('anon','public.os_owner_quick_add(text,jsonb,boolean)','execute') and has_function_privilege('authenticated','public.os_owner_quick_add(text,jsonb,boolean)','execute')") !== "t") throw new Error("Quick Add grants are incorrect.");
for (const [id, role] of [[ids.manager,"manager"],[ids.staff,"staff"],[ids.host,"host"],[ids.unrelated,null]]) denied(id, role, "select public.os_owner_quick_add('contact','{\"displayName\":\"Denied\",\"primaryEmail\":\"denied@example.invalid\"}'::jsonb,false)");
sql("set role anon; select public.os_owner_quick_add('contact','{}'::jsonb,false)", { expectFailure:true });

const beforeOutboxes = sql("select (select count(*) from public.os_integration_outbox)||':'||(select count(*) from public.os_automation_outbox)||':'||(select count(*) from public.os_notification_deliveries)");
const contactPayload = { displayName:"Synthetic Quick Client", firstName:"Synthetic", lastName:"Client", primaryEmail:"QUICK@example.invalid", primaryPhone:"(555) 010-0242", preferredChannel:"email", notes:"Synthetic Owner-entered contact." };
const contact = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('contact','${literal(contactPayload)}'::jsonb,false)`));
if (contact.status !== "create" || !contact.contactId || sql(`select primary_email||':'||source from public.os_contacts where id='${contact.contactId}'`) !== "quick@example.invalid:hq_manual") throw new Error("Owner contact creation did not use the canonical contact path.");
const warning = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('contact','${literal(contactPayload)}'::jsonb,false)`));
if (warning.status !== "duplicate_warning" || warning.duplicateWarnings.length < 2) throw new Error("Active duplicate warning was not returned before a write.");
sql(`update public.os_contacts set status='archived' where id='${contact.contactId}'`);
const archivedWarning = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('contact','${literal(contactPayload)}'::jsonb,false)`));
if (archivedWarning.status !== "duplicate_warning" || !archivedWarning.duplicateWarnings.some((item) => item.status === "archived")) throw new Error("Archived duplicate warning is missing.");
sql(`update public.os_contacts set status='active' where id='${contact.contactId}'`);

const quickLead = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('lead','${literal({ newContact:{ displayName:"Synthetic New Lead", primaryEmail:"new-lead@example.invalid" }, source:"Owner phone call", status:"new", summary:"Synthetic birthday inquiry", notes:"Call next week." })}'::jsonb,false)`));
if (!quickLead.leadId || !quickLead.contactId || sql(`select count(*) from public.os_leads where id='${quickLead.leadId}' and contact_id='${quickLead.contactId}' and source='Owner phone call'`) !== "1") throw new Error("Lead and quick-created contact were not saved in one transaction.");

const dateEvent = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('event','${literal({ contactId:contact.contactId, title:"Synthetic Date-only Gig", eventType:"birthday_party", status:"inquiry", historicalDate:"2027-04-03", serviceIds:[], notes:"Time genuinely unknown." })}'::jsonb,false)`));
if (sql(`select historical_date||':'||coalesce(starts_at::text,'NULL')||':'||coalesce(timezone,'NULL') from public.os_events where id='${dateEvent.eventId}'`) !== "2027-04-03:NULL:NULL") throw new Error("Date-only Quick Add fabricated a time or timezone.");

const timedEvent = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('event','${literal({ contactId:contact.contactId, title:"Synthetic Timed Gig", eventType:"corporate", status:"pending", startsAt:"2027-05-10T22:00:00Z", endsAt:"2027-05-11T02:00:00Z", timezone:"America/Chicago", venueName:"Synthetic Hall", venueCity:"Example", venueState:"Illinois", guestCount:"80", serviceIds:[] })}'::jsonb,false)`));
if (!timedEvent.eventId) throw new Error("Timed event was not created.");
const eventCountBeforeFailure = sql("select count(*) from public.os_events");
denied(ids.owner,"owner",`select public.os_owner_quick_add('event','${literal({ contactId:contact.contactId, title:"Atomic failure", eventType:"other", status:"inquiry", historicalDate:"2027-07-01", serviceIds:["ffffffff-ffff-4fff-8fff-ffffffffffff"] })}'::jsonb,false)`);
if (sql("select count(*) from public.os_events") !== eventCountBeforeFailure) throw new Error("A failed Quick Add left a partial event.");

const booking = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('booking','${literal({ eventId:timedEvent.eventId, status:"pending", contractedAmount:"", paymentStatus:"", serviceIds:[], notes:"Zero-service booking; money not entered." })}'::jsonb,false)`));
if (sql(`select count(*) from public.os_bookings where id='${booking.bookingId}' and payment_status='unknown' and total_amount is null and deposit_amount is null and balance_due is null and metadata->>'paymentStatusKnown'='false'`) !== "1") throw new Error("Zero-service booking fabricated financial facts or payment certainty.");
if (sql(`select count(*) from public.os_booking_services where booking_id='${booking.bookingId}'`) !== "0") throw new Error("Zero-service booking gained a service.");
const bookingWarning = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('booking','${literal({ eventId:timedEvent.eventId, status:"pending", serviceIds:[] })}'::jsonb,true)`));
if (bookingWarning.status !== "duplicate_warning" || bookingWarning.cannotOverride !== true) throw new Error("Existing booking did not stop duplicate creation.");

const note = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('note','${literal({ entityType:"booking", entityId:booking.bookingId, body:"Synthetic Owner booking note." })}'::jsonb,false)`));
if (!note.noteId || sql(`select count(*) from public.os_event_notes where id='${note.noteId}' and event_id='${timedEvent.eventId}'`) !== "1") throw new Error("Booking note did not attach through the canonical event-note model.");
const contactNote = JSON.parse(asUser(ids.owner,"owner",`select public.os_owner_quick_add('note','${literal({ entityType:"contact", entityId:contact.contactId, body:"Synthetic contact-only activity note." })}'::jsonb,false)`));
if (contactNote.noteId !== null || sql(`select count(*) from public.os_activity_events where id='${contactNote.activityId}' and contact_id='${contact.contactId}'`) !== "1") throw new Error("Contact note did not use the canonical activity stream.");

if (Number(sql("select count(*) from public.os_activity_events where event_type like 'owner_truth.%'")) < 1) throw new Error("Owner truth activity was not recorded.");
if (sql("select (select count(*) from public.os_integration_outbox)||':'||(select count(*) from public.os_automation_outbox)||':'||(select count(*) from public.os_notification_deliveries)") !== beforeOutboxes) throw new Error("Pending Quick Add records created notification or outbox work.");
console.log("Quick Add local Supabase verification passed: Owner-only atomic contact, lead, event, zero-service booking, notes, duplicate warnings, date-only precision, rollback, and automation isolation.");
