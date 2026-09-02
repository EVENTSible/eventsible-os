-- EVENTSible Ecosystem Integration Foundation local verification schema.
-- Additive, synthetic-test-focused foundation for CI-local Supabase only.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.os_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.os_contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  first_name text,
  last_name text,
  primary_email text,
  primary_phone text,
  preferred_channel text not null default 'email',
  source text not null default 'eventsible_event_builder',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_contacts_email_or_phone_chk check (primary_email is not null or primary_phone is not null)
);

create unique index if not exists os_contacts_primary_email_unique_idx
  on public.os_contacts (lower(primary_email))
  where primary_email is not null;

create index if not exists os_contacts_primary_phone_idx
  on public.os_contacts (primary_phone)
  where primary_phone is not null;

create table if not exists public.os_events (
  id uuid primary key default gen_random_uuid(),
  primary_contact_id uuid not null references public.os_contacts(id),
  title text not null,
  event_type text not null,
  status text not null default 'inquiry',
  starts_at timestamp,
  ends_at timestamp,
  timezone text not null default 'America/Indiana/Indianapolis',
  guest_count integer,
  venue_name text,
  venue_address_1 text,
  venue_city text,
  venue_state text,
  venue_postal_code text,
  source text not null default 'eventsible_event_builder',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_events_primary_contact_id_idx on public.os_events(primary_contact_id);

-- Local-only FK target required to apply later booking-linked migrations. The
-- production booking contract remains owned by the canonical core schema.
create table if not exists public.os_bookings (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.os_builder_submissions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.os_contacts(id),
  event_id uuid references public.os_events(id),
  source text not null default 'eventsible_event_builder',
  source_session_id text not null,
  request_fingerprint text not null,
  intake_version integer not null default 2,
  contract_version text not null default 'builder_submission_v1',
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null,
  submitted_from text not null default 'eventsible-event-builder',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists os_builder_submissions_fingerprint_unique_idx
  on public.os_builder_submissions (request_fingerprint);

create index if not exists os_builder_submissions_contact_id_idx
  on public.os_builder_submissions(contact_id);

create table if not exists public.os_leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.os_contacts(id),
  event_id uuid not null references public.os_events(id),
  builder_submission_id uuid references public.os_builder_submissions(id),
  status text not null default 'new',
  source text not null default 'eventsible_event_builder',
  inquiry_summary text,
  estimated_value numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_leads_event_id_idx on public.os_leads(event_id);
create index if not exists os_leads_builder_submission_id_idx on public.os_leads(builder_submission_id);

create table if not exists public.os_quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null default gen_random_uuid(),
  lead_id uuid not null references public.os_leads(id),
  event_id uuid not null references public.os_events(id),
  builder_submission_id uuid references public.os_builder_submissions(id),
  version_number integer not null default 1,
  status text not null default 'draft',
  currency text not null default 'USD',
  subtotal_cents integer not null default 0,
  package_savings_cents integer not null default 0,
  travel_cents integer not null default 0,
  total_cents integer not null default 0,
  deposit_cents integer not null default 0,
  contract_version text not null default 'quote_draft_v1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_quote_versions_currency_chk check (currency = 'USD')
);

create unique index if not exists os_quote_versions_quote_id_version_idx
  on public.os_quote_versions(quote_id, version_number);

create index if not exists os_quote_versions_event_id_idx on public.os_quote_versions(event_id);

create table if not exists public.os_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.os_quote_versions(id) on delete cascade,
  event_id uuid not null references public.os_events(id),
  service_id text,
  service_code text not null,
  service_name text not null,
  label text not null,
  quantity numeric(10,2) not null default 1,
  unit text,
  unit_price_cents integer not null default 0,
  line_total_cents integer not null default 0,
  custom_quote boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists os_quote_items_quote_version_id_idx
  on public.os_quote_items(quote_version_id);

create table if not exists public.os_builder_activity (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.os_contacts(id),
  builder_submission_id uuid not null references public.os_builder_submissions(id),
  lead_id uuid not null references public.os_leads(id),
  event_id uuid not null references public.os_events(id),
  activity_type text not null default 'builder.submission_received',
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists os_builder_activity_submission_type_idx
  on public.os_builder_activity(builder_submission_id, activity_type);

create table if not exists public.os_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload_version text not null,
  source_application text not null,
  occurred_at timestamptz not null default now(),
  related_record_ids jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  failure_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_integration_outbox_event_type_chk check (
    event_type in (
      'builder.submission_received',
      'lead.status_changed',
      'quote.ready',
      'quote.sent',
      'quote.accepted',
      'booking.confirmed',
      'event.updated',
      'event.room_requested',
      'event.completed',
      'client.portal_ready',
      'media.asset_added',
      'content.review_ready'
    )
  ),
  constraint os_integration_outbox_status_chk check (
    status in ('pending', 'processing', 'processed', 'retry', 'failed', 'dead_letter')
  )
);

create unique index if not exists os_integration_outbox_idempotency_key_idx
  on public.os_integration_outbox (idempotency_key);

create index if not exists os_integration_outbox_status_next_attempt_idx
  on public.os_integration_outbox (status, next_attempt_at, created_at);

alter table public.os_contacts enable row level security;
alter table public.os_events enable row level security;
alter table public.os_bookings enable row level security;
alter table public.os_builder_submissions enable row level security;
alter table public.os_leads enable row level security;
alter table public.os_quote_versions enable row level security;
alter table public.os_quote_items enable row level security;
alter table public.os_builder_activity enable row level security;
alter table public.os_integration_outbox enable row level security;

revoke all on public.os_contacts from anon, authenticated;
revoke all on public.os_events from anon, authenticated;
revoke all on public.os_bookings from anon, authenticated;
revoke all on public.os_builder_submissions from anon, authenticated;
revoke all on public.os_leads from anon, authenticated;
revoke all on public.os_quote_versions from anon, authenticated;
revoke all on public.os_quote_items from anon, authenticated;
revoke all on public.os_builder_activity from anon, authenticated;
revoke all on public.os_integration_outbox from anon, authenticated;

grant all on public.os_contacts to service_role;
grant all on public.os_events to service_role;
grant all on public.os_bookings to service_role;
grant all on public.os_builder_submissions to service_role;
grant all on public.os_leads to service_role;
grant all on public.os_quote_versions to service_role;
grant all on public.os_quote_items to service_role;
grant all on public.os_builder_activity to service_role;
grant all on public.os_integration_outbox to service_role;

drop policy if exists "Service role manages contacts" on public.os_contacts;
create policy "Service role manages contacts" on public.os_contacts
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages events" on public.os_events;
create policy "Service role manages events" on public.os_events
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages bookings" on public.os_bookings;
create policy "Service role manages bookings" on public.os_bookings
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages builder submissions" on public.os_builder_submissions;
create policy "Service role manages builder submissions" on public.os_builder_submissions
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages leads" on public.os_leads;
create policy "Service role manages leads" on public.os_leads
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages quote versions" on public.os_quote_versions;
create policy "Service role manages quote versions" on public.os_quote_versions
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages quote items" on public.os_quote_items;
create policy "Service role manages quote items" on public.os_quote_items
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages builder activity" on public.os_builder_activity;
create policy "Service role manages builder activity" on public.os_builder_activity
  for all to service_role using (true) with check (true);

drop policy if exists "Service role manages integration outbox" on public.os_integration_outbox;
create policy "Service role manages integration outbox"
  on public.os_integration_outbox
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.os_known_builder_service_code(_service jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(_service->>'service_code', ''),
    nullif(_service->>'code', ''),
    case nullif(_service->>'id', '')
      when 'wedding-dj' then 'wedding_dj_mc'
      when 'dj-mc-foundation' then 'dj_mc'
      when 'karaoke-3h' then 'karaoke'
      when 'selfie-booth' then 'selfie_booth_digital'
      when 'selfie-booth-weekday' then 'selfie_booth_digital'
      when 'selfie-booth-prints' then 'selfie_booth_prints'
      when 'selfie-booth-prints-weekday' then 'selfie_booth_prints'
      when 'booth-360' then 'booth_360'
      when 'uplighting' then 'uplighting'
      when 'trivia' then 'interactive_games'
      when 'music-bingo' then 'interactive_games'
      when 'game-show' then 'interactive_games'
      when 'kids-dj' then 'kids_entertainment'
      when 'kids-party-host' then 'kids_entertainment'
      when 'bartending' then 'bartending'
      when 'tents' then 'rentals'
      when 'tables' then 'rentals'
      when 'chairs' then 'rentals'
      when 'tshirt-bar' then 'custom_creations'
      when 'live-singer' then 'live_performer'
      when 'event-asst' then 'event_staff'
      else nullif(_service->>'id', '')
    end,
    'custom_service'
  );
$$;

create or replace function public.os_public_catalog_from_builder(_service jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'version', 'public_service_catalog_v1',
    'stable_service_id', coalesce(_service->>'id', _service->>'stable_service_id'),
    'public_name', coalesce(_service->>'name', _service->>'public_name'),
    'public_description', coalesce(_service->>'public_description', _service->>'blurb', ''),
    'public_pricing', coalesce(_service->'public_pricing', jsonb_build_object('pricing_type', coalesce(_service->>'pricing_type', 'custom'))),
    'minimum_hours', nullif(_service->>'minimum_hours', ''),
    'weekday_rules', coalesce(_service->'weekday_rules', '[]'::jsonb),
    'custom_quote_status', coalesce(_service->>'custom_quote_status', 'required'),
    'public_media', coalesce(_service->'public_media', '[]'::jsonb),
    'active', coalesce((_service->>'active')::boolean, true)
  ));
$$;

create or replace function public.os_enqueue_integration_event(
  _event_type text,
  _payload_version text,
  _source_application text,
  _related_record_ids jsonb,
  _payload jsonb,
  _idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _id uuid;
begin
  insert into public.os_integration_outbox (
    event_type,
    payload_version,
    source_application,
    related_record_ids,
    payload,
    idempotency_key
  )
  values (
    _event_type,
    _payload_version,
    _source_application,
    coalesce(_related_record_ids, '{}'::jsonb),
    coalesce(_payload, '{}'::jsonb),
    _idempotency_key
  )
  on conflict (idempotency_key) do update
    set updated_at = public.os_integration_outbox.updated_at
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;

create or replace function public.os_ingest_builder_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized jsonb := coalesce(payload->'normalized_payload', '{}'::jsonb);
  contact_payload jsonb := coalesce(normalized->'contact', '{}'::jsonb);
  pricing_payload jsonb := coalesce(normalized->'pricing', '{}'::jsonb);
  service jsonb;
  service_code text;
  service_name text;
  service_is_custom boolean;
  service_total_cents integer;
  request_key text := coalesce(payload->>'request_fingerprint', payload->>'source_session_id');
  existing public.os_builder_submissions%rowtype;
  contact_row public.os_contacts%rowtype;
  submission_row public.os_builder_submissions%rowtype;
  event_row public.os_events%rowtype;
  lead_row public.os_leads%rowtype;
  quote_row public.os_quote_versions%rowtype;
  subtotal_cents integer := round(coalesce((pricing_payload->>'subtotal')::numeric, 0) * 100);
  savings_cents integer := round(coalesce((pricing_payload->>'package_savings')::numeric, 0) * 100);
  travel_cents integer := round(coalesce((pricing_payload->>'travel_fee')::numeric, 0) * 100);
  total_cents integer := round(coalesce((pricing_payload->>'estimated_total')::numeric, 0) * 100);
  deposit_cents integer := round(coalesce((pricing_payload->>'deposit_amount')::numeric, 0) * 100);
  outbox_id uuid;
begin
  if request_key is null or length(request_key) < 8 then
    raise exception using errcode = '22023', message = 'Invalid builder submission idempotency key.';
  end if;

  if normalized->>'contract_version' is distinct from 'builder_submission_v1' then
    raise exception using errcode = '22023', message = 'Invalid builder submission contract version.';
  end if;

  if nullif(contact_payload->>'email', '') is null and nullif(contact_payload->>'phone', '') is null then
    raise exception using errcode = '22023', message = 'Invalid builder contact information.';
  end if;

  if jsonb_array_length(coalesce(normalized->'selected_services', '[]'::jsonb)) < 1 then
    raise exception using errcode = '22023', message = 'Select at least one service.';
  end if;

  if length(coalesce(normalized->>'inquiry_summary', '')) > 4000 then
    raise exception using errcode = '22023', message = 'Inquiry summary is too long.';
  end if;

  if coalesce(payload->>'website', '') <> '' or coalesce(payload#>>'{raw_payload,website}', '') <> '' then
    raise exception using errcode = '22023', message = 'Unable to submit event request.';
  end if;

  if normalized ? 'service_role_key' or normalized ? 'admin_override' or normalized ? 'EVENTSIBLE_OS_PRODUCTION_REF' then
    raise exception using errcode = '22023', message = 'Unexpected privileged field.';
  end if;

  if coalesce(payload->>'force_database_failure', 'false') = 'true' then
    raise exception using errcode = 'XX000', message = 'Synthetic forced failure.';
  end if;

  select *
    into existing
    from public.os_builder_submissions
   where request_fingerprint = request_key
   limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'submission_id', existing.id,
      'event_id', existing.event_id,
      'lead_id', (select id from public.os_leads where builder_submission_id = existing.id limit 1),
      'quote_id', (select quote_id from public.os_quote_versions where builder_submission_id = existing.id limit 1)
    );
  end if;

  select *
    into contact_row
    from public.os_contacts
   where (nullif(contact_payload->>'email', '') is not null and lower(primary_email) = lower(contact_payload->>'email'))
      or (nullif(contact_payload->>'phone', '') is not null and primary_phone = contact_payload->>'phone')
   limit 1;

  if not found then
    insert into public.os_contacts (
      display_name,
      first_name,
      last_name,
      primary_email,
      primary_phone,
      preferred_channel,
      source,
      notes,
      metadata
    )
    values (
      contact_payload->>'name',
      split_part(contact_payload->>'name', ' ', 1),
      nullif(trim(replace(contact_payload->>'name', split_part(contact_payload->>'name', ' ', 1), '')), ''),
      nullif(contact_payload->>'email', ''),
      nullif(contact_payload->>'phone', ''),
      coalesce(contact_payload->>'preferred_contact_method', 'email'),
      coalesce(payload->>'source', 'eventsible_event_builder'),
      null,
      jsonb_build_object('source_session_id', request_key)
    )
    returning * into contact_row;
  end if;

  insert into public.os_events (
    primary_contact_id,
    title,
    event_type,
    status,
    starts_at,
    ends_at,
    timezone,
    guest_count,
    venue_name,
    venue_address_1,
    venue_city,
    venue_state,
    source,
    settings
  )
  values (
    contact_row.id,
    coalesce(normalized->>'event_title', concat(contact_row.display_name, ' - Event Inquiry')),
    coalesce(normalized->>'event_type', 'Custom Event'),
    'inquiry',
    nullif(normalized->>'starts_at', '')::timestamp,
    nullif(normalized->>'ends_at', '')::timestamp,
    coalesce(normalized->>'timezone', 'America/Indiana/Indianapolis'),
    nullif(normalized->>'guest_count', '')::integer,
    normalized#>>'{venue,name}',
    normalized#>>'{venue,address_1}',
    normalized#>>'{venue,city}',
    normalized#>>'{venue,state}',
    coalesce(payload->>'source', 'eventsible_event_builder'),
    jsonb_build_object(
      'planning_stage', normalized->>'planning_stage',
      'date_confidence', normalized->>'date_confidence',
      'selected_goals', coalesce(normalized->'selected_goals', '[]'::jsonb),
      'travel', coalesce(normalized->'travel', 'null'::jsonb)
    )
  )
  returning * into event_row;

  insert into public.os_builder_submissions (
    contact_id,
    event_id,
    source,
    source_session_id,
    request_fingerprint,
    intake_version,
    contract_version,
    raw_payload,
    normalized_payload,
    submitted_from
  )
  values (
    contact_row.id,
    event_row.id,
    coalesce(payload->>'source', 'eventsible_event_builder'),
    coalesce(payload->>'source_session_id', request_key),
    request_key,
    coalesce((payload->>'intake_version')::integer, 2),
    normalized->>'contract_version',
    coalesce(payload->'raw_payload', '{}'::jsonb),
    normalized,
    coalesce(payload->>'submitted_from', 'eventsible-event-builder')
  )
  returning * into submission_row;

  insert into public.os_leads (
    contact_id,
    event_id,
    builder_submission_id,
    status,
    source,
    inquiry_summary,
    estimated_value,
    metadata
  )
  values (
    contact_row.id,
    event_row.id,
    submission_row.id,
    'new',
    coalesce(payload->>'source', 'eventsible_event_builder'),
    coalesce(normalized->>'inquiry_summary', concat(event_row.event_type, ' request from Event Builder')),
    coalesce((pricing_payload->>'estimated_total')::numeric, 0),
    jsonb_build_object(
      'contract_version', normalized->>'contract_version',
      'source_application', normalized#>>'{contract_payload,source_application}'
    )
  )
  returning * into lead_row;

  insert into public.os_quote_versions (
    lead_id,
    event_id,
    builder_submission_id,
    subtotal_cents,
    package_savings_cents,
    travel_cents,
    total_cents,
    deposit_cents,
    metadata
  )
  values (
    lead_row.id,
    event_row.id,
    submission_row.id,
    subtotal_cents,
    savings_cents,
    travel_cents,
    total_cents,
    deposit_cents,
    jsonb_build_object(
      'ui_total_cents', total_cents,
      'applied_bundles', coalesce(pricing_payload->'applied_bundles', '[]'::jsonb)
    )
  )
  returning * into quote_row;

  for service in select value from jsonb_array_elements(normalized->'selected_services')
  loop
    service_code := public.os_known_builder_service_code(service);
    service_name := coalesce(service->>'service_name', service->>'name', service_code);
    service_is_custom := coalesce((service->>'custom_quote')::boolean, false)
      or service_code in ('live_performer', 'custom_service')
      or service_code = coalesce(service->>'id', '') and service_code not in (
        'dj_mc',
        'selfie_booth_prints',
        'live_performer',
        'event_staff'
      );
    service_total_cents := case
      when service_is_custom then 0
      else round(coalesce((service->>'line_total')::numeric, 0) * 100)
    end;

    insert into public.os_quote_items (
      quote_version_id,
      event_id,
      service_id,
      service_code,
      service_name,
      label,
      quantity,
      unit,
      unit_price_cents,
      line_total_cents,
      custom_quote,
      metadata
    )
    values (
      quote_row.id,
      event_row.id,
      nullif(service->>'id', ''),
      service_code,
      service_name,
      service_name,
      coalesce((service->>'quantity')::numeric, 1),
      service->>'unit',
      case when service_is_custom then 0 else round(coalesce((service->>'unit_price')::numeric, 0) * 100) end,
      service_total_cents,
      service_is_custom,
      jsonb_build_object(
        'original_label', service_name,
        'category', service->>'category',
        'hours', service->>'hours'
      )
    );
  end loop;

  insert into public.os_builder_activity (
    contact_id,
    builder_submission_id,
    lead_id,
    event_id,
    activity_type,
    facts
  )
  values (
    contact_row.id,
    submission_row.id,
    lead_row.id,
    event_row.id,
    'builder.submission_received',
    jsonb_build_object(
      'contract_version', normalized->>'contract_version',
      'source_application', normalized#>>'{contract_payload,source_application}',
      'selected_goals', coalesce(normalized->'selected_goals', '[]'::jsonb)
    )
  );

  select id
    into outbox_id
    from public.os_integration_outbox
   where idempotency_key = 'builder.submission_received:' || submission_row.id::text
   limit 1;

  if outbox_id is null then
    raise exception using
      errcode = 'XX000',
      message = 'Builder submission outbox trigger did not create an integration event.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'contact_id', contact_row.id,
    'submission_id', submission_row.id,
    'lead_id', lead_row.id,
    'event_id', event_row.id,
    'quote_id', quote_row.quote_id,
    'quote_version_id', quote_row.id,
    'outbox_id', outbox_id
  );
exception
  when others then
    raise;
end;
$$;

revoke all on function public.os_ingest_builder_submission(jsonb) from public;
grant execute on function public.os_ingest_builder_submission(jsonb) to service_role;
