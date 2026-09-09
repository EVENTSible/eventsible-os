create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.os_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.os_is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('owner','manager','staff','host');
$$;

create table public.os_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  phone text,
  job_title text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  display_name text,
  organization_name text,
  primary_email text,
  primary_phone text,
  preferred_channel text not null default 'email' check (preferred_channel in ('email','text','phone','portal')),
  source text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_contact_users (
  contact_id uuid not null references public.os_contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null default 'self' check (relationship in ('self','partner','assistant','family','representative')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (contact_id, user_id)
);

create table public.os_service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  description text,
  planning_module text,
  default_unit text not null default 'flat',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_builder_submissions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.os_contacts(id) on delete set null,
  source_session_id text,
  event_type text,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','normalized','lead_created','failed','archived')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_events (
  id uuid primary key default gen_random_uuid(),
  primary_contact_id uuid references public.os_contacts(id) on delete set null,
  builder_submission_id uuid references public.os_builder_submissions(id) on delete set null,
  title text not null,
  event_type text not null,
  status text not null default 'draft' check (status in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed','cancelled','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Indiana/Indianapolis',
  venue_name text,
  venue_address_1 text,
  venue_address_2 text,
  venue_city text,
  venue_state text,
  venue_postal_code text,
  venue_country text not null default 'US',
  guest_count integer check (guest_count is null or guest_count >= 0),
  public_slug text unique,
  source text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.os_contacts(id) on delete cascade,
  member_role text not null check (member_role in ('client','client_collaborator','vendor','helper','host','assistant','manager','owner')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or contact_id is not null)
);

create table public.os_event_facts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  fact_key text not null,
  value jsonb not null default 'null'::jsonb,
  source text not null default 'system' check (source in ('builder','quote','client','owner','staff','import','system')),
  source_reference text,
  is_confirmed boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, fact_key)
);

create unique index os_event_members_event_user_unique on public.os_event_members(event_id, user_id) where user_id is not null;
create unique index os_event_members_event_contact_role_unique on public.os_event_members(event_id, contact_id, member_role) where contact_id is not null;
create index os_contacts_email_idx on public.os_contacts(lower(primary_email));
create index os_contacts_phone_idx on public.os_contacts(primary_phone);
create index os_events_status_start_idx on public.os_events(status, starts_at);
create index os_events_primary_contact_idx on public.os_events(primary_contact_id);
create index os_event_members_user_idx on public.os_event_members(user_id, event_id) where user_id is not null and is_active;
create index os_event_facts_event_key_idx on public.os_event_facts(event_id, fact_key);

create trigger os_profiles_updated_at before update on public.os_profiles for each row execute function public.os_set_updated_at();
create trigger os_contacts_updated_at before update on public.os_contacts for each row execute function public.os_set_updated_at();
create trigger os_service_catalog_updated_at before update on public.os_service_catalog for each row execute function public.os_set_updated_at();
create trigger os_builder_submissions_updated_at before update on public.os_builder_submissions for each row execute function public.os_set_updated_at();
create trigger os_events_updated_at before update on public.os_events for each row execute function public.os_set_updated_at();
create trigger os_event_members_updated_at before update on public.os_event_members for each row execute function public.os_set_updated_at();
create trigger os_event_facts_updated_at before update on public.os_event_facts for each row execute function public.os_set_updated_at();