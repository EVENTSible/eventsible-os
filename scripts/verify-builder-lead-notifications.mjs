import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (databaseUrl.includes(productionRef) || databaseUrl.includes("supabase.co")) {
  throw new Error("Refusing to run notification verification against a remote or Production Supabase database URL.");
}

const sql = String.raw`
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.os_notification_deliveries') is null then
    raise exception 'Notification delivery log table is missing.';
  end if;

  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'os_notification_deliveries'
       and c.relrowsecurity
  ) then
    raise exception 'Notification delivery log must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.os_notification_deliveries', 'select')
     or has_table_privilege('anon', 'public.os_notification_deliveries', 'insert') then
    raise exception 'Anon must not read or write notification deliveries.';
  end if;

  if has_table_privilege('authenticated', 'public.os_notification_deliveries', 'select')
     or has_table_privilege('authenticated', 'public.os_notification_deliveries', 'insert') then
    raise exception 'Authenticated users must not read or write notification deliveries.';
  end if;

  if not has_table_privilege('service_role', 'public.os_notification_deliveries', 'insert')
     or not has_table_privilege('service_role', 'public.os_notification_deliveries', 'update')
     or not has_table_privilege('service_role', 'public.os_notification_deliveries', 'select') then
    raise exception 'Service role must manage notification deliveries.';
  end if;
end $$;

set role service_role;

do $$
declare
  event_id_value uuid;
  submission_id_value uuid;
begin
  select id, nullif(related_record_ids->>'builder_submission_id', '')::uuid
    into event_id_value, submission_id_value
    from public.os_integration_outbox
   where event_type = 'builder.submission_received'
   order by created_at
   limit 1;

  if event_id_value is null or submission_id_value is null then
    raise exception 'Expected synthetic Builder outbox event before notification verification.';
  end if;

  insert into public.os_notification_deliveries (
    notification_key,
    notification_type,
    source_event_id,
    builder_submission_id,
    recipient_email,
    provider,
    provider_message_id,
    status,
    attempt_count,
    sent_at
  )
  values (
    'builder-lead-email:' || submission_id_value::text,
    'builder_lead_internal_email',
    event_id_value,
    submission_id_value,
    'firstfamdjs@gmail.com',
    'resend-dry-run',
    'dry-run-ci',
    'dry_run',
    1,
    now()
  )
  on conflict (notification_key) do update
    set status = excluded.status,
        attempt_count = public.os_notification_deliveries.attempt_count,
        updated_at = now();

  if (
    select count(*)
      from public.os_notification_deliveries
     where notification_key = 'builder-lead-email:' || submission_id_value::text
  ) <> 1 then
    raise exception 'Notification idempotency key did not preserve one delivery row.';
  end if;

  if (
    select count(*)
      from public.os_integration_outbox
     where id = event_id_value
       and event_type = 'builder.submission_received'
       and status = 'pending'
  ) <> 1 then
    raise exception 'Notification verification unexpectedly changed the integration outbox event.';
  end if;

  raise notice 'EVENTSIBLE_BUILDER_LEAD_NOTIFICATION_SUMMARY %', jsonb_build_object(
    'notification_key', 'builder-lead-email:' || submission_id_value::text,
    'recipient', 'firstfamdjs@gmail.com',
    'provider', 'resend-dry-run',
    'status', 'dry_run',
    'outbox_unchanged', true,
    'rls', 'anon/authenticated denied; service_role allowed'
  );
end;
$$;

reset role;
`;

const dir = mkdtempSync(join(tmpdir(), "eventsible-builder-lead-notifications-"));
const sqlPath = join(dir, "verify-builder-lead-notifications.sql");
writeFileSync(sqlPath, sql);

try {
  execFileSync("psql", [databaseUrl, "--no-password", "--file", sqlPath], {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD ?? "postgres",
    },
  });
} catch (error) {
  if (error.code === "ENOENT") {
    console.error("psql was not found; run this verification inside the local Supabase CI runner or install PostgreSQL client locally.");
  } else if (typeof error.status === "number") {
    console.error(`Builder lead notification verification failed with exit status ${error.status}.`);
  } else {
    console.error("Builder lead notification verification failed before SQL completed.");
  }
  process.exitCode = error.status || 1;
}
