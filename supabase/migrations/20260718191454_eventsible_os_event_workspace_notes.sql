create table if not exists public.os_event_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'general' check (note_type in ('general','client','venue','planning','payment','contract','staff','event_day')),
  body text not null check (length(btrim(body)) > 0),
  is_pinned boolean not null default false,
  visibility text not null default 'staff' check (visibility in ('staff','shared')),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_event_notes_event_created_idx on public.os_event_notes(event_id, created_at desc);
create index if not exists os_event_notes_event_pinned_idx on public.os_event_notes(event_id, is_pinned desc, created_at desc) where status = 'active';

alter table public.os_event_notes enable row level security;

drop policy if exists os_event_notes_staff_select on public.os_event_notes;
create policy os_event_notes_staff_select on public.os_event_notes for select to authenticated using (public.os_is_staff());
drop policy if exists os_event_notes_staff_insert on public.os_event_notes;
create policy os_event_notes_staff_insert on public.os_event_notes for insert to authenticated with check (public.os_is_staff() and (author_user_id is null or author_user_id = auth.uid()));
drop policy if exists os_event_notes_staff_update on public.os_event_notes;
create policy os_event_notes_staff_update on public.os_event_notes for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
drop policy if exists os_event_notes_staff_delete on public.os_event_notes;
create policy os_event_notes_staff_delete on public.os_event_notes for delete to authenticated using (public.os_is_staff());

drop trigger if exists os_event_notes_set_updated_at on public.os_event_notes;
create trigger os_event_notes_set_updated_at before update on public.os_event_notes for each row execute function public.os_set_updated_at();

create or replace view public.os_event_workspace_v with (security_invoker = true) as
select
  d.*,
  e.settings as event_settings,
  e.venue_address_1,
  e.venue_address_2,
  e.venue_city,
  e.venue_state,
  e.venue_postal_code,
  e.venue_country,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.preferred_channel,
  c.notes as contact_notes,
  c.metadata as contact_metadata,
  l.inquiry_summary,
  l.estimated_value,
  l.lost_reason,
  l.metadata as lead_metadata,
  b.metadata as booking_metadata,
  (select count(*)::int from public.os_tasks t where t.event_id = e.id and t.status not in ('completed','cancelled')) as open_task_count,
  (select count(*)::int from public.os_event_notes n where n.event_id = e.id and n.status = 'active') as note_count,
  (select count(*)::int from public.os_files f where f.event_id = e.id) as file_count
from public.os_event_dashboard_v d
join public.os_events e on e.id = d.event_id
left join public.os_contacts c on c.id = e.primary_contact_id
left join public.os_leads l on l.id = d.lead_id
left join public.os_bookings b on b.id = d.booking_id;

grant select on public.os_event_workspace_v to authenticated;