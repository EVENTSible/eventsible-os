-- PROPOSAL ONLY. DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE OWNER APPROVAL.
-- Site Studio v1 is owned by EVENTSible OS. It does not modify business/booking records.
create table if not exists public.os_site_media (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  title text not null,
  public_url text,
  alt_text text not null,
  usage_approved boolean not null default false,
  permission_confirmed boolean not null default false,
  status text not null default 'candidate' check (status in ('candidate','approved','retired')),
  created_at timestamptz not null default now(),
  constraint os_site_media_public_url_https check (public_url is null or (public_url ~ '^https://[^[:space:]]+
);

create table if not exists public.os_site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (page_key = 'home'),
  revision bigint generated always as identity unique,
  state text not null default 'draft' check (state in ('draft','published','archived')),
  content jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint os_site_content_object check (jsonb_typeof(content) = 'object')
);
create unique index if not exists os_site_only_one_published
  on public.os_site_content_revisions (page_key) where state = 'published';

alter table public.os_site_media enable row level security;
alter table public.os_site_content_revisions enable row level security;
revoke all on public.os_site_media from public, anon, authenticated;
revoke all on public.os_site_content_revisions from public, anon, authenticated;
grant select on public.os_site_media to authenticated;
grant select, insert on public.os_site_content_revisions to authenticated;
grant usage, select on sequence public.os_site_content_revisions_revision_seq to authenticated;

create policy os_site_media_owner_select on public.os_site_media for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_select on public.os_site_content_revisions for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_insert on public.os_site_content_revisions for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and created_by = (select auth.uid()) and state = 'draft'
    and length(content::text) <= 8000);

-- Publication is atomic and never exposed directly to a browser write.
create or replace function public.os_site_publish_revision(p_revision_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.os_site_content_revisions%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'owner' then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('eventsible:site-studio:home'));
  select * into target from public.os_site_content_revisions
    where id = p_revision_id and page_key = 'home' and state in ('draft','archived')
    for update;
  if not found then raise exception 'Revision unavailable' using errcode = '22023'; end if;
  if nullif(trim(target.content ->> 'heading'),'') is null
    or nullif(trim(target.content ->> 'highlight'),'') is null
    or nullif(trim(target.content ->> 'subheading'),'') is null then
    raise exception 'Required homepage copy missing' using errcode = '22023';
  end if;
  if nullif(target.content ->> 'hero_media_id','') is not null
    and not exists (
      select 1 from public.os_site_media
      where id::text = target.content ->> 'hero_media_id'
      and status = 'approved' and usage_approved and permission_confirmed
    ) then
    raise exception 'Hero media not approved' using errcode = '22023';
  end if;
  update public.os_site_content_revisions set state = 'archived'
    where page_key = 'home' and state = 'published';
  update public.os_site_content_revisions set state = 'published' where id = target.id;
  return target.id;
end $$;
revoke all on function public.os_site_publish_revision(uuid) from public, anon;
grant execute on function public.os_site_publish_revision(uuid) to authenticated;

-- Owner-only private media intake. This never publishes a candidate or alters Drive files.
create or replace function public.os_site_queue_drive_media(
  p_drive_file_id text, p_title text, p_alt_text text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $
declare
  result_id uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'owner' then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  if p_drive_file_id !~ '^[A-Za-z0-9_-]{12,120}
-- Rollback requires explicit approval; do not drop published records or approved assets blindly.
 and public_url !~* '^https://(?:drive\\.google\\.com|docs\\.google\\.com|[^/]*googleusercontent\\.com)/')),
  constraint os_site_media_approved_only_with_review check (status <> 'approved' or (public_url is not null and usage_approved and permission_confirmed and length(trim(alt_text)) > 0))
);

create table if not exists public.os_site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (page_key = 'home'),
  revision bigint generated always as identity unique,
  state text not null default 'draft' check (state in ('draft','published','archived')),
  content jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint os_site_content_object check (jsonb_typeof(content) = 'object')
);
create unique index if not exists os_site_only_one_published
  on public.os_site_content_revisions (page_key) where state = 'published';

alter table public.os_site_media enable row level security;
alter table public.os_site_content_revisions enable row level security;
revoke all on public.os_site_media from public, anon, authenticated;
revoke all on public.os_site_content_revisions from public, anon, authenticated;
grant select on public.os_site_media to authenticated;
grant select, insert on public.os_site_content_revisions to authenticated;
grant usage, select on sequence public.os_site_content_revisions_revision_seq to authenticated;

create policy os_site_media_owner_select on public.os_site_media for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_select on public.os_site_content_revisions for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_insert on public.os_site_content_revisions for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and created_by = (select auth.uid()) and state = 'draft'
    and length(content::text) <= 8000);

-- Publication is atomic and never exposed directly to a browser write.
create or replace function public.os_site_publish_revision(p_revision_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.os_site_content_revisions%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'owner' then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('eventsible:site-studio:home'));
  select * into target from public.os_site_content_revisions
    where id = p_revision_id and page_key = 'home' and state in ('draft','archived')
    for update;
  if not found then raise exception 'Revision unavailable' using errcode = '22023'; end if;
  if nullif(trim(target.content ->> 'heading'),'') is null
    or nullif(trim(target.content ->> 'highlight'),'') is null
    or nullif(trim(target.content ->> 'subheading'),'') is null then
    raise exception 'Required homepage copy missing' using errcode = '22023';
  end if;
  if nullif(target.content ->> 'hero_media_id','') is not null
    and not exists (
      select 1 from public.os_site_media
      where id::text = target.content ->> 'hero_media_id'
      and status = 'approved' and usage_approved and permission_confirmed
    ) then
    raise exception 'Hero media not approved' using errcode = '22023';
  end if;
  update public.os_site_content_revisions set state = 'archived'
    where page_key = 'home' and state = 'published';
  update public.os_site_content_revisions set state = 'published' where id = target.id;
  return target.id;
end $$;
revoke all on function public.os_site_publish_revision(uuid) from public, anon;
grant execute on function public.os_site_publish_revision(uuid) to authenticated;

-- Public reads occur only through the server-owned API, which selects the published revision.
-- Rollback requires explicit approval; do not drop published records or approved assets blindly.

    or nullif(trim(p_title),'') is null or length(p_title) > 180
    or length(p_alt_text) > 240 then
    raise exception 'Invalid Drive candidate metadata' using errcode = '22023';
  end if;
  insert into public.os_site_media
    (drive_file_id,title,alt_text,status,permission_confirmed,usage_approved,public_url)
  values (p_drive_file_id,trim(p_title),trim(p_alt_text),'candidate',false,false,null)
  on conflict (drive_file_id) do update
    set title = excluded.title, alt_text = excluded.alt_text
    where os_site_media.status = 'candidate'
  returning id into result_id;
  if result_id is null then
    raise exception 'Previously reviewed asset cannot be overwritten by intake' using errcode = '22023';
  end if;
  return result_id;
end $;
revoke all on function public.os_site_queue_drive_media(text,text,text) from public, anon;
grant execute on function public.os_site_queue_drive_media(text,text,text) to authenticated;

-- Public reads occur only through the server-owned API, which selects the published revision.
-- Rollback requires explicit approval; do not drop published records or approved assets blindly.
 and public_url !~* '^https://(?:drive\\.google\\.com|docs\\.google\\.com|[^/]*googleusercontent\\.com)/')),
  constraint os_site_media_approved_only_with_review check (status <> 'approved' or (public_url is not null and usage_approved and permission_confirmed and length(trim(alt_text)) > 0))
);

create table if not exists public.os_site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (page_key = 'home'),
  revision bigint generated always as identity unique,
  state text not null default 'draft' check (state in ('draft','published','archived')),
  content jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint os_site_content_object check (jsonb_typeof(content) = 'object')
);
create unique index if not exists os_site_only_one_published
  on public.os_site_content_revisions (page_key) where state = 'published';

alter table public.os_site_media enable row level security;
alter table public.os_site_content_revisions enable row level security;
revoke all on public.os_site_media from public, anon, authenticated;
revoke all on public.os_site_content_revisions from public, anon, authenticated;
grant select on public.os_site_media to authenticated;
grant select, insert on public.os_site_content_revisions to authenticated;
grant usage, select on sequence public.os_site_content_revisions_revision_seq to authenticated;

create policy os_site_media_owner_select on public.os_site_media for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_select on public.os_site_content_revisions for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');
create policy os_site_content_owner_insert on public.os_site_content_revisions for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and created_by = (select auth.uid()) and state = 'draft'
    and length(content::text) <= 8000);

-- Publication is atomic and never exposed directly to a browser write.
create or replace function public.os_site_publish_revision(p_revision_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.os_site_content_revisions%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'owner' then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('eventsible:site-studio:home'));
  select * into target from public.os_site_content_revisions
    where id = p_revision_id and page_key = 'home' and state in ('draft','archived')
    for update;
  if not found then raise exception 'Revision unavailable' using errcode = '22023'; end if;
  if nullif(trim(target.content ->> 'heading'),'') is null
    or nullif(trim(target.content ->> 'highlight'),'') is null
    or nullif(trim(target.content ->> 'subheading'),'') is null then
    raise exception 'Required homepage copy missing' using errcode = '22023';
  end if;
  if nullif(target.content ->> 'hero_media_id','') is not null
    and not exists (
      select 1 from public.os_site_media
      where id::text = target.content ->> 'hero_media_id'
      and status = 'approved' and usage_approved and permission_confirmed
    ) then
    raise exception 'Hero media not approved' using errcode = '22023';
  end if;
  update public.os_site_content_revisions set state = 'archived'
    where page_key = 'home' and state = 'published';
  update public.os_site_content_revisions set state = 'published' where id = target.id;
  return target.id;
end $$;
revoke all on function public.os_site_publish_revision(uuid) from public, anon;
grant execute on function public.os_site_publish_revision(uuid) to authenticated;

-- Public reads occur only through the server-owned API, which selects the published revision.
-- Rollback requires explicit approval; do not drop published records or approved assets blindly.
