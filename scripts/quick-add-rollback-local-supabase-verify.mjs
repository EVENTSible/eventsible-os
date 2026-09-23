import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dockerBin = process.env.EVENTSIBLE_DOCKER_BIN;
const container = process.env.EVENTSIBLE_SUPABASE_DB_CONTAINER ?? "supabase_db_eventsible-os-local-ci";
if (/supabase\.co/i.test(databaseUrl)) throw new Error("Refusing to run Quick Add rollback verification against a remote database.");

function execute(statement, { expectFailure = false } = {}) {
  let result;
  if (dockerBin) result = spawnSync(dockerBin, ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"], { input: statement, encoding: "utf8" });
  else result = spawnSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"], { input: statement, encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (expectFailure && result.status === 0) throw new Error("Expected fail-safe rollback denial, but rollback succeeded.");
  if (!expectFailure && result.status !== 0) throw new Error(`Quick Add rollback verification failed: ${output.slice(0,1200)}`);
  return { output, value: String(result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "" };
}

const sql = (statement, options) => execute(`${statement.trim()}\n`, options).value;
const rollback = readFileSync(new URL("../supabase/rollbacks/20260917210520_hq_owner_quick_add.sql", import.meta.url), "utf8");
const fixture = {
  owner: "14000000-0000-4000-8000-000000000001",
  contact: "54000000-0000-4000-8000-000000000001",
  event: "64000000-0000-4000-8000-000000000001",
  booking: "74000000-0000-4000-8000-000000000001",
  operation: "24000000-0000-4000-8000-000000000001",
};
const key = `owner_quick_add:${fixture.owner}:${fixture.operation}`;

if (sql("select count(*) from public.os_bookings where payment_status='unknown'") !== "0") throw new Error("Rollback verification requires a freshly reconstructed disposable local database without unknown payment rows.");
sql(`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','${fixture.owner}','authenticated','authenticated','quick-rollback@example.invalid','',now(),'','','','','{"role":"owner"}','{}',now(),now());
insert into public.os_contacts(id,display_name,primary_email,source,status,created_by) values('${fixture.contact}','Rollback fixture','quick-rollback@example.invalid','hq_manual','active','${fixture.owner}');
insert into public.os_events(id,primary_contact_id,title,event_type,status,historical_date,timezone,source,created_by) values('${fixture.event}','${fixture.contact}','Rollback fixture event','other','inquiry','2027-01-02',null,'hq_owner_manual','${fixture.owner}');
insert into public.os_bookings(id,event_id,status,contract_status,payment_status,metadata) values('${fixture.booking}','${fixture.event}','pending','not_sent','unknown','{"source":"hq_quick_add","paymentStatusKnown":false}');
insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key) values('${fixture.owner}','owner_truth.quick_add_operation','staff','{"status":"completed","recordType":"booking"}','${key}');
`);

const blocked = execute(rollback, { expectFailure: true }).output;
if (!/rollback blocked: bookings with unknown payment status still exist/i.test(blocked)) throw new Error(`Rollback did not explain its unknown-row precondition: ${blocked.slice(0,800)}`);
if (sql("select to_regprocedure('public.os_owner_quick_add(uuid,text,jsonb,boolean)') is not null") !== "t") throw new Error("Fail-safe rollback removed the RPC despite unresolved unknown rows.");
if (!/unknown/.test(sql("select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.os_bookings'::regclass and conname='os_bookings_payment_status_check'"))) throw new Error("Fail-safe rollback changed the constraint despite unresolved unknown rows.");
if (sql(`select count(*) from public.os_activity_events where idempotency_key='${key}'`) !== "1") throw new Error("Fail-safe rollback removed idempotency audit history.");

sql(`delete from public.os_bookings where id='${fixture.booking}'`);
execute(rollback);
if (sql("select to_regprocedure('public.os_owner_quick_add(uuid,text,jsonb,boolean)') is null") !== "t") throw new Error("Successful rollback did not remove the Quick Add RPC.");
if (/unknown/.test(sql("select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.os_bookings'::regclass and conname='os_bookings_payment_status_check'"))) throw new Error("Successful rollback did not restore the strict known-payment constraint.");
if (sql(`select count(*) from public.os_activity_events where idempotency_key='${key}'`) !== "1") throw new Error("Successful rollback removed shared idempotency audit history.");
if (sql("select to_regclass('public.os_activity_events_idempotency_unique') is not null") !== "t") throw new Error("Successful rollback removed the shared idempotency index.");
execute(`insert into public.os_bookings(event_id,status,contract_status,payment_status) values('${fixture.event}','pending','not_sent','unknown');`, { expectFailure: true });

console.log("Quick Add rollback verification passed: unknown rows block safely, the RPC and constraint roll back only after explicit compensation, and shared idempotency audit history is preserved.");
