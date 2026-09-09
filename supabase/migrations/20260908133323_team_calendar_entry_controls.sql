-- Team Calendar entry controls: additive entry types and privacy-safe snapshots.
-- Existing availability rows remain valid; this migration performs no backfill.

alter table public.os_team_availability
  drop constraint os_team_availability_type_chk;

alter table public.os_team_availability
  add constraint os_team_availability_type_chk
  check (entry_type in ('available', 'unavailable', 'outside_booking', 'vacation', 'reminder', 'note'));

create or replace function public.os_upsert_team_availability(
  p_entry_id uuid,
  p_team_member_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.os_team_members%rowtype;
  v_existing public.os_team_availability%rowtype;
  v_id uuid;
  v_all_day boolean;
  v_entry_type text;
  v_privacy text;
  v_timezone text;
  v_title text;
  v_notes text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_starts_on date;
  v_ends_on date;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.self.manage') then
    raise exception using errcode = '42501', message = 'Schedule access is required.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_payload) as key
    where key not in ('entryType', 'allDay', 'startsAt', 'endsAt', 'startsOn', 'endsOn', 'timezone', 'title', 'privateNotes', 'privacy')
  ) then
    raise exception using errcode = '22023', message = 'The availability payload is invalid.';
  end if;

  select * into v_member from public.os_team_members where id = p_team_member_id and status = 'active';
  if not found then raise exception using errcode = 'P0002', message = 'The team member was not found.'; end if;
  if v_member.user_id <> v_actor and not public.os_has_hq_capability('schedule.team.manage') then
    raise exception using errcode = '42501', message = 'Only your own schedule may be changed.';
  end if;

  if p_entry_id is not null then
    select * into v_existing from public.os_team_availability where id = p_entry_id for update;
    if not found or v_existing.team_member_id <> p_team_member_id then
      raise exception using errcode = 'P0002', message = 'The availability entry was not found.';
    end if;
  end if;

  if coalesce(p_payload->>'allDay', 'false') not in ('true', 'false') then
    raise exception using errcode = '22023', message = 'The all-day value is invalid.';
  end if;
  v_all_day := coalesce((p_payload->>'allDay')::boolean, false);
  v_entry_type := p_payload->>'entryType';
  v_privacy := p_payload->>'privacy';
  v_timezone := coalesce(nullif(btrim(p_payload->>'timezone'), ''), v_member.timezone);
  v_title := nullif(btrim(p_payload->>'title'), '');
  v_notes := nullif(btrim(p_payload->>'privateNotes'), '');

  -- Owners may correct another member's occupied window, but must not receive or
  -- overwrite that member's privacy choice, type, title, or private notes.
  if p_entry_id is not null and v_member.user_id <> v_actor then
    v_entry_type := v_existing.entry_type;
    v_privacy := v_existing.privacy;
    v_title := v_existing.title;
    v_notes := v_existing.private_notes;
  end if;

  if v_entry_type not in ('available', 'unavailable', 'outside_booking', 'vacation', 'reminder', 'note')
    or v_privacy not in ('busy_only', 'team_details', 'private')
    or char_length(coalesce(v_title, '')) > 120 or char_length(coalesce(v_notes, '')) > 2000
    or char_length(v_timezone) > 100 or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'Check the availability details.';
  end if;

  begin
    if v_all_day then
      v_starts_on := (p_payload->>'startsOn')::date;
      v_ends_on := (p_payload->>'endsOn')::date;
      if v_starts_on is null or v_ends_on is null or v_ends_on < v_starts_on then raise exception 'invalid'; end if;
    else
      v_starts_at := (p_payload->>'startsAt')::timestamptz;
      v_ends_at := (p_payload->>'endsAt')::timestamptz;
      if v_starts_at is null or v_ends_at is null or v_ends_at <= v_starts_at then raise exception 'invalid'; end if;
    end if;
  exception when others then
    raise exception using errcode = '22023', message = 'A valid start and end are required.';
  end;

  if p_entry_id is null then
    insert into public.os_team_availability(
      team_member_id, entry_type, all_day, starts_at, ends_at, starts_on, ends_on,
      timezone, title, private_notes, privacy, created_by_user_id, updated_by_user_id
    ) values (
      p_team_member_id, v_entry_type, v_all_day, v_starts_at, v_ends_at, v_starts_on, v_ends_on,
      v_timezone, v_title, v_notes, v_privacy, v_actor, v_actor
    ) returning id into v_id;
  else
    update public.os_team_availability
    set entry_type = v_entry_type, all_day = v_all_day, starts_at = v_starts_at, ends_at = v_ends_at,
        starts_on = v_starts_on, ends_on = v_ends_on, timezone = v_timezone, title = v_title,
        private_notes = v_notes, privacy = v_privacy, updated_by_user_id = v_actor
    where id = p_entry_id
    returning id into v_id;
  end if;

  return jsonb_build_object('status', case when p_entry_id is null then 'created' else 'updated' end, 'entry_id', v_id);
end;
$$;

create or replace function public.os_team_calendar_snapshot(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_self_member_id uuid;
  v_is_owner boolean;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.read') then
    raise exception using errcode = '42501', message = 'Schedule access is required.';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception using errcode = '22023', message = 'The calendar range is invalid.';
  end if;
  select id into v_self_member_id from public.os_team_members where user_id = v_actor and status = 'active';
  v_is_owner := public.os_has_hq_capability('schedule.team.manage');

  return jsonb_build_object(
    'currentTeamMemberId', v_self_member_id,
    'canManageTeam', v_is_owner,
    'canManageAssignments', public.os_has_hq_capability('schedule.assignments.manage'),
    'teamMembers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'displayName', m.display_name, 'timezone', m.timezone,
        'status', m.status, 'isSelf', m.id = v_self_member_id
      ) order by m.display_name)
      from public.os_team_members m
      where m.status = 'active' or v_is_owner
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'teamMemberId', a.team_member_id,
        'entryType', case
          when a.team_member_id = v_self_member_id or a.privacy = 'team_details' then a.entry_type
          else 'unavailable'
        end,
        'allDay', a.all_day, 'startsAt', a.starts_at, 'endsAt', a.ends_at,
        'startsOn', a.starts_on, 'endsOn', a.ends_on, 'timezone', a.timezone,
        'privacy', case
          when a.team_member_id = v_self_member_id then a.privacy
          when a.privacy = 'team_details' then 'team_details'
          else 'busy_only'
        end,
        'title', case
          when a.team_member_id = v_self_member_id then a.title
          when a.privacy = 'team_details' then a.title
          when a.entry_type = 'outside_booking' then 'Busy'
          else 'Unavailable'
        end,
        'privateNotes', case when a.team_member_id = v_self_member_id then a.private_notes else null end,
        'canEdit', a.team_member_id = v_self_member_id or v_is_owner,
        'canRemove', a.team_member_id = v_self_member_id
      ) order by coalesce(a.starts_at, a.starts_on::timestamptz), a.created_at)
      from public.os_team_availability a
      where (
        (a.all_day and a.starts_on <= p_to and a.ends_on >= p_from)
        or (not a.all_day
          and a.starts_at < ((p_to + 1)::timestamp at time zone 'America/Indiana/Indianapolis')
          and a.ends_at > (p_from::timestamp at time zone 'America/Indiana/Indianapolis'))
      )
      and (
        a.team_member_id = v_self_member_id
        or a.privacy = 'team_details'
        or a.entry_type in ('unavailable', 'outside_booking', 'vacation')
      )
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'eventId', s.event_id, 'teamMemberId', s.team_member_id,
        'assignmentRole', s.assignment_role, 'callTime', s.call_time,
        'status', s.status
      ) order by s.call_time nulls last, s.created_at)
      from public.os_staff_assignments s
      join public.os_events e on e.id = s.event_id
      where s.status = 'assigned'
        and e.starts_at is not null
        and e.starts_at < ((p_to + 1)::timestamp at time zone coalesce(nullif(e.timezone, ''), 'America/Indiana/Indianapolis'))
        and coalesce(e.ends_at, e.starts_at + interval '4 hours') > (p_from::timestamp at time zone coalesce(nullif(e.timezone, ''), 'America/Indiana/Indianapolis'))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.os_upsert_team_availability(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.os_team_calendar_snapshot(date, date) from public, anon, authenticated;
grant execute on function public.os_upsert_team_availability(uuid, uuid, jsonb) to authenticated;
grant execute on function public.os_team_calendar_snapshot(date, date) to authenticated;

-- Rollback: restore the Phase 1 versions of os_upsert_team_availability and
-- os_team_calendar_snapshot, then restore os_team_availability_type_chk to the
-- original three blocking types. Existing rows using the additive types must
-- be preserved/exported before constraint rollback; no canonical business row
-- is created, changed, backfilled, or deleted by this migration.

