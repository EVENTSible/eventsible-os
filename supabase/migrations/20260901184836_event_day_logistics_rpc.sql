-- Transactionally update the four fixed Gig Workspace event-day logistics settings
-- and record one canonical staff activity event. The function does not accept
-- arbitrary settings, actor, activity, or visibility input.

create or replace function public.os_update_event_day_logistics(
  p_event_id uuid,
  p_staff_call_time text default null,
  p_setup_start text default null,
  p_room_area text default null,
  p_load_in_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_current_settings jsonb;
  v_next_settings jsonb;
  v_changed_fields text[] := array[]::text[];
  v_staff_call_time text;
  v_setup_start text;
  v_room_area text;
  v_load_in_details text;
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

  select coalesce(settings, '{}'::jsonb)
  into v_current_settings
  from public.os_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The canonical event was not found.';
  end if;

  if p_staff_call_time is not null then
    v_staff_call_time := btrim(p_staff_call_time);
    if v_staff_call_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode = '22023', message = 'Staff call time must use HH:MM.';
    end if;
  end if;

  if p_setup_start is not null then
    v_setup_start := btrim(p_setup_start);
    if v_setup_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode = '22023', message = 'Setup start must use HH:MM.';
    end if;
  end if;

  if p_room_area is not null then
    v_room_area := btrim(p_room_area);
    if v_room_area = '' or char_length(v_room_area) > 160 then
      raise exception using errcode = '22023', message = 'Room or area must contain 1 to 160 characters.';
    end if;
  end if;

  if p_load_in_details is not null then
    v_load_in_details := btrim(p_load_in_details);
    if v_load_in_details = '' or char_length(v_load_in_details) > 1500 then
      raise exception using errcode = '22023', message = 'Load-in details must contain 1 to 1500 characters.';
    end if;
  end if;

  v_next_settings := v_current_settings;

  if v_staff_call_time is not null
    and v_current_settings ->> 'staff_call_time' is distinct from v_staff_call_time then
    v_next_settings := jsonb_set(v_next_settings, '{staff_call_time}', to_jsonb(v_staff_call_time), true);
    v_changed_fields := array_append(v_changed_fields, 'staff_call_time');
  end if;

  if v_setup_start is not null
    and v_current_settings ->> 'setup_start' is distinct from v_setup_start then
    v_next_settings := jsonb_set(v_next_settings, '{setup_start}', to_jsonb(v_setup_start), true);
    v_changed_fields := array_append(v_changed_fields, 'setup_start');
  end if;

  if v_room_area is not null
    and v_current_settings ->> 'room_area' is distinct from v_room_area then
    v_next_settings := jsonb_set(v_next_settings, '{room_area}', to_jsonb(v_room_area), true);
    v_changed_fields := array_append(v_changed_fields, 'room_area');
  end if;

  if v_load_in_details is not null
    and v_current_settings ->> 'load_in_details' is distinct from v_load_in_details then
    v_next_settings := jsonb_set(v_next_settings, '{load_in_details}', to_jsonb(v_load_in_details), true);
    v_changed_fields := array_append(v_changed_fields, 'load_in_details');
  end if;

  if cardinality(v_changed_fields) = 0 then
    return jsonb_build_object('status', 'noop', 'changed_fields', '[]'::jsonb);
  end if;

  update public.os_events
  set settings = v_next_settings
  where id = p_event_id;

  insert into public.os_activity_events (
    event_id,
    actor_user_id,
    event_type,
    visibility,
    payload
  ) values (
    p_event_id,
    v_actor_user_id,
    'event.event_day_logistics_updated',
    'staff',
    jsonb_build_object(
      'summary', 'Event-day logistics updated.',
      'fields', to_jsonb(v_changed_fields)
    )
  );

  return jsonb_build_object('status', 'updated', 'changed_fields', to_jsonb(v_changed_fields));
end;
$$;

revoke all on function public.os_update_event_day_logistics(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.os_update_event_day_logistics(uuid, text, text, text, text) to authenticated;
