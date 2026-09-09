create table public.os_event_pages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.os_events(id) on delete cascade,
  slug text not null unique,
  title text not null,
  headline text,
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  visibility text not null default 'private' check (visibility in ('private','link_only','public')),
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_event_page_modules (
  id uuid primary key default gen_random_uuid(),
  event_page_id uuid not null references public.os_event_pages(id) on delete cascade,
  module_type text not null check (module_type in (
    'hero','event_details','schedule','directions','parking','rsvp','announcements','gallery',
    'message_board','vendor_info','helper_tasks','hotel_info','registry','song_requests','custom'
  )),
  title text,
  audience text not null default 'public' check (audience in ('public','guest','vendor','helper','client')),
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index os_event_page_modules_page_order_idx on public.os_event_page_modules(event_page_id,sort_order);
create index os_event_pages_created_by_idx on public.os_event_pages(created_by) where created_by is not null;

create trigger os_event_pages_updated_at before update on public.os_event_pages for each row execute function public.os_set_updated_at();
create trigger os_event_page_modules_updated_at before update on public.os_event_page_modules for each row execute function public.os_set_updated_at();

alter table public.os_event_pages enable row level security;
alter table public.os_event_page_modules enable row level security;

create or replace function public.os_can_manage_event_page(target_event_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.os_is_staff() or exists (
    select 1 from public.os_event_members em
    where em.event_id=target_event_id
      and em.user_id=(select auth.uid())
      and em.is_active
      and em.member_role in ('client','client_collaborator','manager','owner')
  );
$$;

create policy os_event_pages_public_read on public.os_event_pages for select to anon using (
  status='published' and visibility='public'
);
create policy os_event_pages_authenticated_read on public.os_event_pages for select to authenticated using (
  public.os_has_event_access(event_id) or (status='published' and visibility='public')
);
create policy os_event_pages_insert_manage on public.os_event_pages for insert to authenticated with check (
  public.os_can_manage_event_page(event_id)
);
create policy os_event_pages_update_manage on public.os_event_pages for update to authenticated
using (public.os_can_manage_event_page(event_id))
with check (public.os_can_manage_event_page(event_id));
create policy os_event_pages_delete_manage on public.os_event_pages for delete to authenticated using (
  public.os_can_manage_event_page(event_id)
);

create policy os_event_page_modules_public_read on public.os_event_page_modules for select to anon using (
  is_enabled and audience='public' and exists (
    select 1 from public.os_event_pages ep
    where ep.id=event_page_id and ep.status='published' and ep.visibility='public'
  )
);
create policy os_event_page_modules_authenticated_read on public.os_event_page_modules for select to authenticated using (
  exists (
    select 1 from public.os_event_pages ep
    where ep.id=event_page_id
      and (public.os_has_event_access(ep.event_id) or (ep.status='published' and ep.visibility='public' and audience='public'))
  )
);
create policy os_event_page_modules_insert_manage on public.os_event_page_modules for insert to authenticated with check (
  exists (select 1 from public.os_event_pages ep where ep.id=event_page_id and public.os_can_manage_event_page(ep.event_id))
);
create policy os_event_page_modules_update_manage on public.os_event_page_modules for update to authenticated
using (exists (select 1 from public.os_event_pages ep where ep.id=event_page_id and public.os_can_manage_event_page(ep.event_id)))
with check (exists (select 1 from public.os_event_pages ep where ep.id=event_page_id and public.os_can_manage_event_page(ep.event_id)));
create policy os_event_page_modules_delete_manage on public.os_event_page_modules for delete to authenticated using (
  exists (select 1 from public.os_event_pages ep where ep.id=event_page_id and public.os_can_manage_event_page(ep.event_id))
);

grant select on public.os_event_pages,public.os_event_page_modules to anon;
grant select,insert,update,delete on public.os_event_pages,public.os_event_page_modules to authenticated;