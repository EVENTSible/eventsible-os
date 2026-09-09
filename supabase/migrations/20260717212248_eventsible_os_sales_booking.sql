create table public.os_leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.os_contacts(id) on delete restrict,
  event_id uuid references public.os_events(id) on delete set null,
  builder_submission_id uuid references public.os_builder_submissions(id) on delete set null,
  status text not null default 'new' check (status in ('new','qualifying','quoted','follow_up','won','lost','archived')),
  source text,
  assigned_to uuid references auth.users(id) on delete set null,
  inquiry_summary text,
  estimated_value numeric(12,2),
  next_follow_up_at timestamptz,
  lost_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_quote_versions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.os_leads(id) on delete set null,
  event_id uuid not null references public.os_events(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','declined','expired','superseded')),
  currency text not null default 'USD',
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  travel_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, version_number)
);

create table public.os_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.os_quote_versions(id) on delete cascade,
  service_id uuid references public.os_service_catalog(id) on delete set null,
  service_code text not null,
  service_name text not null,
  category text,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'flat',
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.os_events(id) on delete cascade,
  accepted_quote_version_id uuid references public.os_quote_versions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','pending_contract','pending_deposit','confirmed','cancelled','completed')),
  booked_at timestamptz,
  contract_status text not null default 'not_sent' check (contract_status in ('not_sent','sent','viewed','signed','void')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded')),
  total_amount numeric(12,2),
  deposit_amount numeric(12,2),
  balance_due numeric(12,2),
  balance_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.os_bookings(id) on delete cascade,
  quote_item_id uuid references public.os_quote_items(id) on delete set null,
  service_id uuid references public.os_service_catalog(id) on delete set null,
  service_code text not null,
  service_name text not null,
  status text not null default 'booked' check (status in ('booked','planning','ready','delivered','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  location_label text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index os_leads_status_followup_idx on public.os_leads(status, next_follow_up_at);
create index os_quote_versions_event_status_idx on public.os_quote_versions(event_id, status);
create index os_quote_items_quote_idx on public.os_quote_items(quote_version_id, sort_order);
create index os_booking_services_booking_idx on public.os_booking_services(booking_id, status);

create trigger os_leads_updated_at before update on public.os_leads for each row execute function public.os_set_updated_at();
create trigger os_quote_versions_updated_at before update on public.os_quote_versions for each row execute function public.os_set_updated_at();
create trigger os_quote_items_updated_at before update on public.os_quote_items for each row execute function public.os_set_updated_at();
create trigger os_bookings_updated_at before update on public.os_bookings for each row execute function public.os_set_updated_at();
create trigger os_booking_services_updated_at before update on public.os_booking_services for each row execute function public.os_set_updated_at();