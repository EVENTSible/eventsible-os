-- Staff-private reviewed intake for already-booked gigs. Adapters and manual
-- entry create bounded candidates; only the fixed import RPC may create the
-- canonical contact -> event -> booking -> services chain.

create table public.os_event_import_candidates (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'existing_gig_candidate_v1',
  source text not null,
  external_reference text not null,
  proposed_data jsonb not null,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  matched_event_id uuid references public.os_events(id) on delete set null,
  imported_event_id uuid references public.os_events(id) on delete set null,
  imported_contact_id uuid references public.os_contacts(id) on delete set null,
  imported_booking_id uuid references public.os_bookings(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_event_import_candidates_contract_version_check
    check (contract_version = 'existing_gig_candidate_v1'),
  constraint os_event_import_candidates_source_check
    check (char_length(source) between 1 and 64 and source ~ '^[a-z][a-z0-9_:-]*$'),
  constraint os_event_import_candidates_external_reference_check
    check (
      char_length(external_reference) between 1 and 255
      and external_reference !~ '[[:cntrl:]]'
      and external_reference !~ '://'
    ),
  constraint os_event_import_candidates_proposed_data_check
    check (
      jsonb_typeof(proposed_data) = 'object'
      and octet_length(proposed_data::text) <= 65536
    ),
  constraint os_event_import_candidates_review_status_check
    check (review_status in ('pending', 'review_later', 'ignored', 'matched', 'imported')),
  constraint os_event_import_candidates_review_metadata_check
    check (
      review_status = 'pending'
      or (reviewed_by_user_id is not null and reviewed_at is not null)
    ),
  constraint os_event_import_candidates_result_check
    check (
      (
        review_status in ('pending', 'review_later', 'ignored')
        and matched_event_id is null
        and imported_event_id is null
        and imported_contact_id is null
        and imported_booking_id is null
      )
      or (
        review_status = 'matched'
        and matched_event_id is not null
        and imported_event_id is null
        and imported_contact_id is null
        and imported_booking_id is null
      )
      or (
        review_status = 'imported'
        and matched_event_id is null
        and imported_event_id is not null
        and imported_contact_id is not null
        and imported_booking_id is not null
      )
    ),
  constraint os_event_import_candidates_source_external_reference_key
    unique (source, external_reference)
);

create index os_event_import_candidates_review_queue_idx
  on public.os_event_import_candidates (review_status, created_at desc);

create index os_event_import_candidates_matched_event_idx
  on public.os_event_import_candidates (matched_event_id)
  where matched_event_id is not null;

create index os_event_import_candidates_imported_event_idx
  on public.os_event_import_candidates (imported_event_id)
  where imported_event_id is not null;

create trigger os_event_import_candidates_updated_at
before update on public.os_event_import_candidates
for each row execute function public.os_set_updated_at();

alter table public.os_event_import_candidates enable row level security;

create policy os_event_import_candidates_staff_select
on public.os_event_import_candidates
for select
to authenticated
using ((select public.os_is_staff()));

create policy os_event_import_candidates_staff_insert
on public.os_event_import_candidates
for insert
to authenticated
with check (
  (select public.os_is_staff())
  and created_by_user_id = (select auth.uid())
  and review_status = 'pending'
  and reviewed_by_user_id is null
  and reviewed_at is null
  and matched_event_id is null
  and imported_event_id is null
  and imported_contact_id is null
  and imported_booking_id is null
);

create policy os_event_import_candidates_staff_review_update
on public.os_event_import_candidates
for update
to authenticated
using ((select public.os_is_staff()))
with check (
  (select public.os_is_staff())
  and review_status in ('pending', 'review_later', 'ignored', 'matched')
  and imported_event_id is null
  and imported_contact_id is null
  and imported_booking_id is null
  and (
    (review_status = 'matched' and matched_event_id is not null)
    or (review_status <> 'matched' and matched_event_id is null)
  )
  and (
    review_status = 'pending'
    or (
      reviewed_by_user_id = (select auth.uid())
      and reviewed_at is not null
    )
  )
);

revoke all on table public.os_event_import_candidates from public, anon, authenticated;
grant select, insert on table public.os_event_import_candidates to authenticated;
grant update (
  review_status,
  reviewed_by_user_id,
  reviewed_at,
  matched_event_id,
  updated_at
) on table public.os_event_import_candidates to authenticated;
grant select, insert, update on table public.os_event_import_candidates to service_role;

create function public.os_import_existing_gig(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_candidate public.os_event_import_candidates%rowtype;
  v_proposal jsonb;
  v_event jsonb;
  v_contact jsonb;
  v_service_ids jsonb;
  v_contact_mode text;
  v_contact_id uuid;
  v_event_id uuid;
  v_booking_id uuid;
  v_title text;
  v_event_type text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_timezone text;
  v_booked_amount numeric;
  v_service_count integer;
begin
  if v_actor_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;

  if not public.os_is_staff() then
    raise exception using errcode = '42501', message = 'Staff access is required.';
  end if;

  if p_candidate_id is null then
    raise exception using errcode = '22023', message = 'An import candidate is required.';
  end if;

  select *
  into v_candidate
  from public.os_event_import_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The import candidate was not found.';
  end if;

  if v_candidate.review_status = 'imported' then
    return jsonb_build_object(
      'status', 'replayed',
      'candidate_id', v_candidate.id,
      'contact_id', v_candidate.imported_contact_id,
      'event_id', v_candidate.imported_event_id,
      'booking_id', v_candidate.imported_booking_id
    );
  end if;

  if v_candidate.review_status <> 'pending' then
    raise exception using errcode = '22023', message = 'Only a pending candidate can be imported.';
  end if;

  if v_candidate.contract_version <> 'existing_gig_candidate_v1' then
    raise exception using errcode = '22023', message = 'The candidate contract version is not supported.';
  end if;

  v_proposal := v_candidate.proposed_data;
  if jsonb_typeof(v_proposal) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(v_proposal) as supplied_key
      where supplied_key not in (
        'event', 'contact', 'service_ids', 'booked_amount', 'notes',
        'provenance', 'missing_fields', 'match_warnings', 'date_conflicts'
      )
    ) then
    raise exception using errcode = '22023', message = 'The candidate proposal contains unsupported fields.';
  end if;

  v_event := v_proposal -> 'event';
  v_contact := v_proposal -> 'contact';
  v_service_ids := v_proposal -> 'service_ids';

  if jsonb_typeof(v_event) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(v_event) as supplied_key
      where supplied_key not in (
        'title', 'event_type', 'starts_at', 'ends_at', 'timezone',
        'venue_name', 'venue_address_1', 'venue_address_2', 'venue_city',
        'venue_state', 'venue_postal_code', 'venue_country'
      )
    ) then
    raise exception using errcode = '22023', message = 'The proposed event contains unsupported fields.';
  end if;

  if jsonb_typeof(v_contact) <> 'object'
    or exists (
      select 1 from jsonb_object_keys(v_contact) as supplied_key
      where supplied_key not in (
        'mode', 'contact_id', 'display_name', 'first_name', 'last_name',
        'organization_name', 'primary_email', 'primary_phone'
      )
    ) then
    raise exception using errcode = '22023', message = 'The proposed contact contains unsupported fields.';
  end if;

  v_title := btrim(coalesce(v_event ->> 'title', ''));
  v_event_type := btrim(coalesce(v_event ->> 'event_type', ''));
  v_timezone := btrim(coalesce(v_event ->> 'timezone', ''));

  if char_length(v_title) not between 1 and 180
    or char_length(v_event_type) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Event title and type are required and must fit the intake limits.';
  end if;

  if char_length(v_timezone) not between 1 and 80
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception using errcode = '22023', message = 'A valid event timezone is required.';
  end if;

  if jsonb_typeof(v_event -> 'starts_at') <> 'string' then
    raise exception using errcode = '22023', message = 'A valid event start is required.';
  end if;

  begin
    v_starts_at := (v_event ->> 'starts_at')::timestamptz;
    if jsonb_typeof(v_event -> 'ends_at') = 'string' then
      v_ends_at := (v_event ->> 'ends_at')::timestamptz;
    elsif v_event ? 'ends_at' and jsonb_typeof(v_event -> 'ends_at') <> 'null' then
      raise exception using errcode = '22023', message = 'Event end must be a timestamp or null.';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'Event timestamps are invalid.';
  end;

  if v_ends_at is not null and v_ends_at <= v_starts_at then
    raise exception using errcode = '22023', message = 'Event end must be after event start.';
  end if;

  if char_length(coalesce(v_event ->> 'venue_name', '')) > 180
    or char_length(coalesce(v_event ->> 'venue_address_1', '')) > 200
    or char_length(coalesce(v_event ->> 'venue_address_2', '')) > 160
    or char_length(coalesce(v_event ->> 'venue_city', '')) > 120
    or char_length(coalesce(v_event ->> 'venue_state', '')) > 80
    or char_length(coalesce(v_event ->> 'venue_postal_code', '')) > 24
    or char_length(coalesce(v_event ->> 'venue_country', '')) > 2 then
    raise exception using errcode = '22023', message = 'Venue details exceed the intake limits.';
  end if;

  if v_proposal ? 'notes'
    and (
      jsonb_typeof(v_proposal -> 'notes') not in ('string', 'null')
      or char_length(coalesce(v_proposal ->> 'notes', '')) > 2000
    ) then
    raise exception using errcode = '22023', message = 'Intake notes must be plain text up to 2000 characters.';
  end if;

  if v_proposal ? 'booked_amount' and jsonb_typeof(v_proposal -> 'booked_amount') <> 'null' then
    if jsonb_typeof(v_proposal -> 'booked_amount') <> 'number' then
      raise exception using errcode = '22023', message = 'Booked amount must be a number.';
    end if;
    v_booked_amount := (v_proposal ->> 'booked_amount')::numeric;
    if v_booked_amount < 0 or v_booked_amount > 1000000 then
      raise exception using errcode = '22023', message = 'Booked amount is outside the supported range.';
    end if;
  end if;

  if jsonb_typeof(v_service_ids) <> 'array'
    or jsonb_array_length(v_service_ids) < 1
    or jsonb_array_length(v_service_ids) > 20
    or exists (
      select 1 from jsonb_array_elements_text(v_service_ids) as service_value
      where service_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
    raise exception using errcode = '22023', message = 'Select between 1 and 20 canonical services.';
  end if;

  select count(distinct service_value)
  into v_service_count
  from jsonb_array_elements_text(v_service_ids) as service_value;

  if v_service_count <> jsonb_array_length(v_service_ids)
    or v_service_count <> (
      select count(*)
      from public.os_service_catalog catalog
      join (
        select service_value::uuid as service_id
        from jsonb_array_elements_text(v_service_ids) as service_value
      ) selected on selected.service_id = catalog.id
      where catalog.is_active
    ) then
    raise exception using errcode = '22023', message = 'Every selected service must be an active canonical service.';
  end if;

  v_contact_mode := v_contact ->> 'mode';
  if v_contact_mode = 'reuse' then
    if coalesce(v_contact ->> 'contact_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'Select a valid canonical contact.';
    end if;
    v_contact_id := (v_contact ->> 'contact_id')::uuid;
    perform 1 from public.os_contacts where id = v_contact_id and status = 'active';
    if not found then
      raise exception using errcode = 'P0002', message = 'The selected active contact was not found.';
    end if;
  elsif v_contact_mode = 'create' then
    if v_contact ? 'contact_id' then
      raise exception using errcode = '22023', message = 'A new-contact proposal cannot select an existing contact.';
    end if;
    if char_length(btrim(coalesce(v_contact ->> 'display_name', ''))) not between 1 and 160
      or (
        btrim(coalesce(v_contact ->> 'primary_email', '')) = ''
        and btrim(coalesce(v_contact ->> 'primary_phone', '')) = ''
      )
      or char_length(coalesce(v_contact ->> 'first_name', '')) > 100
      or char_length(coalesce(v_contact ->> 'last_name', '')) > 100
      or char_length(coalesce(v_contact ->> 'organization_name', '')) > 160
      or char_length(coalesce(v_contact ->> 'primary_email', '')) > 254
      or char_length(coalesce(v_contact ->> 'primary_phone', '')) > 40 then
      raise exception using errcode = '22023', message = 'New contact details do not meet the canonical intake requirements.';
    end if;

    insert into public.os_contacts (
      first_name,
      last_name,
      display_name,
      organization_name,
      primary_email,
      primary_phone,
      preferred_channel,
      source,
      status,
      created_by
    ) values (
      nullif(btrim(v_contact ->> 'first_name'), ''),
      nullif(btrim(v_contact ->> 'last_name'), ''),
      btrim(v_contact ->> 'display_name'),
      nullif(btrim(v_contact ->> 'organization_name'), ''),
      nullif(btrim(v_contact ->> 'primary_email'), ''),
      nullif(btrim(v_contact ->> 'primary_phone'), ''),
      case when nullif(btrim(v_contact ->> 'primary_email'), '') is not null then 'email' else 'text' end,
      v_candidate.source,
      'active',
      v_actor_user_id
    ) returning id into v_contact_id;
  else
    raise exception using errcode = '22023', message = 'Choose whether to reuse or create a canonical contact.';
  end if;

  insert into public.os_events (
    primary_contact_id,
    title,
    event_type,
    status,
    starts_at,
    ends_at,
    timezone,
    venue_name,
    venue_address_1,
    venue_address_2,
    venue_city,
    venue_state,
    venue_postal_code,
    venue_country,
    source,
    settings,
    created_by
  ) values (
    v_contact_id,
    v_title,
    v_event_type,
    'booked',
    v_starts_at,
    v_ends_at,
    v_timezone,
    nullif(btrim(v_event ->> 'venue_name'), ''),
    nullif(btrim(v_event ->> 'venue_address_1'), ''),
    nullif(btrim(v_event ->> 'venue_address_2'), ''),
    nullif(btrim(v_event ->> 'venue_city'), ''),
    nullif(btrim(v_event ->> 'venue_state'), ''),
    nullif(btrim(v_event ->> 'venue_postal_code'), ''),
    coalesce(nullif(upper(btrim(v_event ->> 'venue_country')), ''), 'US'),
    v_candidate.source,
    '{}'::jsonb,
    v_actor_user_id
  ) returning id into v_event_id;

  insert into public.os_bookings (
    event_id,
    status,
    contract_status,
    payment_status,
    total_amount,
    balance_due,
    metadata
  ) values (
    v_event_id,
    'pending',
    'not_sent',
    'unpaid',
    v_booked_amount,
    v_booked_amount,
    jsonb_build_object(
      'import_candidate_id', v_candidate.id,
      'source', v_candidate.source,
      'external_reference', v_candidate.external_reference
    )
  ) returning id into v_booking_id;

  insert into public.os_booking_services (
    booking_id,
    service_id,
    service_code,
    service_name,
    status,
    starts_at,
    ends_at,
    configuration
  )
  select
    v_booking_id,
    catalog.id,
    catalog.code,
    catalog.name,
    'planning',
    v_starts_at,
    v_ends_at,
    '{}'::jsonb
  from public.os_service_catalog catalog
  join (
    select service_value::uuid as service_id
    from jsonb_array_elements_text(v_service_ids) as service_value
  ) selected on selected.service_id = catalog.id
  order by catalog.sort_order, catalog.name;

  -- Confirm only after services exist so the canonical booking bootstrap sees
  -- the reviewed service set and owns planning/workspace/fact side effects.
  update public.os_bookings
  set status = 'confirmed', booked_at = now()
  where id = v_booking_id;

  update public.os_event_import_candidates
  set review_status = 'imported',
      reviewed_by_user_id = v_actor_user_id,
      reviewed_at = now(),
      matched_event_id = null,
      imported_event_id = v_event_id,
      imported_contact_id = v_contact_id,
      imported_booking_id = v_booking_id
  where id = v_candidate.id;

  insert into public.os_activity_events (
    event_id,
    contact_id,
    actor_user_id,
    event_type,
    visibility,
    payload,
    idempotency_key
  ) values (
    v_event_id,
    v_contact_id,
    v_actor_user_id,
    'event.existing_gig_imported',
    'staff',
    jsonb_build_object(
      'summary', 'Reviewed existing gig imported.',
      'candidate_id', v_candidate.id,
      'source', v_candidate.source,
      'external_reference', v_candidate.external_reference,
      'booking_id', v_booking_id
    ),
    'candidate:' || v_candidate.id::text || ':existing-gig-imported'
  );

  return jsonb_build_object(
    'status', 'imported',
    'candidate_id', v_candidate.id,
    'contact_id', v_contact_id,
    'event_id', v_event_id,
    'booking_id', v_booking_id
  );
end;
$$;

revoke all on function public.os_import_existing_gig(uuid)
  from public, anon, authenticated;
grant execute on function public.os_import_existing_gig(uuid)
  to authenticated;
