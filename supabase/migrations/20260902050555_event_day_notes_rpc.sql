-- Create or update one staff-private canonical event-day note and record its
-- activity atomically. The caller cannot choose the note type, visibility,
-- status, author, activity actor, or activity payload.

create function public.os_upsert_event_day_note(
  p_event_id uuid,
  p_note_id uuid,
  p_body text,
  p_is_pinned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_body text;
  v_note_id uuid;
  v_current_event_id uuid;
  v_current_note_type text;
  v_current_body text;
  v_current_is_pinned boolean;
  v_current_visibility text;
  v_current_status text;
  v_action text;
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

  if p_event_id is null then
    raise exception using errcode = '22023', message = 'A canonical event is required.';
  end if;

  if p_is_pinned is null then
    raise exception using errcode = '22023', message = 'Pinned state is required.';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' or char_length(v_body) > 1500 then
    raise exception using errcode = '22023', message = 'Event-day note must contain 1 to 1500 characters.';
  end if;

  perform 1
  from public.os_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The canonical event was not found.';
  end if;

  if p_note_id is null then
    insert into public.os_event_notes (
      event_id,
      author_user_id,
      note_type,
      body,
      is_pinned,
      visibility,
      status
    ) values (
      p_event_id,
      v_actor_user_id,
      'event_day',
      v_body,
      p_is_pinned,
      'staff',
      'active'
    )
    returning id into v_note_id;

    v_action := 'created';
  else
    select event_id, note_type, body, is_pinned, visibility, status
    into v_current_event_id, v_current_note_type, v_current_body,
      v_current_is_pinned, v_current_visibility, v_current_status
    from public.os_event_notes
    where id = p_note_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'The event-day note was not found.';
    end if;

    if v_current_event_id <> p_event_id then
      raise exception using errcode = '42501', message = 'The note does not belong to this event.';
    end if;

    if v_current_note_type <> 'event_day'
      or v_current_visibility <> 'staff'
      or v_current_status <> 'active' then
      raise exception using errcode = '22023', message = 'Only active staff event-day notes can be updated.';
    end if;

    if v_current_body = v_body and v_current_is_pinned = p_is_pinned then
      return jsonb_build_object(
        'status', 'noop',
        'note_id', p_note_id,
        'is_pinned', p_is_pinned
      );
    end if;

    update public.os_event_notes
    set body = v_body,
        is_pinned = p_is_pinned
    where id = p_note_id;

    v_note_id := p_note_id;
    v_action := 'updated';
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
    case
      when v_action = 'created' then 'event.event_day_note_created'
      else 'event.event_day_note_updated'
    end,
    'staff',
    jsonb_build_object(
      'summary', case
        when v_action = 'created' then 'Event-day note created.'
        else 'Event-day note updated.'
      end,
      'note_id', v_note_id,
      'action', v_action,
      'is_pinned', p_is_pinned
    )
  );

  return jsonb_build_object(
    'status', v_action,
    'note_id', v_note_id,
    'is_pinned', p_is_pinned
  );
end;
$$;

revoke all on function public.os_upsert_event_day_note(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.os_upsert_event_day_note(uuid, uuid, text, boolean)
  to authenticated;
