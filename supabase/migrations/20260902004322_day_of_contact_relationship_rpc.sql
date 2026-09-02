-- Add one canonical event-scoped Day-Of Contact relationship and a fixed,
-- transactional staff RPC. Legacy metadata remains read-only and is not
-- migrated or rewritten by this migration.

alter table public.os_events
  add column day_of_contact_id uuid;

alter table public.os_events
  add constraint os_events_day_of_contact_id_fkey
  foreign key (day_of_contact_id)
  references public.os_contacts(id)
  on delete set null;

create index os_events_day_of_contact_idx
  on public.os_events (day_of_contact_id);

create function public.os_update_event_day_of_contact(
  p_event_id uuid,
  p_day_of_contact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_current_contact_id uuid;
  v_primary_contact_id uuid;
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

  if p_day_of_contact_id is null then
    raise exception using errcode = '22023', message = 'Select an existing canonical contact.';
  end if;

  select day_of_contact_id, primary_contact_id
  into v_current_contact_id, v_primary_contact_id
  from public.os_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The canonical event was not found.';
  end if;

  if not exists (
    select 1
    from public.os_contacts
    where id = p_day_of_contact_id
      and status = 'active'
  ) then
    raise exception using errcode = '23503', message = 'The selected active canonical contact was not found.';
  end if;

  if v_current_contact_id = p_day_of_contact_id then
    return jsonb_build_object(
      'status', 'noop',
      'same_as_primary', p_day_of_contact_id = v_primary_contact_id
    );
  end if;

  update public.os_events
  set day_of_contact_id = p_day_of_contact_id
  where id = p_event_id;

  insert into public.os_activity_events (
    event_id,
    contact_id,
    actor_user_id,
    event_type,
    visibility,
    payload
  ) values (
    p_event_id,
    p_day_of_contact_id,
    v_actor_user_id,
    'event.day_of_contact_updated',
    'staff',
    jsonb_build_object(
      'summary', 'Day-of contact updated.',
      'field', 'day_of_contact_id',
      'same_as_primary', p_day_of_contact_id = v_primary_contact_id
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'same_as_primary', p_day_of_contact_id = v_primary_contact_id
  );
end;
$$;

revoke all on function public.os_update_event_day_of_contact(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.os_update_event_day_of_contact(uuid, uuid)
  to authenticated;
