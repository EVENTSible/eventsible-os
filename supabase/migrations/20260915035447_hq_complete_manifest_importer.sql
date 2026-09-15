-- Complete reviewed-manifest importer. This migration adds an atomic v2 path
-- alongside intake_manifest_v1; it does not stage or apply any Production data.

create table public.os_booking_payment_facts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.os_bookings(id) on delete restrict,
  import_batch_item_id uuid not null unique references public.os_import_batch_items(id) on delete restrict,
  gross_client_amount numeric(12,2),
  platform_fee_amount numeric(12,2),
  net_payout_amount numeric(12,2),
  payment_method text not null,
  payment_status text not null,
  payout_status text not null,
  currency text not null default 'USD',
  source_ref text,
  source_hash text not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_booking_payment_facts_amounts_chk check (
    (gross_client_amount is null or gross_client_amount >= 0)
    and (platform_fee_amount is null or platform_fee_amount >= 0)
    and (net_payout_amount is null or net_payout_amount >= 0)
  ),
  constraint os_booking_payment_facts_arithmetic_chk check (
    gross_client_amount is null or platform_fee_amount is null or net_payout_amount is null
    or abs((gross_client_amount - platform_fee_amount) - net_payout_amount) <= 0.01
  ),
  constraint os_booking_payment_facts_method_chk check (
    payment_method in ('cash','check','card','bank_transfer','gigsalad','invoice','other','unknown')
  ),
  constraint os_booking_payment_facts_payment_status_chk check (
    payment_status in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded')
  ),
  constraint os_booking_payment_facts_payout_status_chk check (
    payout_status in ('not_applicable','pending','paid','refunded','unknown')
  ),
  constraint os_booking_payment_facts_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint os_booking_payment_facts_source_hash_chk check (source_hash ~ '^[a-f0-9]{64}$'),
  constraint os_booking_payment_facts_source_ref_chk check (source_ref is null or char_length(source_ref) <= 240),
  constraint os_booking_payment_facts_status_chk check (status in ('active','archived'))
);

create table public.os_import_source_provenance (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.os_import_batches(id) on delete restrict,
  import_batch_item_id uuid not null unique references public.os_import_batch_items(id) on delete restrict,
  contact_id uuid references public.os_contacts(id) on delete restrict,
  lead_id uuid references public.os_leads(id) on delete restrict,
  event_id uuid references public.os_events(id) on delete restrict,
  booking_id uuid references public.os_bookings(id) on delete restrict,
  source_ref text not null,
  source_hash text not null,
  evidence_kind text not null,
  confidence text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint os_import_source_provenance_target_chk check (num_nonnulls(contact_id,lead_id,event_id,booking_id) >= 1),
  constraint os_import_source_provenance_ref_chk check (char_length(source_ref) between 1 and 240),
  constraint os_import_source_provenance_hash_chk check (source_hash ~ '^[a-f0-9]{64}$'),
  constraint os_import_source_provenance_kind_chk check (evidence_kind in ('invoice','contract','booking_agreement','calendar','screenshot','owner_correction','note','other')),
  constraint os_import_source_provenance_confidence_chk check (confidence in ('confirmed','supported','lower_confidence','unresolved'))
);

create index os_booking_payment_facts_booking_idx on public.os_booking_payment_facts(booking_id, created_at);
create index os_booking_payment_facts_source_hash_idx on public.os_booking_payment_facts(source_hash);
create index os_import_source_provenance_batch_idx on public.os_import_source_provenance(batch_id, created_at);
create index os_import_source_provenance_contact_idx on public.os_import_source_provenance(contact_id) where contact_id is not null;
create index os_import_source_provenance_lead_idx on public.os_import_source_provenance(lead_id) where lead_id is not null;
create index os_import_source_provenance_event_idx on public.os_import_source_provenance(event_id) where event_id is not null;
create index os_import_source_provenance_booking_idx on public.os_import_source_provenance(booking_id) where booking_id is not null;
create index os_contacts_import_source_hash_idx on public.os_contacts((metadata->>'sourceHash')) where metadata ? 'sourceHash';
create index os_events_import_source_hash_idx on public.os_events((settings->>'sourceHash')) where settings ? 'sourceHash';
create index os_leads_import_source_hash_idx on public.os_leads((metadata->>'sourceHash')) where metadata ? 'sourceHash';
create index os_bookings_import_source_hash_idx on public.os_bookings((metadata->>'sourceHash')) where metadata ? 'sourceHash';
create index os_booking_services_import_source_hash_idx on public.os_booking_services((configuration->>'sourceHash')) where configuration ? 'sourceHash';

alter table public.os_booking_payment_facts enable row level security;
alter table public.os_import_source_provenance enable row level security;
revoke all on public.os_booking_payment_facts from public, anon, authenticated;
revoke all on public.os_import_source_provenance from public, anon, authenticated;
grant all on public.os_booking_payment_facts to service_role;
grant all on public.os_import_source_provenance to service_role;

alter table public.os_import_batch_items drop constraint os_import_batch_items_type_chk;
alter table public.os_import_batch_items add constraint os_import_batch_items_type_chk check (
  candidate_type in ('contact','inquiry','event','booking','booking_service','payment_fact','staff_assignment','operational_note','calendar_fact','source_provenance')
);

create or replace function private.os_complete_manifest_item_counts(p_items jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'contact',count(*) filter(where value->>'type'='contact'),
    'inquiry',count(*) filter(where value->>'type'='inquiry'),
    'event',count(*) filter(where value->>'type'='event'),
    'booking',count(*) filter(where value->>'type'='booking'),
    'booking_service',count(*) filter(where value->>'type'='booking_service'),
    'payment_fact',count(*) filter(where value->>'type'='payment_fact'),
    'staff_assignment',count(*) filter(where value->>'type'='staff_assignment'),
    'operational_note',count(*) filter(where value->>'type'='operational_note'),
    'source_provenance',count(*) filter(where value->>'type'='source_provenance')
  )
  from jsonb_array_elements(p_items);
$$;
revoke all on function private.os_complete_manifest_item_counts(jsonb) from public, anon, authenticated;

create or replace function private.os_complete_intake_record_fingerprint(p_type text, p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_record jsonb;
begin
  if p_type='contact' then select to_jsonb(r) into v_record from public.os_contacts r where r.id=p_id;
  elsif p_type='event' then select to_jsonb(r) into v_record from public.os_events r where r.id=p_id;
  elsif p_type='inquiry' then select to_jsonb(r) into v_record from public.os_leads r where r.id=p_id;
  elsif p_type='booking' then select to_jsonb(r) into v_record from public.os_bookings r where r.id=p_id;
  else raise exception 'Existing-record linking is not supported for this item type' using errcode='22023';
  end if;
  if v_record is null then return null; end if;
  return encode(extensions.digest(convert_to(v_record::text,'UTF8'),'sha256'),'hex');
end;
$$;
revoke all on function private.os_complete_intake_record_fingerprint(text,uuid) from public, anon, authenticated;

create or replace function private.os_complete_intake_native_state_fingerprint()
returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_contacts r),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_events r),'[]'::jsonb),
    'leads',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_leads r),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_bookings r),'[]'::jsonb),
    'builderSubmissions',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_builder_submissions r),'[]'::jsonb),
    'builderIntakeRequests',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_builder_intake_requests r),'[]'::jsonb),
    'planningAssignments',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_planning_assignments r),'[]'::jsonb),
    'planningAnswers',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.os_planning_answers r),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex');
$$;
revoke all on function private.os_complete_intake_native_state_fingerprint() from public, anon, authenticated;

-- Serialize native Wedding Hero / Event Builder writes with the final import
-- duplicate check. The importer takes the same transaction lock before its
-- final fingerprint comparison; native writes fail closed while it is held.
create or replace function private.os_guard_complete_intake_native_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0)) then
    raise exception 'A reviewed import is being applied; retry the native submission' using errcode='40001';
  end if;
  return new;
end;
$$;
revoke all on function private.os_guard_complete_intake_native_write() from public, anon, authenticated;

create trigger os_builder_intake_complete_import_serialization
before insert or update on public.os_builder_intake_requests
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_builder_submission_complete_import_serialization
before insert or update on public.os_builder_submissions
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_contact_complete_import_serialization
before insert or update on public.os_contacts
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_event_complete_import_serialization
before insert or update on public.os_events
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_lead_complete_import_serialization
before insert or update on public.os_leads
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_booking_complete_import_serialization
before insert or update on public.os_bookings
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_planning_assignment_complete_import_serialization
before insert or update on public.os_planning_assignments
for each row execute function private.os_guard_complete_intake_native_write();
create trigger os_planning_answer_complete_import_serialization
before insert or update on public.os_planning_answers
for each row execute function private.os_guard_complete_intake_native_write();

create or replace function private.os_complete_manifest_duplicate_warnings(
  p_type text, p_source_hash text, p_data jsonb
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb := '[]'::jsonb;
  v_target uuid;
  v_actual_hash text;
  v_status text;
begin
  if coalesce(p_data->>'recordMode','create')='link_existing' then
    begin v_target := (p_data->>'existingRecordId')::uuid; exception when others then
      return jsonb_build_array(jsonb_build_object('kind','invalid_existing_record_id'));
    end;
    v_actual_hash:=private.os_complete_intake_record_fingerprint(p_type,v_target);
    if v_actual_hash is null then return jsonb_build_array(jsonb_build_object('kind','existing_record_missing')); end if;
    if v_actual_hash<>lower(coalesce(p_data->>'expectedRecordHash','')) then return jsonb_build_array(jsonb_build_object('kind','existing_record_changed')); end if;
    if p_type='contact' then select status into v_status from public.os_contacts where id=v_target;
    elsif p_type='event' then select status into v_status from public.os_events where id=v_target;
    elsif p_type='inquiry' then select status into v_status from public.os_leads where id=v_target;
    elsif p_type='booking' then select status into v_status from public.os_bookings where id=v_target;
    end if;
    if v_status in ('archived','cancelled') then return jsonb_build_array(jsonb_build_object('kind','archived_match_requires_owner_review','recordId',v_target)); end if;
  end if;
  if p_type='contact' then
    select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'recordId',id)),'[]'::jsonb) into v_result from (
      select id,'exact_source_hash'::text kind from public.os_contacts where metadata->>'sourceHash'=p_source_hash and id is distinct from v_target
      union all select id,'exact_email' from public.os_contacts where nullif(lower(p_data->>'primaryEmail'),'') is not null and lower(primary_email)=lower(p_data->>'primaryEmail') and id is distinct from v_target
      union all select id,'exact_phone' from public.os_contacts where nullif(regexp_replace(p_data->>'primaryPhone','\D','','g'),'') is not null and regexp_replace(primary_phone,'\D','','g')=regexp_replace(p_data->>'primaryPhone','\D','','g') and id is distinct from v_target
    ) d;
  elsif p_type='event' then
    select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'recordId',id)),'[]'::jsonb) into v_result from (
      select id,'exact_source_hash'::text kind from public.os_events where settings->>'sourceHash'=p_source_hash and id is distinct from v_target
      union all select id,'same_title_and_start' from public.os_events where lower(title)=lower(p_data->>'title') and starts_at is not distinct from nullif(p_data->>'startsAt','')::timestamptz and id is distinct from v_target
    ) d;
  elsif p_type='inquiry' then
    select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_result from public.os_leads where metadata->>'sourceHash'=p_source_hash and id is distinct from v_target;
  elsif p_type='booking' then
    select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_result from public.os_bookings where metadata->>'sourceHash'=p_source_hash and id is distinct from v_target;
  elsif p_type='booking_service' then
    select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_result from public.os_booking_services where configuration->>'sourceHash'=p_source_hash;
  elsif p_type='payment_fact' then
    select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_result from public.os_booking_payment_facts where source_hash=p_source_hash;
  elsif p_type='source_provenance' then
    select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_result from public.os_import_source_provenance where source_hash=p_source_hash;
  end if;
  return v_result;
end;
$$;
revoke all on function private.os_complete_manifest_duplicate_warnings(text,text,jsonb) from public, anon, authenticated;

create or replace function private.os_validate_complete_import_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_batch uuid;
begin
  if coalesce(new.metadata->>'suppressAutomations','false') <> 'true' then return new; end if;
  begin v_batch := (new.metadata->>'importBatchId')::uuid; exception when others then raise exception 'Invalid import automation suppression' using errcode='42501'; end;
  if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') or not exists (
    select 1 from public.os_import_batches b where b.id=v_batch and b.contract_version='intake_manifest_v2' and b.status='importing' and b.approved_by=auth.uid()
  ) then raise exception 'Import automation suppression is not authorized' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.os_validate_complete_import_booking() from public, anon, authenticated;

create trigger os_booking_complete_import_guard
before insert or update of status,metadata on public.os_bookings
for each row execute function private.os_validate_complete_import_booking();

drop trigger os_booking_confirmation_event on public.os_bookings;
create trigger os_booking_confirmation_event after insert or update on public.os_bookings
for each row when (coalesce(new.metadata->>'suppressAutomations','false') <> 'true')
execute function private.os_track_booking_confirmation();

drop trigger os_booking_bootstrap on public.os_bookings;
create trigger os_booking_bootstrap after insert or update on public.os_bookings
for each row when (coalesce(new.metadata->>'suppressAutomations','false') <> 'true')
execute function private.os_bootstrap_confirmed_booking();

create or replace function public.os_stage_complete_intake_manifest(
  p_manifest_base64 text,
  p_expected_hash text,
  p_expected_record_count integer,
  p_expected_item_counts jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  p_manifest jsonb;
  v_manifest_bytes bytea;
  v_hash text;
  v_counts jsonb;
  v_batch uuid;
  v_item jsonb;
  v_keys text[] := array[]::text[];
  v_required text[];
  v_field text;
  v_type text;
  v_mode text;
  v_data jsonb;
  v_ref text;
  v_warnings jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  begin
    if octet_length(coalesce(p_manifest_base64,''))>699052 then raise exception 'Manifest exceeds encoded size limit'; end if;
    v_manifest_bytes:=decode(p_manifest_base64,'base64');
    if octet_length(v_manifest_bytes)>524288 then raise exception 'Manifest exceeds size limit'; end if;
    p_manifest:=convert_from(v_manifest_bytes,'UTF8')::jsonb;
  exception when others then raise exception 'Invalid complete intake manifest encoding' using errcode='22023'; end;
  if jsonb_typeof(p_manifest)<>'object' or p_manifest->>'contractVersion'<>'intake_manifest_v2'
    or lower(coalesce(p_manifest->>'sourceBaselineHash',''))<>'c9b2f167f8ea2ac2255e01ba52891a9e23df9f09646918cd8468cc1c22cff643'
    or char_length(btrim(coalesce(p_manifest->>'sourceLabel',''))) not between 1 and 120
    or jsonb_typeof(p_manifest->'items')<>'array' or jsonb_array_length(p_manifest->'items') not between 1 and 250
    or octet_length(p_manifest::text)>524288 then raise exception 'Invalid complete intake manifest' using errcode='22023'; end if;
  v_hash := encode(extensions.digest(v_manifest_bytes,'sha256'),'hex');
  v_counts := private.os_complete_manifest_item_counts(p_manifest->'items');
  if lower(coalesce(p_expected_hash,''))<>v_hash or p_expected_record_count<>24 or p_expected_record_count<>(p_manifest->>'recordCount')::integer
    or p_expected_record_count<>(v_counts->>'event')::integer
    or p_expected_item_counts is distinct from p_manifest->'itemCounts'
    or p_expected_item_counts is distinct from v_counts then raise exception 'Manifest hash or exact counts do not match' using errcode='22023'; end if;
  select id into v_batch from public.os_import_batches where manifest_hash=v_hash;
  if v_batch is not null then return jsonb_build_object('status','replayed','batchId',v_batch,'manifestHash',v_hash,'recordCount',p_expected_record_count,'itemCounts',v_counts); end if;

  for v_item in select value from jsonb_array_elements(p_manifest->'items') loop
    v_type:=v_item->>'type'; v_data:=v_item->'data'; v_mode:=coalesce(v_item->'data'->>'recordMode','create');
    if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'key','') !~ '^[a-z0-9][a-z0-9._:-]{0,119}$'
      or v_type not in ('contact','inquiry','event','booking','booking_service','payment_fact','staff_assignment','operational_note','source_provenance')
      or jsonb_typeof(v_data)<>'object' or coalesce(v_item->>'sourceHash','') !~ '^[a-f0-9]{64}$'
      or char_length(coalesce(v_item->>'sourceRef',''))>240 or octet_length(v_data::text)>32768
      or jsonb_typeof(coalesce(v_item->'uncertainFields','[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(v_item->'uncertainFields','[]'::jsonb))>30 then raise exception 'Invalid complete intake item' using errcode='22023'; end if;
    if v_mode not in ('create','link_existing') or (v_mode='link_existing' and v_type not in ('contact','event','inquiry','booking')) then raise exception 'Invalid existing-record link mode' using errcode='22023'; end if;
    if v_item->>'key'=any(v_keys) then raise exception 'Duplicate intake item key' using errcode='22023'; end if;
    v_keys:=array_append(v_keys,v_item->>'key');
    v_required:=case v_type
      when 'contact' then array['displayName']
      when 'inquiry' then array['contactItemKey','eventItemKey','status']
      when 'event' then array['primaryContactItemKey','title','eventType','status','recordDisposition']
      when 'booking' then array['eventItemKey','status','contractStatus']
      when 'booking_service' then array['bookingItemKey','serviceCode','serviceName','status']
      when 'payment_fact' then array['bookingItemKey','paymentMethod','paymentStatus','payoutStatus']
      when 'staff_assignment' then array['eventItemKey','teamMemberId','assignmentRole']
      when 'operational_note' then array['eventItemKey','body']
      when 'source_provenance' then array['targetItemKey','evidenceKind','confidence'] end;
    foreach v_field in array v_required loop
      if nullif(v_data->>v_field,'') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? v_field then raise exception 'Required intake value is missing or uncertain' using errcode='22023'; end if;
    end loop;
    if v_mode='link_existing' and (coalesce(v_data->>'existingRecordId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or coalesce(v_data->>'expectedRecordHash','') !~ '^[a-f0-9]{64}$' or coalesce(v_data->>'sourcePrecedence','')<>'preserve_existing_native') then raise exception 'Existing-record links require an exact id, fingerprint, and preserve-existing source policy' using errcode='22023'; end if;
    if v_type='contact' and v_mode='create' and nullif(v_data->>'primaryEmail','') is null and nullif(v_data->>'primaryPhone','') is null then raise exception 'Contact email or phone required' using errcode='22023'; end if;
    if v_type='event' and (v_data->>'status' not in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed','cancelled') or v_data->>'recordDisposition' not in ('confirmed','lower_confidence_review','pending_unbooked')) then raise exception 'Invalid event classification' using errcode='22023'; end if;
    if v_type='event' and ((v_data->>'recordDisposition'='lower_confidence_review' and v_data->>'status'<>'inquiry') or (v_data->>'recordDisposition'='pending_unbooked' and v_data->>'status'<>'pending')) then raise exception 'Review-only and pending-unbooked events must retain bounded statuses' using errcode='22023'; end if;
    if v_type='inquiry' and v_data->>'status' not in ('new','qualifying','quoted','follow_up','won','lost') then raise exception 'Invalid inquiry status' using errcode='22023'; end if;
    if v_type='booking' and (v_data->>'status' not in ('pending','pending_contract','pending_deposit','confirmed','cancelled','completed') or v_data->>'contractStatus' not in ('not_sent','sent','viewed','signed','void')) then raise exception 'Invalid booking status' using errcode='22023'; end if;
    if v_type='booking_service' and v_data->>'status' not in ('booked','planning','ready','delivered','cancelled') then raise exception 'Invalid booking service status' using errcode='22023'; end if;
    if v_type='payment_fact' and (v_data->>'paymentMethod' not in ('cash','check','card','bank_transfer','gigsalad','invoice','other','unknown') or v_data->>'paymentStatus' not in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded') or v_data->>'payoutStatus' not in ('not_applicable','pending','paid','refunded','unknown')) then raise exception 'Invalid payment classification' using errcode='22023'; end if;
    if v_type='staff_assignment' and v_data->>'assignmentRole' not in ('dj','mc','vocalist','assistant','activity_helper','operator','other') then raise exception 'Invalid assignment role' using errcode='22023'; end if;
    if v_type='source_provenance' and (v_data->>'evidenceKind' not in ('invoice','contract','booking_agreement','calendar','screenshot','owner_correction','note','other') or v_data->>'confidence' not in ('confirmed','supported','lower_confidence','unresolved')) then raise exception 'Invalid provenance classification' using errcode='22023'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_manifest->'items') loop
    v_type:=v_item->>'type'; v_data:=v_item->'data';
    foreach v_ref in array case v_type
      when 'event' then array[v_data->>'primaryContactItemKey']
      when 'inquiry' then array[v_data->>'contactItemKey',v_data->>'eventItemKey']
      when 'booking' then array[v_data->>'eventItemKey']
      when 'booking_service' then array[v_data->>'bookingItemKey']
      when 'payment_fact' then array[v_data->>'bookingItemKey']
      when 'staff_assignment' then array[v_data->>'eventItemKey']
      when 'operational_note' then array[v_data->>'eventItemKey']
      when 'source_provenance' then array[v_data->>'targetItemKey']
      else array[]::text[] end loop
      if not v_ref=any(v_keys) then raise exception 'Referenced manifest item key does not exist' using errcode='22023'; end if;
    end loop;
    if v_type='booking' and exists(select 1 from jsonb_array_elements(p_manifest->'items') x where x->>'key'=v_data->>'eventItemKey' and x->'data'->>'recordDisposition' in ('lower_confidence_review','pending_unbooked')) then raise exception 'Review-only or pending-unbooked events cannot create bookings' using errcode='22023'; end if;
  end loop;

  insert into public.os_import_batches(import_type,status,row_count,summary,created_by,contract_version,manifest_hash,source_label)
  values('manual_backfill','previewed',jsonb_array_length(p_manifest->'items'),jsonb_build_object('contractVersion','intake_manifest_v2','recordCount',p_expected_record_count,'itemCounts',v_counts,'sourceBaselineHash',lower(p_manifest->>'sourceBaselineHash'),'nativeStateHash',private.os_complete_intake_native_state_fingerprint(),'sourcePrecedence','preserve_existing_native','atomic',true),v_actor,'intake_manifest_v2',v_hash,btrim(p_manifest->>'sourceLabel')) returning id into v_batch;
  for v_item in select value from jsonb_array_elements(p_manifest->'items') loop
    v_warnings:=private.os_complete_manifest_duplicate_warnings(v_item->>'type',v_item->>'sourceHash',v_item->'data');
    insert into public.os_import_batch_items(batch_id,item_key,candidate_type,source_ref,source_hash,proposed_data,uncertain_fields,duplicate_warnings)
    values(v_batch,v_item->>'key',v_item->>'type',nullif(v_item->>'sourceRef',''),v_item->>'sourceHash',v_item->'data',coalesce(v_item->'uncertainFields','[]'::jsonb),v_warnings);
  end loop;
  return jsonb_build_object('status','previewed','batchId',v_batch,'manifestHash',v_hash,'recordCount',p_expected_record_count,'itemCounts',v_counts);
end;
$$;

create or replace function public.os_approve_complete_intake_batch(
  p_batch_id uuid, p_manifest_hash text, p_record_count integer, p_item_counts jsonb, p_item_keys text[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_batch public.os_import_batches%rowtype; v_actual_keys text[];
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  select * into v_batch from public.os_import_batches where id=p_batch_id for update;
  if not found or v_batch.contract_version<>'intake_manifest_v2' or v_batch.manifest_hash<>lower(p_manifest_hash) or v_batch.status<>'previewed'
    or (v_batch.summary->>'recordCount')::integer<>p_record_count or v_batch.summary->'itemCounts' is distinct from p_item_counts then raise exception 'Batch hash, version, status, or counts do not match' using errcode='22023'; end if;
  select array_agg(item_key order by item_key) into v_actual_keys from public.os_import_batch_items where batch_id=p_batch_id;
  if v_actual_keys is distinct from (select array_agg(x order by x) from unnest(p_item_keys) x) or cardinality(v_actual_keys)<>cardinality(p_item_keys) then raise exception 'Exact approved item set mismatch' using errcode='22023'; end if;
  if exists(select 1 from public.os_import_batch_items where batch_id=p_batch_id and jsonb_array_length(duplicate_warnings)>0) then raise exception 'Duplicate warnings require a new reviewed manifest' using errcode='23505'; end if;
  update public.os_import_batch_items set status='approved',approved_by=v_actor,approved_at=now(),error_code=null,updated_at=now() where batch_id=p_batch_id;
  update public.os_import_batches set status='importing',approved_manifest_hash=manifest_hash,approved_by=v_actor,approved_at=now(),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status','approved','batchId',p_batch_id,'approvedCount',cardinality(v_actual_keys));
end;
$$;

create or replace function public.os_apply_complete_intake_batch(
  p_batch_id uuid, p_manifest_hash text, p_record_count integer, p_item_counts jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=auth.uid();
  v_batch public.os_import_batches%rowtype;
  v_item record;
  v_id uuid;
  v_event uuid;
  v_contact uuid;
  v_lead uuid;
  v_booking uuid;
  v_service uuid;
  v_target_type text;
  v_before jsonb;
  v_warnings jsonb;
  v_booking_linked boolean;
  v_applied integer:=0;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  select * into v_batch from public.os_import_batches where id=p_batch_id for update;
  if not found or v_batch.contract_version<>'intake_manifest_v2' or v_batch.manifest_hash<>lower(p_manifest_hash)
    or v_batch.approved_manifest_hash<>lower(p_manifest_hash)
    or (v_batch.summary->>'recordCount')::integer<>p_record_count or v_batch.summary->'itemCounts' is distinct from p_item_counts then raise exception 'Approved batch hash, version, or counts do not match' using errcode='22023'; end if;
  if v_batch.status='completed' then return jsonb_build_object('status','replayed','batchId',p_batch_id,'applied',v_batch.created_count); end if;
  if v_batch.status<>'importing' or exists(select 1 from public.os_import_batch_items where batch_id=p_batch_id and status<>'approved')
    or (select count(*) from public.os_import_batch_items where batch_id=p_batch_id)<>v_batch.row_count then raise exception 'The exact approved item set is no longer applicable' using errcode='40001'; end if;

  -- Serialize the final compatibility check with native Event Builder, Wedding
  -- Hero, planning, and canonical writes. A submission committed after preview
  -- invalidates this import instead of being overwritten or silently merged.
  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  lock table public.os_bookings, public.os_builder_intake_requests, public.os_builder_submissions,
    public.os_contacts, public.os_events, public.os_leads, public.os_planning_answers,
    public.os_planning_assignments in share row exclusive mode;
  if private.os_complete_intake_native_state_fingerprint()<>v_batch.summary->>'nativeStateHash' then
    raise exception 'Native submission or canonical record changed after preview; rebuild the reviewed manifest' using errcode='40001';
  end if;

  -- Re-run duplicate and exact-link detection immediately before the first canonical write.
  for v_item in select * from public.os_import_batch_items where batch_id=p_batch_id order by id loop
    v_warnings:=private.os_complete_manifest_duplicate_warnings(v_item.candidate_type,v_item.source_hash,v_item.proposed_data);
    if jsonb_array_length(v_warnings)>0 then raise exception 'Production duplicate detection stopped the complete import' using errcode='23505'; end if;
  end loop;

  for v_item in
    select * from public.os_import_batch_items where batch_id=p_batch_id and status='approved'
    order by case candidate_type when 'contact' then 1 when 'event' then 2 when 'inquiry' then 3 when 'booking' then 4 when 'booking_service' then 5 when 'payment_fact' then 6 when 'staff_assignment' then 7 when 'operational_note' then 8 when 'source_provenance' then 9 end, created_at, id
  loop
    v_id:=null; v_event:=null; v_contact:=null; v_lead:=null; v_booking:=null; v_service:=null; v_before:=null; v_booking_linked:=false;
    update public.os_import_batch_items set status='applying',updated_at=now() where id=v_item.id;
    if v_item.candidate_type='contact' and coalesce(v_item.proposed_data->>'recordMode','create')='link_existing' then
      v_id:=(v_item.proposed_data->>'existingRecordId')::uuid;
      if private.os_complete_intake_record_fingerprint('contact',v_id)<>v_item.proposed_data->>'expectedRecordHash' then raise exception 'Existing contact changed after review' using errcode='40001'; end if;
      select id into v_contact from public.os_contacts where id=v_id and status<>'archived';
      if v_contact is null then raise exception 'Existing contact is unavailable' using errcode='P0002'; end if;
      v_before:=jsonb_build_object('linkedExisting',true,'sourcePrecedence','preserve_existing_native');
    elsif v_item.candidate_type='contact' then
      insert into public.os_contacts(first_name,last_name,display_name,organization_name,primary_email,primary_phone,preferred_channel,source,status,notes,metadata,created_by)
      values(nullif(btrim(v_item.proposed_data->>'firstName'),''),nullif(btrim(v_item.proposed_data->>'lastName'),''),btrim(v_item.proposed_data->>'displayName'),nullif(btrim(v_item.proposed_data->>'organizationName'),''),nullif(lower(btrim(v_item.proposed_data->>'primaryEmail')),''),nullif(btrim(v_item.proposed_data->>'primaryPhone'),''),case when v_item.proposed_data->>'preferredChannel' in ('email','text','phone','portal') then v_item.proposed_data->>'preferredChannel' else 'email' end,'reviewed_intake','active',nullif(left(btrim(v_item.proposed_data->>'notes'),4000),''),jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash),v_actor)
      returning id into v_id; v_contact:=v_id;
    elsif v_item.candidate_type='event' and coalesce(v_item.proposed_data->>'recordMode','create')='link_existing' then
      select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'primaryContactItemKey' and candidate_type='contact' and status='applied';
      v_id:=(v_item.proposed_data->>'existingRecordId')::uuid;
      if private.os_complete_intake_record_fingerprint('event',v_id)<>v_item.proposed_data->>'expectedRecordHash' then raise exception 'Existing event changed after review' using errcode='40001'; end if;
      select id into v_event from public.os_events where id=v_id and status<>'archived' and primary_contact_id=v_contact;
      if v_event is null then raise exception 'Existing event or reviewed contact relationship is unavailable' using errcode='P0002'; end if;
      v_before:=jsonb_build_object('linkedExisting',true,'sourcePrecedence','preserve_existing_native');
    elsif v_item.candidate_type='event' then
      select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'primaryContactItemKey' and candidate_type='contact' and status='applied';
      if v_contact is null then raise exception 'Referenced contact is not applied' using errcode='P0002'; end if;
      insert into public.os_events(primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,settings,created_by)
      values(v_contact,btrim(v_item.proposed_data->>'title'),left(btrim(v_item.proposed_data->>'eventType'),80),v_item.proposed_data->>'status',nullif(v_item.proposed_data->>'startsAt','')::timestamptz,nullif(v_item.proposed_data->>'endsAt','')::timestamptz,coalesce(nullif(v_item.proposed_data->>'timezone',''),'America/Indiana/Indianapolis'),nullif(left(btrim(v_item.proposed_data->>'venueName'),180),''),nullif(left(btrim(v_item.proposed_data->>'venueAddress1'),200),''),nullif(left(btrim(v_item.proposed_data->>'venueAddress2'),160),''),nullif(left(btrim(v_item.proposed_data->>'venueCity'),120),''),nullif(left(btrim(v_item.proposed_data->>'venueState'),80),''),nullif(left(btrim(v_item.proposed_data->>'venuePostalCode'),24),''),nullif(v_item.proposed_data->>'guestCount','')::integer,'reviewed_intake',jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash,'recordDisposition',v_item.proposed_data->>'recordDisposition'),v_actor)
      returning id into v_id; v_event:=v_id;
    elsif v_item.candidate_type='inquiry' and coalesce(v_item.proposed_data->>'recordMode','create')='link_existing' then
      select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'contactItemKey' and candidate_type='contact' and status='applied';
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      v_id:=(v_item.proposed_data->>'existingRecordId')::uuid;
      if private.os_complete_intake_record_fingerprint('inquiry',v_id)<>v_item.proposed_data->>'expectedRecordHash' then raise exception 'Existing inquiry changed after review' using errcode='40001'; end if;
      select id into v_lead from public.os_leads where id=v_id and status<>'archived' and contact_id=v_contact and event_id=v_event;
      if v_lead is null then raise exception 'Existing inquiry or reviewed relationships are unavailable' using errcode='P0002'; end if;
      v_before:=jsonb_build_object('linkedExisting',true,'sourcePrecedence','preserve_existing_native');
    elsif v_item.candidate_type='inquiry' then
      select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'contactItemKey' and candidate_type='contact' and status='applied';
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      if v_contact is null or v_event is null then raise exception 'Referenced contact or event is not applied' using errcode='P0002'; end if;
      insert into public.os_leads(contact_id,event_id,status,source,inquiry_summary,estimated_value,next_follow_up_at,metadata)
      values(v_contact,v_event,v_item.proposed_data->>'status','reviewed_intake',nullif(left(btrim(v_item.proposed_data->>'summary'),2000),''),nullif(v_item.proposed_data->>'estimatedValue','')::numeric,nullif(v_item.proposed_data->>'nextFollowUpAt','')::timestamptz,jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash)) returning id into v_id; v_lead:=v_id;
    elsif v_item.candidate_type='booking' and coalesce(v_item.proposed_data->>'recordMode','create')='link_existing' then
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      v_id:=(v_item.proposed_data->>'existingRecordId')::uuid;
      if private.os_complete_intake_record_fingerprint('booking',v_id)<>v_item.proposed_data->>'expectedRecordHash' then raise exception 'Existing booking changed after review' using errcode='40001'; end if;
      select id into v_booking from public.os_bookings where id=v_id and status<>'cancelled' and event_id=v_event;
      if v_booking is null then raise exception 'Existing booking or reviewed event relationship is unavailable' using errcode='P0002'; end if;
      v_before:=jsonb_build_object('linkedExisting',true,'sourcePrecedence','preserve_existing_native');
    elsif v_item.candidate_type='booking' then
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      if v_event is null then raise exception 'Referenced event is not applied' using errcode='P0002'; end if;
      insert into public.os_bookings(event_id,status,booked_at,contract_status,payment_status,total_amount,deposit_amount,balance_due,balance_due_at,metadata)
      values(v_event,v_item.proposed_data->>'status',nullif(v_item.proposed_data->>'bookedAt','')::timestamptz,v_item.proposed_data->>'contractStatus','unpaid',null,null,null,nullif(v_item.proposed_data->>'balanceDueAt','')::timestamptz,jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash,'suppressAutomations',true)) returning id into v_id; v_booking:=v_id;
    elsif v_item.candidate_type='booking_service' then
      select (canonical_record_ids->>'primaryId')::uuid into v_booking from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'bookingItemKey' and candidate_type='booking' and status='applied';
      select id into v_service from public.os_service_catalog where code=v_item.proposed_data->>'serviceCode' and is_active is true;
      if v_booking is null then raise exception 'Referenced booking is not applied' using errcode='P0002'; end if;
      insert into public.os_booking_services(booking_id,service_id,service_code,service_name,status,starts_at,ends_at,location_label,configuration)
      values(v_booking,v_service,v_item.proposed_data->>'serviceCode',left(v_item.proposed_data->>'serviceName',160),v_item.proposed_data->>'status',nullif(v_item.proposed_data->>'startsAt','')::timestamptz,nullif(v_item.proposed_data->>'endsAt','')::timestamptz,nullif(left(v_item.proposed_data->>'locationLabel',180),''),jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash,'quantity',coalesce(nullif(v_item.proposed_data->>'quantity','')::numeric,1),'unitPrice',nullif(v_item.proposed_data->>'unitPrice','')::numeric,'lineTotal',nullif(v_item.proposed_data->>'lineTotal','')::numeric)) returning id into v_id;
    elsif v_item.candidate_type='payment_fact' then
      select (canonical_record_ids->>'primaryId')::uuid into v_booking from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'bookingItemKey' and candidate_type='booking' and status='applied';
      select coalesce((result->'before'->>'linkedExisting')::boolean,false) into v_booking_linked from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'bookingItemKey' and candidate_type='booking' and status='applied';
      select jsonb_build_object('paymentStatus',payment_status,'totalAmount',total_amount,'depositAmount',deposit_amount,'balanceDue',balance_due,'updatedAt',updated_at) into v_before from public.os_bookings where id=v_booking for update;
      if v_booking is null or v_before is null then raise exception 'Referenced booking is not applied' using errcode='P0002'; end if;
      v_before:=v_before||jsonb_build_object('bookingLinkedExisting',v_booking_linked);
      insert into public.os_booking_payment_facts(booking_id,import_batch_item_id,gross_client_amount,platform_fee_amount,net_payout_amount,payment_method,payment_status,payout_status,currency,source_ref,source_hash,created_by)
      values(v_booking,v_item.id,nullif(v_item.proposed_data->>'grossClientAmount','')::numeric,nullif(v_item.proposed_data->>'platformFeeAmount','')::numeric,nullif(v_item.proposed_data->>'netPayoutAmount','')::numeric,v_item.proposed_data->>'paymentMethod',v_item.proposed_data->>'paymentStatus',v_item.proposed_data->>'payoutStatus',coalesce(nullif(v_item.proposed_data->>'currency',''),'USD'),v_item.source_ref,v_item.source_hash,v_actor) returning id into v_id;
      if not v_booking_linked then
        update public.os_bookings set payment_status=v_item.proposed_data->>'paymentStatus',total_amount=nullif(v_item.proposed_data->>'grossClientAmount','')::numeric,deposit_amount=coalesce(nullif(v_item.proposed_data->>'depositAmount','')::numeric,deposit_amount),balance_due=coalesce(nullif(v_item.proposed_data->>'balanceDue','')::numeric,balance_due),updated_at=now() where id=v_booking;
      end if;
    elsif v_item.candidate_type='staff_assignment' then
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      if v_event is null or not exists(select 1 from public.os_team_members where id=(v_item.proposed_data->>'teamMemberId')::uuid and status='active') then raise exception 'Referenced event or team member is not available' using errcode='P0002'; end if;
      insert into public.os_staff_assignments(event_id,team_member_id,assignment_role,call_time,status,created_by_user_id,updated_by_user_id)
      values(v_event,(v_item.proposed_data->>'teamMemberId')::uuid,v_item.proposed_data->>'assignmentRole',nullif(v_item.proposed_data->>'callTime','')::timestamptz,'assigned',v_actor,v_actor) returning id into v_id;
    elsif v_item.candidate_type='operational_note' then
      select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and candidate_type='event' and status='applied';
      if v_event is null then raise exception 'Referenced event is not applied' using errcode='P0002'; end if;
      insert into public.os_event_notes(event_id,author_user_id,note_type,body,visibility,status)
      values(v_event,v_actor,case when v_item.proposed_data->>'noteType' in ('general','client','venue','planning','payment','contract','staff','event_day') then v_item.proposed_data->>'noteType' else 'general' end,left(btrim(v_item.proposed_data->>'body'),4000),'staff','active') returning id into v_id;
    elsif v_item.candidate_type='source_provenance' then
      select candidate_type,(canonical_record_ids->>'primaryId')::uuid into v_target_type,v_id from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'targetItemKey' and status='applied';
      if v_id is null or v_target_type not in ('contact','inquiry','event','booking') then raise exception 'Provenance target is not a canonical parent record' using errcode='P0002'; end if;
      insert into public.os_import_source_provenance(batch_id,import_batch_item_id,contact_id,lead_id,event_id,booking_id,source_ref,source_hash,evidence_kind,confidence,created_by)
      values(p_batch_id,v_item.id,case when v_target_type='contact' then v_id end,case when v_target_type='inquiry' then v_id end,case when v_target_type='event' then v_id end,case when v_target_type='booking' then v_id end,v_item.source_ref,v_item.source_hash,v_item.proposed_data->>'evidenceKind',v_item.proposed_data->>'confidence',v_actor) returning id into v_id;
    end if;
    if v_id is null then raise exception 'Canonical item was not applied' using errcode='P0002'; end if;
    update public.os_import_batch_items set status='applied',canonical_record_ids=jsonb_build_object('primaryId',v_id),result=jsonb_strip_nulls(jsonb_build_object('before',v_before,'eventId',v_event,'contactId',v_contact,'leadId',v_lead,'bookingId',v_booking)),applied_by=v_actor,applied_at=now(),updated_at=now() where id=v_item.id;
    insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_event,v_contact,v_actor,'data_readiness.complete_import_item_applied','staff',jsonb_build_object('batchId',p_batch_id,'itemKey',v_item.item_key,'candidateType',v_item.candidate_type),'complete_intake:'||p_batch_id::text||':'||v_item.item_key) on conflict do nothing;
    v_applied:=v_applied+1;
  end loop;

  -- The temporary marker suppresses only creation-time automation. Remove it
  -- before commit so all future booking lifecycle transitions behave normally.
  update public.os_bookings set metadata=metadata-'suppressAutomations',updated_at=now() where metadata->>'importBatchId'=p_batch_id::text and metadata->>'suppressAutomations'='true';
  update public.os_import_batches set status='completed',created_count=v_applied,skipped_count=0,error_count=0,summary=summary||jsonb_build_object('completedAt',now(),'atomic',true),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status','completed','batchId',p_batch_id,'applied',v_applied,'recordCount',p_record_count);
end;
$$;

create or replace function public.os_rollback_complete_intake_batch(
  p_batch_id uuid, p_manifest_hash text, p_record_count integer, p_item_counts jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_batch public.os_import_batches%rowtype; v_item record; v_id uuid; v_booking uuid; v_count integer:=0;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  select * into v_batch from public.os_import_batches where id=p_batch_id for update;
  if not found or v_batch.contract_version<>'intake_manifest_v2' or v_batch.manifest_hash<>lower(p_manifest_hash)
    or (v_batch.summary->>'recordCount')::integer<>p_record_count or v_batch.summary->'itemCounts' is distinct from p_item_counts then raise exception 'Batch hash, version, or counts do not match' using errcode='22023'; end if;
  if v_batch.status='cancelled' and v_batch.rollback_at is not null then return jsonb_build_object('status','replayed','batchId',p_batch_id,'rolledBack',v_batch.created_count); end if;
  if v_batch.status<>'completed' then raise exception 'Only a completed atomic batch can be rolled back' using errcode='40001'; end if;
  for v_item in select * from public.os_import_batch_items where batch_id=p_batch_id and status='applied' order by applied_at desc,id desc loop
    v_id:=(v_item.canonical_record_ids->>'primaryId')::uuid;
    if coalesce((v_item.result->'before'->>'linkedExisting')::boolean,false) then null;
    elsif v_item.candidate_type='contact' then update public.os_contacts set status='archived',updated_at=now() where id=v_id and metadata->>'importBatchId'=p_batch_id::text;
    elsif v_item.candidate_type='event' then update public.os_events set status='archived',updated_at=now() where id=v_id and settings->>'importBatchId'=p_batch_id::text;
    elsif v_item.candidate_type='inquiry' then update public.os_leads set status='archived',updated_at=now() where id=v_id and metadata->>'importBatchId'=p_batch_id::text;
    elsif v_item.candidate_type='booking' then update public.os_bookings set status='cancelled',updated_at=now() where id=v_id and metadata->>'importBatchId'=p_batch_id::text;
    elsif v_item.candidate_type='booking_service' then update public.os_booking_services set status='cancelled',updated_at=now() where id=v_id and configuration->>'importBatchId'=p_batch_id::text;
    elsif v_item.candidate_type='payment_fact' then
      select booking_id into v_booking from public.os_booking_payment_facts where id=v_id and import_batch_item_id=v_item.id;
      update public.os_booking_payment_facts set status='archived',updated_at=now() where id=v_id;
      if not coalesce((v_item.result->'before'->>'bookingLinkedExisting')::boolean,false) then
        update public.os_bookings set payment_status=v_item.result->'before'->>'paymentStatus',total_amount=(v_item.result->'before'->>'totalAmount')::numeric,deposit_amount=(v_item.result->'before'->>'depositAmount')::numeric,balance_due=(v_item.result->'before'->>'balanceDue')::numeric,updated_at=(v_item.result->'before'->>'updatedAt')::timestamptz where id=v_booking;
      end if;
    elsif v_item.candidate_type='staff_assignment' then update public.os_staff_assignments set status='cancelled',updated_by_user_id=v_actor,updated_at=now() where id=v_id;
    elsif v_item.candidate_type='operational_note' then update public.os_event_notes set status='archived',updated_at=now() where id=v_id;
    end if;
    update public.os_import_batch_items set status='rolled_back',updated_at=now() where id=v_item.id;
    v_count:=v_count+1;
  end loop;
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
  values(v_actor,'data_readiness.complete_import_batch_rolled_back','staff',jsonb_build_object('batchId',p_batch_id,'itemCount',v_count),'complete_intake:'||p_batch_id::text||':rolled_back') on conflict do nothing;
  update public.os_import_batches set status='cancelled',rollback_at=now(),rollback_by=v_actor,summary=summary||jsonb_build_object('rolledBackAt',now(),'rolledBackCount',v_count),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status','rolled_back','batchId',p_batch_id,'itemCount',v_count);
end;
$$;

revoke all on function public.os_stage_complete_intake_manifest(text,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.os_approve_complete_intake_batch(uuid,text,integer,jsonb,text[]) from public, anon, authenticated;
revoke all on function public.os_apply_complete_intake_batch(uuid,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.os_rollback_complete_intake_batch(uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.os_stage_complete_intake_manifest(text,text,integer,jsonb) to authenticated, service_role;
grant execute on function public.os_approve_complete_intake_batch(uuid,text,integer,jsonb,text[]) to authenticated, service_role;
grant execute on function public.os_apply_complete_intake_batch(uuid,text,integer,jsonb) to authenticated, service_role;
grant execute on function public.os_rollback_complete_intake_batch(uuid,text,integer,jsonb) to authenticated, service_role;

create or replace function public.os_data_readiness_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  return jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc,c.id) from (select id,display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,status,notes,source,updated_at from public.os_contacts order by updated_at desc,id limit 200) c),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.updated_at desc,e.id) from (select id,primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,updated_at from public.os_events order by updated_at desc,id limit 200) e),'[]'::jsonb),
    'leads',coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc,l.id) from (select id,contact_id,event_id,status,source,next_follow_up_at,updated_at from public.os_leads order by updated_at desc,id limit 200) l),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from (select id,code,name,'active'::text as status from public.os_service_catalog where is_active is true order by name,id) s),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select id,status,row_count,created_count,skipped_count,error_count,contract_version,manifest_hash,source_label,summary,created_at,approved_at,rollback_at from public.os_import_batches where contract_version in ('intake_manifest_v1','intake_manifest_v2') order by created_at desc limit 30) b),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from (select id,batch_id,item_key,candidate_type,source_ref,source_hash,uncertain_fields,duplicate_warnings,status,canonical_record_ids,error_code,created_at,applied_at from public.os_import_batch_items order by created_at desc limit 1000) i),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc,a.id) from (select id,event_id,contact_id,event_type,occurred_at from public.os_activity_events where event_type like 'data_readiness.%' order by occurred_at desc,id limit 100) a),'[]'::jsonb)
  );
end;
$$;

-- Rollback: revoke/drop the four v2 RPCs and private helpers; restore both
-- booking triggers without their WHEN predicates; drop the v2-only indexes,
-- tables, and item-type constraint; then restore the v1 item-type constraint.
-- Never remove import/activity history or canonical business records as an
-- emergency rollback.
