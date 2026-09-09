import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const databaseUrl = process.env.SCHEMA_CATALOG_DB_URL;
const outputPath = process.argv[2];
const psql = process.env.PSQL_BIN || "psql";

if (!databaseUrl || !outputPath) {
  throw new Error("Set SCHEMA_CATALOG_DB_URL and provide an output JSON path.");
}

const query = String.raw`
with
relations as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'name', c.relname,
    'kind', c.relkind,
    'owner', pg_get_userbyid(c.relowner),
    'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity,
    'acl', coalesce(c.relacl::text, '')
  ) order by n.nspname, c.relname) value
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
),
columns as (
  select jsonb_agg(jsonb_build_object(
    'schema', table_schema,
    'table', table_name,
    'ordinal', ordinal_position,
    'name', column_name,
    'type', data_type,
    'udt', udt_schema || '.' || udt_name,
    'nullable', is_nullable,
    'default', coalesce(column_default, ''),
    'identity', is_identity,
    'identity_generation', coalesce(identity_generation, ''),
    'generated', is_generated
  ) order by table_schema, table_name, ordinal_position) value
  from information_schema.columns
  where table_schema in ('public', 'private')
),
constraints as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'table', c.relname,
    'name', con.conname,
    'type', con.contype,
    'validated', con.convalidated,
    'definition', pg_get_constraintdef(con.oid, true)
  ) order by n.nspname, c.relname, con.conname) value
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
),
indexes as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'table', t.relname,
    'name', i.relname,
    'valid', x.indisvalid,
    'ready', x.indisready,
    'primary', x.indisprimary,
    'unique', x.indisunique,
    'definition', pg_get_indexdef(i.oid)
  ) order by n.nspname, t.relname, i.relname) value
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname in ('public', 'private')
),
routines as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'name', p.proname,
    'identity_args', pg_get_function_identity_arguments(p.oid),
    'owner', pg_get_userbyid(p.proowner),
    'security_definer', p.prosecdef,
    'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
    'acl', coalesce(p.proacl::text, ''),
    'definition', pg_get_functiondef(p.oid)
  ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) value
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
),
triggers as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'table', c.relname,
    'name', t.tgname,
    'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid, true)
  ) order by n.nspname, c.relname, t.tgname) value
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and not t.tgisinternal
),
policies as (
  select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) value
  from pg_policies p
  where schemaname in ('public', 'private')
),
types as (
  select jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'name', t.typname,
    'kind', t.typtype,
    'owner', pg_get_userbyid(t.typowner),
    'enum_labels', coalesce((select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '[]'::jsonb)
  ) order by n.nspname, t.typname) value
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname in ('public', 'private') and t.typtype in ('e', 'd')
),
seed_summary as (
  select jsonb_object_agg(label, jsonb_build_object('count', count_value, 'content_hash', content_hash)) value
  from (
    select 'os_service_catalog' label, count(*) count_value,
      md5(coalesce(string_agg((to_jsonb(t) - 'id' - 'created_at' - 'updated_at')::text, '' order by code), '')) content_hash
      from public.os_service_catalog t
    union all
    select 'os_planning_templates', count(*),
      md5(coalesce(string_agg((to_jsonb(t) - 'id' - 'created_by' - 'created_at' - 'updated_at')::text, '' order by slug), ''))
      from public.os_planning_templates t
    union all
    select 'os_planning_sections', count(*),
      md5(coalesce(string_agg((to_jsonb(s) - 'id' - 'template_id' - 'created_at' - 'updated_at'
        || jsonb_build_object('template_slug', t.slug))::text, '' order by t.slug, s.section_key), ''))
      from public.os_planning_sections s
      join public.os_planning_templates t on t.id = s.template_id
    union all
    select 'os_planning_questions', count(*),
      md5(coalesce(string_agg((to_jsonb(q) - 'id' - 'section_id' - 'created_at' - 'updated_at'
        || jsonb_build_object('template_slug', t.slug, 'section_key', s.section_key))::text,
        '' order by t.slug, s.section_key, q.question_key), ''))
      from public.os_planning_questions q
      join public.os_planning_sections s on s.id = q.section_id
      join public.os_planning_templates t on t.id = s.template_id
  ) seeds
)
select jsonb_build_object(
  'format', 'eventsible_application_schema_catalog_v1',
  'relations', coalesce(relations.value, '[]'::jsonb),
  'columns', coalesce(columns.value, '[]'::jsonb),
  'constraints', coalesce(constraints.value, '[]'::jsonb),
  'indexes', coalesce(indexes.value, '[]'::jsonb),
  'routines', coalesce(routines.value, '[]'::jsonb),
  'triggers', coalesce(triggers.value, '[]'::jsonb),
  'policies', coalesce(policies.value, '[]'::jsonb),
  'types', coalesce(types.value, '[]'::jsonb),
  'seed_summary', coalesce(seed_summary.value, '{}'::jsonb)
)
from relations, columns, constraints, indexes, routines, triggers, policies, types, seed_summary;
`;

const result = spawnSync(
  psql,
  ["--no-psqlrc", "--no-align", "--tuples-only", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--command", query],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  const safeError = `${result.stderr || result.stdout || "psql failed"}`.replaceAll(databaseUrl, "<redacted-db-url>");
  throw new Error(safeError.trim());
}

const catalog = JSON.parse(result.stdout.trim());
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, { mode: 0o600 });
console.log(`Sanitized application schema catalog written to ${outputPath}.`);
