-- EVENTSible HQ Team Availability and Shared Master Calendar Phase 1.
-- Personal commitments remain separate from canonical EVENTSible events.

create or replace function public.os_has_hq_capability(p_capability text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case public.os_staff_role()
    when 'owner' then p_capability = any (array[
      'hq.read', 'lead.lifecycle.manage', 'quote.approve', 'gig.convert',
      'client.activate', 'import.candidate.create', 'import.review',
      'import.finalize', 'event.operations.write', 'event.notes.write',
      'task.write', 'catalog.manage', 'planning.structure.manage',
      'data.delete', 'staff.manage', 'system.manage', 'schedule.read',
      'schedule.self.manage', 'schedule.team.manage',
      'schedule.assignments.manage'
    ]::text[])
    when 'manager' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write', 'schedule.read',
      'schedule.self.manage'
    ]::text[])
    when 'staff' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write', 'schedule.read',
      'schedule.self.manage'
    ]::text[])
    when 'host' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write', 'schedule.read',
      'schedule.self.manage'
    ]::text[])
    else false
  end;
$$;

create table public.os_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null,
  timezone text not null default 'America/Indiana/Indianapolis',
  status text not null default 'active',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_team_members_display_name_chk check (char_length(btrim(display_name)) between 1 and 100),
  constraint os_team_members_timezone_chk check (char_length(timezone) between 1 and 100),
  constraint os_team_members_status_chk check (status in ('active', 'inactive'))
);

create table public.os_team_availability (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.os_team_members(id) on delete restrict,
  entry_type text not null,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  starts_on date,
  ends_on date,
  timezone text not null default 'America/Indiana/Indianapolis',
  title text,
  private_notes text,
  privacy text not null default 'busy_only',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_team_availability_type_chk check (entry_type in ('outside_booking', 'unavailable', 'vacation')),
  constraint os_team_availability_privacy_chk check (privacy in ('busy_only', 'team_details', 'private')),
  constraint os_team_availability_timezone_chk check (char_length(timezone) between 1 and 100),
  constraint os_team_availability_title_chk check (title is null or char_length(title) <= 120),
  constraint os_team_availability_notes_chk check (private_notes is null or char_length(private_notes) <= 2000),
  constraint os_team_availability_window_chk check (
    (all_day and starts_on is not null and ends_on is not null and ends_on >= starts_on and starts_at is null and ends_at is null)
    or
    (not all_day and starts_at is not null and ends_at is not null and ends_at > starts_at and starts_on is null and ends_on is null)
  )
);

create table public.os_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete restrict,
  team_member_id uuid not null references public.os_team_members(id) on delete restrict,
  assignment_role text not null,
  call_time timestamptz,
  status text not null default 'assigned',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_staff_assignments_role_chk check (assignment_role in ('dj', 'mc', 'vocalist', 'assistant', 'activity_helper', 'operator', 'other')),
  constraint os_staff_assignments_status_chk check (status in ('assigned', 'cancelled'))
);

create index os_team_members_status_idx on public.os_team_members(status, display_name);
create index os_team_availability_member_timed_idx on public.os_team_availability(team_member_id, starts_at, ends_at) where not all_day;
create index os_team_availability_member_all_day_idx on public.os_team_availability(team_member_id, starts_on, ends_on) where all_day;
create index os_staff_assignments_event_idx on public.os_staff_assignments(event_id, status);
create index os_staff_assignments_member_idx on public.os_staff_assignments(team_member_id, status);
create unique index os_staff_assignments_active_unique_idx on public.os_staff_assignments(event_id, team_member_id) where status = 'assigned';

create trigger os_team_members_set_updated_at before update on public.os_team_members
for each row execute function public.os_set_updated_at();
create trigger os_team_availability_set_updated_at before update on public.os_team_availability
for each row execute function public.os_set_updated_at();
create trigger os_staff_assignments_set_updated_at before update on public.os_staff_assignments
for each row execute function public.os_set_updated_at();

alter table public.os_team_members enable row level security;
alter table public.os_team_availability enable row level security;
alter table public.os_staff_assignments enable row level security;

revoke all on public.os_team_members from public, anon, authenticated;
revoke all on public.os_team_availability from public, anon, authenticated;
revoke all on public.os_staff_assignments from public, anon, authenticated;
grant all on public.os_team_members to service_role;
grant all on public.os_team_availability to service_role;
grant all on public.os_staff_assignments to service_role;

create or replace function public.os_ensure_my_team_member(
  p_display_name text default null,
  p_timezone text default 'America/Indiana/Indianapolis'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.os_team_members%rowtype;
  v_display_name text := coalesce(nullif(btrim(p_display_name), ''), 'Team member');
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'America/Indiana/Indianapolis');
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.self.manage') then
    raise exception using errcode = '42501', message = 'Schedule access is required.';
  end if;
  if char_length(v_display_name) > 100 or char_length(v_timezone) > 100 or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception using errcode = '22023', message = 'Valid team-member details are required.';
  end if;

  insert into public.os_team_members(user_id, display_name, timezone, created_by_user_id)
  values (v_actor, v_display_name, v_timezone, v_actor)
  on conflict (user_id) do nothing
  returning * into v_member;

  if v_member.id is null then
    select * into v_member from public.os_team_members where user_id = v_actor;
  end if;

  return jsonb_build_object('status', 'ready', 'team_member_id', v_member.id);
end;
$$;

create or replace function public.os_manage_team_member(
  p_team_member_id uuid,
  p_display_name text,
  p_timezone text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
  v_timezone text := btrim(coalesce(p_timezone, ''));
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.team.manage') then
    raise exception using errcode = '42501', message = 'Owner schedule access is required.';
  end if;
  if p_team_member_id is null or char_length(v_name) not between 1 and 100 or char_length(v_timezone) not between 1 and 100
    or p_status not in ('active', 'inactive') or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'Valid team-member details are required.';
  end if;

  update public.os_team_members
  set display_name = v_name, timezone = v_timezone, status = p_status
  where id = p_team_member_id;
  if not found then raise exception using errcode = 'P0002', message = 'The team member was not found.'; end if;
  return jsonb_build_object('status', 'updated', 'team_member_id', p_team_member_id);
end;
$$;

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
  -- overwrite that member's privacy choice, title, or private notes.
  if p_entry_id is not null and v_member.user_id <> v_actor then
    v_entry_type := v_existing.entry_type;
    v_privacy := v_existing.privacy;
    v_title := v_existing.title;
    v_notes := v_existing.private_notes;
  end if;

  if v_entry_type not in ('outside_booking', 'unavailable', 'vacation') or v_privacy not in ('busy_only', 'team_details', 'private')
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

create or replace function public.os_remove_team_availability(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member_user_id uuid;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.self.manage') then
    raise exception using errcode = '42501', message = 'Schedule access is required.';
  end if;
  select m.user_id into v_member_user_id
  from public.os_team_availability a
  join public.os_team_members m on m.id = a.team_member_id
  where a.id = p_entry_id;
  if not found then raise exception using errcode = 'P0002', message = 'The availability entry was not found.'; end if;
  if v_member_user_id <> v_actor then
    raise exception using errcode = '42501', message = 'Only your own schedule may be changed.';
  end if;
  delete from public.os_team_availability where id = p_entry_id;
  return jsonb_build_object('status', 'removed', 'entry_id', p_entry_id);
end;
$$;

create or replace function public.os_manage_staff_assignment(
  p_action text,
  p_assignment_id uuid,
  p_event_id uuid,
  p_team_member_id uuid,
  p_assignment_role text default null,
  p_call_time timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if not public.os_has_hq_capability('schedule.assignments.manage') then
    raise exception using errcode = '42501', message = 'Owner assignment access is required.';
  end if;
  if p_action not in ('upsert', 'remove') then
    raise exception using errcode = '22023', message = 'A valid assignment action is required.';
  end if;

  if p_action = 'remove' then
    update public.os_staff_assignments
    set status = 'cancelled', updated_by_user_id = v_actor
    where id = p_assignment_id and status = 'assigned'
    returning id into v_id;
    if v_id is null then raise exception using errcode = 'P0002', message = 'The active assignment was not found.'; end if;
    return jsonb_build_object('status', 'removed', 'assignment_id', v_id);
  end if;

  if p_event_id is null or p_team_member_id is null or p_assignment_role not in ('dj', 'mc', 'vocalist', 'assistant', 'activity_helper', 'operator', 'other')
    or not exists (select 1 from public.os_events where id = p_event_id)
    or not exists (select 1 from public.os_team_members where id = p_team_member_id and status = 'active') then
    raise exception using errcode = '22023', message = 'Valid event, team member, and assignment role are required.';
  end if;

  if p_assignment_id is null then
    insert into public.os_staff_assignments(event_id, team_member_id, assignment_role, call_time, created_by_user_id, updated_by_user_id)
    values (p_event_id, p_team_member_id, p_assignment_role, p_call_time, v_actor, v_actor)
    returning id into v_id;
  else
    update public.os_staff_assignments
    set event_id = p_event_id, team_member_id = p_team_member_id, assignment_role = p_assignment_role,
        call_time = p_call_time, status = 'assigned', updated_by_user_id = v_actor
    where id = p_assignment_id
    returning id into v_id;
    if v_id is null then raise exception using errcode = 'P0002', message = 'The assignment was not found.'; end if;
  end if;
  return jsonb_build_object('status', case when p_assignment_id is null then 'created' else 'updated' end, 'assignment_id', v_id);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'That team member is already assigned to this event.';
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
      where (a.all_day and a.starts_on <= p_to and a.ends_on >= p_from)
         or (not a.all_day
             and a.starts_at < ((p_to + 1)::timestamp at time zone 'America/Indiana/Indianapolis')
             and a.ends_at > (p_from::timestamp at time zone 'America/Indiana/Indianapolis'))
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

revoke all on function public.os_ensure_my_team_member(text, text) from public, anon, authenticated;
revoke all on function public.os_manage_team_member(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.os_upsert_team_availability(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.os_remove_team_availability(uuid) from public, anon, authenticated;
revoke all on function public.os_manage_staff_assignment(text, uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.os_team_calendar_snapshot(date, date) from public, anon, authenticated;
grant execute on function public.os_ensure_my_team_member(text, text) to authenticated;
grant execute on function public.os_manage_team_member(uuid, text, text, text) to authenticated;
grant execute on function public.os_upsert_team_availability(uuid, uuid, jsonb) to authenticated;
grant execute on function public.os_remove_team_availability(uuid) to authenticated;
grant execute on function public.os_manage_staff_assignment(text, uuid, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.os_team_calendar_snapshot(date, date) to authenticated;

-- Rollback: revoke/drop the six Phase 1 RPCs; drop os_staff_assignments,
-- os_team_availability, and os_team_members; then restore the prior
-- os_has_hq_capability(text) definition. No canonical event/contact/booking
-- records are created, copied, changed, or deleted by this migration.
