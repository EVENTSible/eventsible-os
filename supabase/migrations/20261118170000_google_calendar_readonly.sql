-- Source-only proposal. Never install on Production without Owner approval.
-- Google entries remain external; canonical gigs, leads, bookings and tasks are untouched.
begin;

create table public.os_google_calendar_connections (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  refresh_token_ciphertext text not null check (length(refresh_token_ciphertext) between 40 and 8192),
  primary_calendar_id text,
  status text not null default 'connected' check (status in ('connected','reauthorize')),
  last_successful_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_google_calendar_sources (
  owner_user_id uuid not null references public.os_google_calendar_connections(owner_user_id) on delete cascade,
  calendar_id text not null check (length(calendar_id) between 1 and 512),
  label text not null check (length(label) between 1 and 200),
  timezone text,
  selected boolean not null default false,
  share_busy boolean not null default false,
  sync_token text,
  last_successful_sync_at timestamptz,
  primary key (owner_user_id, calendar_id),
  constraint os_google_calendar_sources_share_check check (not share_busy or selected)
);

create table public.os_google_calendar_entries (
  owner_user_id uuid not null,
  calendar_id text not null,
  event_id text not null check (length(event_id) between 1 and 1024),
  title text not null default 'Busy' check (length(title) <= 300),
  location text check (length(location) <= 500),
  description text check (length(description) <= 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  starts_on date,
  ends_on date,
  timezone text,
  all_day boolean not null,
  visibility text not null default 'default' check (visibility in ('default','public','private','confidential')),
  status text not null check (status in ('confirmed','tentative','cancelled')),
  recurring_event_id text,
  original_start text,
  source_updated_at timestamptz,
  generation uuid not null,
  matched_event_id uuid references public.os_events(id) on delete set null,
  primary key (owner_user_id, calendar_id, event_id),
  foreign key (owner_user_id, calendar_id) references public.os_google_calendar_sources(owner_user_id,calendar_id) on delete cascade,
  constraint os_google_calendar_entries_time_check check (
    status = 'cancelled' or
    (all_day and starts_on is not null and ends_on > starts_on and starts_at is null and ends_at is null) or
    (not all_day and starts_at is not null and ends_at > starts_at and starts_on is null and ends_on is null)
  )
);
create index os_google_calendar_entries_timed_idx on public.os_google_calendar_entries (starts_at, ends_at) where status <> 'cancelled' and not all_day;
create index os_google_calendar_entries_all_day_idx on public.os_google_calendar_entries (starts_on, ends_on) where status <> 'cancelled' and all_day;

alter table public.os_google_calendar_connections enable row level security;
alter table public.os_google_calendar_sources enable row level security;
alter table public.os_google_calendar_entries enable row level security;
revoke all on public.os_google_calendar_connections,public.os_google_calendar_sources,public.os_google_calendar_entries from public,anon,authenticated;
grant select,insert,update,delete on public.os_google_calendar_connections,public.os_google_calendar_sources,public.os_google_calendar_entries to service_role;

-- One locked commit per calendar. A concurrent stale fetch cannot advance the cursor.
create function public.os_google_calendar_apply(p_owner uuid,p_calendar text,p_expected_token text,p_next_token text,p_generation uuid,p_full boolean,p_entries jsonb)
returns integer language plpgsql set search_path = '' as $$
declare v_current_token text; v_count integer;
begin
  if p_next_token is null or length(p_next_token) < 4 or p_generation is null or
     jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 3000 then
    raise exception 'Invalid Google sync batch' using errcode='22023';
  end if;
  select sync_token into v_current_token from public.os_google_calendar_sources
    where owner_user_id=p_owner and calendar_id=p_calendar and selected for update;
  if not found then raise exception 'Calendar not selected' using errcode='P0002'; end if;
  if v_current_token is distinct from p_expected_token then
    raise exception 'Stale Google sync cursor' using errcode='40001';
  end if;
  insert into public.os_google_calendar_entries (
    owner_user_id,calendar_id,event_id,title,location,description,starts_at,ends_at,starts_on,ends_on,
    timezone,all_day,visibility,status,recurring_event_id,original_start,source_updated_at,generation
  ) select p_owner,p_calendar,r.event_id,r.title,r.location,r.description,r.starts_at,r.ends_at,r.starts_on,r.ends_on,
           r.timezone,r.all_day,r.visibility,r.status,r.recurring_event_id,r.original_start,r.source_updated_at,p_generation
    from jsonb_to_recordset(p_entries) as r(event_id text,title text,location text,description text,
      starts_at timestamptz,ends_at timestamptz,starts_on date,ends_on date,timezone text,all_day boolean,
      visibility text,status text,recurring_event_id text,original_start text,source_updated_at timestamptz)
  on conflict (owner_user_id,calendar_id,event_id) do update set
    title=excluded.title,location=excluded.location,description=excluded.description,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at,starts_on=excluded.starts_on,ends_on=excluded.ends_on,
    timezone=excluded.timezone,all_day=excluded.all_day,visibility=excluded.visibility,status=excluded.status,
    recurring_event_id=excluded.recurring_event_id,original_start=excluded.original_start,
    source_updated_at=excluded.source_updated_at,generation=excluded.generation;
  get diagnostics v_count = row_count;
  if p_full then
    update public.os_google_calendar_entries set status='cancelled'
      where owner_user_id=p_owner and calendar_id=p_calendar and generation<>p_generation and status<>'cancelled';
  end if;
  update public.os_google_calendar_sources set sync_token=p_next_token,last_successful_sync_at=now()
    where owner_user_id=p_owner and calendar_id=p_calendar;
  update public.os_google_calendar_connections set last_successful_sync_at=now(),last_error_code=null,status='connected',updated_at=now()
    where owner_user_id=p_owner;
  return v_count;
end $$;
revoke all on function public.os_google_calendar_apply(uuid,text,text,text,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.os_google_calendar_apply(uuid,text,text,text,uuid,boolean,jsonb) to service_role;

-- Authorized staff receive only opted-in occupied windows. Owner sees details for their own connection.
create function public.os_google_calendar_snapshot(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean := public.os_staff_role() = 'owner';
begin
  if auth.uid() is null or not public.os_has_hq_capability('schedule.read') then
    raise exception 'HQ calendar access denied' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 370 then
    raise exception 'Calendar range invalid' using errcode='22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'calendarId',case when v_owner then e.calendar_id else null end,
      'eventId',case when v_owner then e.event_id else null end,
      'calendarLabel',case when v_owner then s.label else 'Personal / Busy' end,
      'title',case when v_owner then e.title else 'Busy' end,
      'location',case when v_owner then e.location else null end,
      'description',case when v_owner then e.description else null end,
      'allDay',e.all_day,'startsAt',e.starts_at,'endsAt',e.ends_at,
      'startsOn',e.starts_on,'endsOn',e.ends_on,'timezone',e.timezone,
      'visibility',case when v_owner then e.visibility else 'private' end,
      'matchedEventId',case when v_owner then e.matched_event_id else null end
    ) order by coalesce(e.starts_at,e.starts_on::timestamptz),e.event_id)
    from public.os_google_calendar_entries e
    join public.os_google_calendar_sources s on (s.owner_user_id,s.calendar_id)=(e.owner_user_id,e.calendar_id)
    where e.status <> 'cancelled' and s.selected and
      ((v_owner and e.owner_user_id = auth.uid()) or (not v_owner and s.share_busy))
      and ((e.all_day and e.starts_on <= p_to and e.ends_on > p_from)
        or (not e.all_day and e.starts_at < (p_to+1)::timestamptz and e.ends_at > p_from::timestamptz))
  ),'[]'::jsonb);
end $$;
revoke all on function public.os_google_calendar_snapshot(date,date) from public,anon;
grant execute on function public.os_google_calendar_snapshot(date,date) to authenticated;
commit;
