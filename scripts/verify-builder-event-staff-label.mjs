import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (databaseUrl.includes(productionRef) || databaseUrl.includes("supabase.co")) {
  throw new Error("Refusing to run Event Staff label verification against a remote or Production Supabase database URL.");
}

const sql = String.raw`
\set ON_ERROR_STOP on

set role service_role;

do $$
declare
  quote_version_id_value uuid;
  event_id_value uuid;
  item_id_value uuid;
  normalized_name text;
  normalized_results jsonb := '[]'::jsonb;
  variant record;
begin
  if to_regprocedure('public.os_normalize_builder_quote_item_service_name()') is null then
    raise exception 'Event Staff quote-item normalization helper is missing.';
  end if;

  if not exists (
    select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'os_quote_items'
       and t.tgname = 'os_quote_items_builder_service_name_trg'
       and not t.tgisinternal
  ) then
    raise exception 'Event Staff quote-item normalization trigger is missing.';
  end if;

  select q.id, q.event_id
    into quote_version_id_value, event_id_value
    from public.os_quote_versions q
   order by q.created_at, q.id
   limit 1;

  if quote_version_id_value is null or event_id_value is null then
    raise exception 'Event Staff label verification requires an existing synthetic quote version.';
  end if;

  for variant in
    select service_code
      from (values ('event_staff'), ('event-asst'), ('event_asst')) as v(service_code)
  loop
    insert into public.os_quote_items(
      quote_version_id,
      event_id,
      service_id,
      service_code,
      service_name,
      label,
      quantity,
      unit,
      unit_price_cents,
      line_total_cents,
      custom_quote,
      metadata
    )
    values (
      quote_version_id_value,
      event_id_value,
      'event-staff-label-fixture-' || replace(variant.service_code, '_', '-') || '-' || gen_random_uuid()::text,
      variant.service_code,
      variant.service_code,
      variant.service_code,
      1,
      'hour',
      3500,
      3500,
      false,
      jsonb_build_object('synthetic', true, 'fixture', 'event_staff_label', 'service_code', variant.service_code)
    )
    returning id, service_name into item_id_value, normalized_name;

    if normalized_name <> 'Event Staff' then
      raise exception 'Event Staff service_name was not normalized for service_code %. service_name=%', variant.service_code, normalized_name;
    end if;

    normalized_results := normalized_results || jsonb_build_object(
      'quote_item_id', item_id_value,
      'service_code', variant.service_code,
      'service_name', normalized_name
    );
  end loop;

  if not has_function_privilege('service_role', 'public.os_normalize_builder_quote_item_service_name()', 'EXECUTE') then
    raise exception 'service_role cannot execute Event Staff normalization helper.';
  end if;

  if has_function_privilege('anon', 'public.os_normalize_builder_quote_item_service_name()', 'EXECUTE') then
    raise exception 'anon can execute Event Staff normalization helper.';
  end if;

  if has_function_privilege('authenticated', 'public.os_normalize_builder_quote_item_service_name()', 'EXECUTE') then
    raise exception 'authenticated can execute Event Staff normalization helper.';
  end if;

  raise notice 'EVENTSIBLE_EVENT_STAFF_LABEL_SUMMARY %', jsonb_build_object(
    'normalized_items', normalized_results,
    'scope', 'future quote-item insert only',
    'production_mutation', false
  );
end;
$$;

reset role;
`;

const dir = mkdtempSync(join(tmpdir(), "eventsible-event-staff-label-"));
const sqlPath = join(dir, "verify-event-staff-label.sql");
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
  process.exitCode = error.status || 1;
}
