import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (databaseUrl.includes(productionRef) || databaseUrl.includes("supabase.co")) {
  throw new Error("Refusing to verify helper grants against a remote or Production Supabase database URL.");
}

const helperSignature = "public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)";
const intakeSignature = "public.os_ingest_builder_submission(jsonb)";

const sql = String.raw`
\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure('public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)') is null then
    raise exception 'Expected outbox helper signature is missing.';
  end if;

  if to_regprocedure('public.os_ingest_builder_submission(jsonb)') is null then
    raise exception 'Existing Builder intake function signature is missing.';
  end if;

  if has_function_privilege('public', 'public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)', 'execute') then
    raise exception 'Outbox helper must not be executable by public.';
  end if;

  if has_function_privilege('anon', 'public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)', 'execute') then
    raise exception 'Outbox helper must not be executable by anon.';
  end if;

  if has_function_privilege('authenticated', 'public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)', 'execute') then
    raise exception 'Outbox helper must not be executable by authenticated.';
  end if;

  if not has_function_privilege('service_role', 'public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)', 'execute') then
    raise exception 'Outbox helper must be executable by service_role.';
  end if;

  if has_table_privilege('anon', 'public.os_integration_outbox', 'select') then
    raise exception 'Outbox table must not be selectable by anon.';
  end if;

  if has_table_privilege('anon', 'public.os_integration_outbox', 'insert') then
    raise exception 'Outbox table must not be insertable by anon.';
  end if;

  if has_table_privilege('authenticated', 'public.os_integration_outbox', 'select') then
    raise exception 'Outbox table must not be selectable by authenticated.';
  end if;
end $$;

select 'outbox helper grant parity verified' as result;
`;

const dir = mkdtempSync(join(tmpdir(), "eventsible-outbox-grants-"));
const sqlPath = join(dir, "verify-outbox-helper-grants.sql");
writeFileSync(sqlPath, sql);

try {
  execFileSync("psql", [databaseUrl, "--no-password", "--file", sqlPath], {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD ?? "postgres",
    },
  });
  console.log(`Verified ${helperSignature} is service-role-only and ${intakeSignature} still exists.`);
} catch (error) {
  process.exitCode = error.status || 1;
}
