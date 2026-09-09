create table public.os_guest_access_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  access_role text not null check (access_role in ('guest','vendor','helper')),
  label text,
  secret_digest text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  guest_access_link_id uuid references public.os_guest_access_links(id) on delete set null,
  guest_name text not null,
  email text,
  phone text,
  party_size integer not null default 1 check (party_size between 1 and 50),
  response_status text not null default 'pending' check (response_status in ('pending','attending','declined','maybe')),
  meal_choice text,
  accessibility_notes text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_event_page_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  guest_access_link_id uuid references public.os_guest_access_links(id) on delete set null,
  author_name text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending','approved','hidden','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index os_guest_access_links_event_role_idx on public.os_guest_access_links(event_id,access_role,is_active);
create index os_guest_access_links_created_by_idx on public.os_guest_access_links(created_by) where created_by is not null;
create index os_rsvps_event_status_idx on public.os_rsvps(event_id,response_status,created_at);
create index os_rsvps_guest_link_idx on public.os_rsvps(guest_access_link_id) where guest_access_link_id is not null;
create index os_event_page_messages_event_status_idx on public.os_event_page_messages(event_id,status,created_at);
create index os_event_page_messages_guest_link_idx on public.os_event_page_messages(guest_access_link_id) where guest_access_link_id is not null;

create trigger os_guest_access_links_updated_at before update on public.os_guest_access_links for each row execute function public.os_set_updated_at();
create trigger os_rsvps_updated_at before update on public.os_rsvps for each row execute function public.os_set_updated_at();
create trigger os_event_page_messages_updated_at before update on public.os_event_page_messages for each row execute function public.os_set_updated_at();

alter table public.os_guest_access_links enable row level security;
alter table public.os_rsvps enable row level security;
alter table public.os_event_page_messages enable row level security;

create policy os_guest_access_links_manage on public.os_guest_access_links for all to authenticated
using (public.os_can_manage_event_page(event_id))
with check (public.os_can_manage_event_page(event_id));

create policy os_rsvps_event_access on public.os_rsvps for select to authenticated using (public.os_has_event_access(event_id));
create policy os_rsvps_insert_manage on public.os_rsvps for insert to authenticated with check (public.os_can_manage_event_page(event_id));
create policy os_rsvps_update_manage on public.os_rsvps for update to authenticated
using (public.os_can_manage_event_page(event_id))
with check (public.os_can_manage_event_page(event_id));
create policy os_rsvps_delete_manage on public.os_rsvps for delete to authenticated using (public.os_can_manage_event_page(event_id));

create policy os_event_page_messages_event_access on public.os_event_page_messages for select to authenticated using (public.os_has_event_access(event_id));
create policy os_event_page_messages_insert_manage on public.os_event_page_messages for insert to authenticated with check (public.os_can_manage_event_page(event_id));
create policy os_event_page_messages_update_manage on public.os_event_page_messages for update to authenticated
using (public.os_can_manage_event_page(event_id))
with check (public.os_can_manage_event_page(event_id));
create policy os_event_page_messages_delete_manage on public.os_event_page_messages for delete to authenticated using (public.os_can_manage_event_page(event_id));

grant select,insert,update,delete on public.os_guest_access_links,public.os_rsvps,public.os_event_page_messages to authenticated;