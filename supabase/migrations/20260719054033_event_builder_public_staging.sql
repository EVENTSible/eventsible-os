do $block$
declare
  function_sql text;
begin
  select pg_get_functiondef(p.oid) into function_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'os_ingest_builder_submission'
    and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  function_sql := replace(
    function_sql,
    E'  if current_user <> ''service_role'' then raise exception ''service_role required''; end if;\n',
    ''
  );
  execute function_sql;
end;
$block$;

revoke all on function public.os_ingest_builder_submission(jsonb) from public, anon, authenticated;
grant execute on function public.os_ingest_builder_submission(jsonb) to service_role;

create table if not exists public.os_builder_intake_requests (
  id uuid primary key default gen_random_uuid(),
  source_session_id text not null,
  request_fingerprint text not null,
  submitted_from text,
  payload jsonb not null,
  intake_version integer not null default 1 check (intake_version > 0),
  status text not null default 'received' check (status in ('received','processed','failed')),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_builder_intake_source_session_format check (source_session_id ~ '^[A-Za-z0-9._:-]{8,120}$'),
  constraint os_builder_intake_payload_size check (octet_length(payload::text) <= 128000)
);

create unique index if not exists os_builder_intake_source_session_unique
  on public.os_builder_intake_requests(source_session_id);
create index if not exists os_builder_intake_fingerprint_created_idx
  on public.os_builder_intake_requests(request_fingerprint, created_at desc);

alter table public.os_builder_intake_requests enable row level security;

drop policy if exists os_builder_intake_public_insert on public.os_builder_intake_requests;
create policy os_builder_intake_public_insert
on public.os_builder_intake_requests
for insert
to anon, authenticated
with check (
  status = 'received'
  and result = '{}'::jsonb
  and error_message is null
  and processed_at is null
);

drop policy if exists os_builder_intake_staff_select on public.os_builder_intake_requests;
create policy os_builder_intake_staff_select
on public.os_builder_intake_requests
for select
to authenticated
using (public.os_is_staff());

drop policy if exists os_builder_intake_staff_update on public.os_builder_intake_requests;
create policy os_builder_intake_staff_update
on public.os_builder_intake_requests
for update
to authenticated
using (public.os_is_staff())
with check (public.os_is_staff());

drop policy if exists os_builder_intake_staff_delete on public.os_builder_intake_requests;
create policy os_builder_intake_staff_delete
on public.os_builder_intake_requests
for delete
to authenticated
using (public.os_is_staff());

grant insert on public.os_builder_intake_requests to anon, authenticated;
grant select, update, delete on public.os_builder_intake_requests to authenticated;

create or replace function private.os_process_builder_intake_request()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
as $function$
declare
  recent_count integer;
  intake_result jsonb;
begin
  select count(*) into recent_count
  from public.os_builder_intake_requests r
  where r.request_fingerprint = new.request_fingerprint
    and r.created_at >= now() - interval '15 minutes';

  if recent_count > 10 then
    raise exception 'builder intake rate limit exceeded';
  end if;

  intake_result := public.os_ingest_builder_submission(
    jsonb_build_object(
      'source_session_id', new.source_session_id,
      'source', 'lovable_event_builder',
      'request_fingerprint', new.request_fingerprint,
      'submitted_from', new.submitted_from,
      'intake_version', new.intake_version,
      'raw_payload', new.payload,
      'normalized_payload', new.payload
    )
  );

  update public.os_builder_intake_requests
  set status = 'processed',
      result = intake_result,
      processed_at = now(),
      updated_at = now()
  where id = new.id;

  return new;
end;
$function$;

revoke all on function private.os_process_builder_intake_request() from public;

drop trigger if exists os_builder_intake_process on public.os_builder_intake_requests;
create trigger os_builder_intake_process
after insert on public.os_builder_intake_requests
for each row execute function private.os_process_builder_intake_request();

create trigger os_builder_intake_updated_at
before update on public.os_builder_intake_requests
for each row execute function public.os_set_updated_at();