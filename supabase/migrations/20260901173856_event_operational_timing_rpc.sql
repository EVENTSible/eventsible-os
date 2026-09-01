-- Atomically update the five allow-listed Gig Workspace operational timing facts
-- and record one canonical staff activity event. No general activity INSERT policy
-- is granted by this migration.

create or replace function public.os_update_event_operational_timing(
  p_event_id uuid,
  p_arrival_time text default null,
  p_load_in_window jsonb default null,
  p_setup_complete_by text default null,
  p_breakdown_start text default null,
  p_must_be_out text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_changed_fact_keys text[] := array[]::text[];
  v_load_in_window jsonb;
  v_now timestamptz := now();
begin
  if v_actor_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if not public.os_is_staff() then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;

  if not public.os_has_event_access(p_event_id) then
    raise exception using errcode = '42501', message = 'Event access is required.';
  end if;

  -- The row lock serializes this workflow for one event and also verifies that
  -- the canonical target exists before any fact is written.
  perform 1
  from public.os_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The canonical event was not found.';
  end if;

  if p_arrival_time is not null and p_arrival_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode = '22023', message = 'Arrival time must use HH:MM.';
  end if;
  if p_setup_complete_by is not null and p_setup_complete_by !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode = '22023', message = 'Setup complete time must use HH:MM.';
  end if;
  if p_breakdown_start is not null and p_breakdown_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode = '22023', message = 'Breakdown time must use HH:MM.';
  end if;
  if p_must_be_out is not null and p_must_be_out !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode = '22023', message = 'Must-be-out time must use HH:MM.';
  end if;

  if p_load_in_window is not null then
    if jsonb_typeof(p_load_in_window) <> 'object'
      or not (p_load_in_window ? 'start')
      or jsonb_typeof(p_load_in_window -> 'start') <> 'string'
      or exists (
        select 1
        from jsonb_object_keys(p_load_in_window) as supplied_key
        where supplied_key not in ('start', 'end')
      )
      or (p_load_in_window ->> 'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (
        p_load_in_window ? 'end'
        and jsonb_typeof(p_load_in_window -> 'end') not in ('string', 'null')
      )
      or (
        coalesce(jsonb_typeof(p_load_in_window -> 'end') = 'string', false)
        and (p_load_in_window ->> 'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      ) then
      raise exception using errcode = '22023', message = 'Load-in must contain only valid start and optional end HH:MM values.';
    end if;

    v_load_in_window := jsonb_build_object(
      'start', p_load_in_window ->> 'start',
      'end', case when jsonb_typeof(p_load_in_window -> 'end') = 'string' then p_load_in_window ->> 'end' else null end
    );
  end if;

  if p_arrival_time is not null and not exists (
    select 1 from public.os_event_facts
    where event_id = p_event_id and fact_key = 'event.arrival_time' and value = to_jsonb(p_arrival_time)
  ) then
    insert into public.os_event_facts (event_id, fact_key, value, source, is_confirmed, updated_by, updated_at)
    values (p_event_id, 'event.arrival_time', to_jsonb(p_arrival_time), 'staff', true, v_actor_user_id, v_now)
    on conflict (event_id, fact_key) do update set
      value = excluded.value, source = 'staff', is_confirmed = true,
      updated_by = v_actor_user_id, updated_at = v_now;
    v_changed_fact_keys := array_append(v_changed_fact_keys, 'event.arrival_time');
  end if;

  if v_load_in_window is not null and not exists (
    select 1 from public.os_event_facts
    where event_id = p_event_id and fact_key = 'event.load_in_window' and value = v_load_in_window
  ) then
    insert into public.os_event_facts (event_id, fact_key, value, source, is_confirmed, updated_by, updated_at)
    values (p_event_id, 'event.load_in_window', v_load_in_window, 'staff', true, v_actor_user_id, v_now)
    on conflict (event_id, fact_key) do update set
      value = excluded.value, source = 'staff', is_confirmed = true,
      updated_by = v_actor_user_id, updated_at = v_now;
    v_changed_fact_keys := array_append(v_changed_fact_keys, 'event.load_in_window');
  end if;

  if p_setup_complete_by is not null and not exists (
    select 1 from public.os_event_facts
    where event_id = p_event_id and fact_key = 'event.setup_complete_by' and value = to_jsonb(p_setup_complete_by)
  ) then
    insert into public.os_event_facts (event_id, fact_key, value, source, is_confirmed, updated_by, updated_at)
    values (p_event_id, 'event.setup_complete_by', to_jsonb(p_setup_complete_by), 'staff', true, v_actor_user_id, v_now)
    on conflict (event_id, fact_key) do update set
      value = excluded.value, source = 'staff', is_confirmed = true,
      updated_by = v_actor_user_id, updated_at = v_now;
    v_changed_fact_keys := array_append(v_changed_fact_keys, 'event.setup_complete_by');
  end if;

  if p_breakdown_start is not null and not exists (
    select 1 from public.os_event_facts
    where event_id = p_event_id and fact_key = 'event.breakdown_start' and value = to_jsonb(p_breakdown_start)
  ) then
    insert into public.os_event_facts (event_id, fact_key, value, source, is_confirmed, updated_by, updated_at)
    values (p_event_id, 'event.breakdown_start', to_jsonb(p_breakdown_start), 'staff', true, v_actor_user_id, v_now)
    on conflict (event_id, fact_key) do update set
      value = excluded.value, source = 'staff', is_confirmed = true,
      updated_by = v_actor_user_id, updated_at = v_now;
    v_changed_fact_keys := array_append(v_changed_fact_keys, 'event.breakdown_start');
  end if;

  if p_must_be_out is not null and not exists (
    select 1 from public.os_event_facts
    where event_id = p_event_id and fact_key = 'event.must_be_out' and value = to_jsonb(p_must_be_out)
  ) then
    insert into public.os_event_facts (event_id, fact_key, value, source, is_confirmed, updated_by, updated_at)
    values (p_event_id, 'event.must_be_out', to_jsonb(p_must_be_out), 'staff', true, v_actor_user_id, v_now)
    on conflict (event_id, fact_key) do update set
      value = excluded.value, source = 'staff', is_confirmed = true,
      updated_by = v_actor_user_id, updated_at = v_now;
    v_changed_fact_keys := array_append(v_changed_fact_keys, 'event.must_be_out');
  end if;

  if cardinality(v_changed_fact_keys) = 0 then
    return jsonb_build_object('status', 'noop', 'changed_fact_keys', '[]'::jsonb);
  end if;

  insert into public.os_activity_events (
    event_id,
    actor_user_id,
    event_type,
    visibility,
    payload
  ) values (
    p_event_id,
    v_actor_user_id,
    'event.operational_timing_updated',
    'staff',
    jsonb_build_object(
      'summary', 'Event-day operational timing updated.',
      'fact_keys', to_jsonb(v_changed_fact_keys)
    )
  );

  return jsonb_build_object('status', 'updated', 'changed_fact_keys', to_jsonb(v_changed_fact_keys));
end;
$$;

revoke all on function public.os_update_event_operational_timing(uuid, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.os_update_event_operational_timing(uuid, text, jsonb, text, text, text) to authenticated;
