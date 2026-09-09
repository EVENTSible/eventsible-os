-- EVENTSible HQ Data Readiness: Owner-only correction and reviewed batch intake.
-- Canonical business records remain in their existing tables. No backfill or deletes.

create or replace function public.os_has_hq_capability(p_capability text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case public.os_staff_role()
    when 'owner' then p_capability = any (array[
      'hq.read', 'lead.lifecycle.manage', 'quote.approve', 'gig.convert',
      'client.activate', 'import.candidate.create', 'import.review',
      'import.finalize', 'event.operations.write', 'event.notes.write',
      'task.write', 'catalog.manage', 'planning.structure.manage',
      'data.delete', 'staff.manage', 'system.manage', 'data.readiness.manage',
      'schedule.read', 'schedule.self.manage', 'schedule.team.manage',
      'schedule.assignments.manage'
    ]::text[])
    when 'manager' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write', 'event.notes.write',
      'task.write', 'schedule.read', 'schedule.self.manage'
    ]::text[])
    when 'staff' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write', 'event.notes.write',
      'task.write', 'schedule.read', 'schedule.self.manage'
    ]::text[])
    when 'host' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write', 'event.notes.write',
      'task.write', 'schedule.read', 'schedule.self.manage'
    ]::text[])
    else false
  end;
$$;

alter table public.os_import_batches
  add column if not exists contract_version text,
  add column if not exists manifest_hash text,
  add column if not exists source_label text,
  add column if not exists approved_manifest_hash text,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rollback_at timestamptz,
  add column if not exists rollback_by uuid references auth.users(id) on delete set null;

create unique index if not exists os_import_batches_manifest_hash_idx
  on public.os_import_batches(manifest_hash)
  where manifest_hash is not null;
create index if not exists os_import_batches_approved_by_idx
  on public.os_import_batches(approved_by)
  where approved_by is not null;
create index if not exists os_import_batches_rollback_by_idx
  on public.os_import_batches(rollback_by)
  where rollback_by is not null;

create table if not exists public.os_import_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.os_import_batches(id) on delete restrict,
  item_key text not null,
  candidate_type text not null,
  source_ref text,
  source_hash text not null,
  proposed_data jsonb not null,
  uncertain_fields jsonb not null default '[]'::jsonb,
  duplicate_warnings jsonb not null default '[]'::jsonb,
  status text not null default 'previewed',
  canonical_record_ids jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_import_batch_items_key_chk check (item_key ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'),
  constraint os_import_batch_items_type_chk check (candidate_type in ('contact','inquiry','event','staff_assignment','payment_fact','operational_note','calendar_fact')),
  constraint os_import_batch_items_hash_chk check (source_hash ~ '^[a-f0-9]{64}$'),
  constraint os_import_batch_items_source_ref_chk check (source_ref is null or char_length(source_ref) <= 240),
  constraint os_import_batch_items_payload_chk check (octet_length(proposed_data::text) <= 32768),
  constraint os_import_batch_items_uncertain_chk check (jsonb_typeof(uncertain_fields) = 'array' and jsonb_array_length(uncertain_fields) <= 30),
  constraint os_import_batch_items_status_chk check (status in ('previewed','approved','applying','applied','failed','rolled_back','rollback_required','excluded')),
  unique(batch_id, item_key)
);

create index if not exists os_import_batch_items_batch_status_idx
  on public.os_import_batch_items(batch_id, status, created_at);
create index if not exists os_import_batch_items_source_hash_idx
  on public.os_import_batch_items(source_hash);
create index if not exists os_import_batch_items_approved_by_idx
  on public.os_import_batch_items(approved_by)
  where approved_by is not null;
create index if not exists os_import_batch_items_applied_by_idx
  on public.os_import_batch_items(applied_by)
  where applied_by is not null;

alter table public.os_import_batch_items enable row level security;
revoke all on table public.os_import_batch_items from public, anon, authenticated;
grant all on table public.os_import_batch_items to service_role;

create or replace function public.os_data_readiness_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  return jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc,c.id) from (select id,display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,status,notes,source,updated_at from public.os_contacts order by updated_at desc,id limit 200) c),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.updated_at desc,e.id) from (select id,primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,updated_at from public.os_events order by updated_at desc,id limit 200) e),'[]'::jsonb),
    'leads',coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc,l.id) from (select id,contact_id,event_id,status,source,next_follow_up_at,updated_at from public.os_leads order by updated_at desc,id limit 200) l),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from (select id,code,name,status from public.os_service_catalog where status='active' order by name,id) s),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select id,status,row_count,created_count,skipped_count,error_count,contract_version,manifest_hash,source_label,created_at,approved_at,rollback_at from public.os_import_batches where contract_version='intake_manifest_v1' order by created_at desc limit 30) b),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from (select id,batch_id,item_key,candidate_type,source_ref,source_hash,uncertain_fields,duplicate_warnings,status,canonical_record_ids,error_code,created_at,applied_at from public.os_import_batch_items order by created_at desc limit 1000) i),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc,a.id) from (select id,event_id,contact_id,event_type,occurred_at from public.os_activity_events where event_type like 'data_readiness.%' order by occurred_at desc,id limit 100) a),'[]'::jsonb)
  );
end;
$$;

create or replace function public.os_manage_contact(
  p_action text,
  p_contact_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := p_contact_id;
  v_email text := nullif(lower(btrim(p_payload->>'primaryEmail')), '');
  v_phone text := nullif(btrim(p_payload->>'primaryPhone'), '');
  v_duplicate jsonb := '[]'::jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_action not in ('create','update','archive','restore') then raise exception 'Unsupported contact action' using errcode='22023'; end if;
  if p_action in ('create','update') then
    if char_length(btrim(coalesce(p_payload->>'displayName',''))) not between 1 and 160 then raise exception 'Invalid contact name' using errcode='22023'; end if;
    if v_email is null and v_phone is null then raise exception 'Email or phone required' using errcode='22023'; end if;
    if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Invalid email' using errcode='22023'; end if;
    if v_phone is not null and char_length(v_phone) > 40 then raise exception 'Invalid phone' using errcode='22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'recordId', id)), '[]'::jsonb) into v_duplicate
    from (
      select id, 'exact_email'::text kind from public.os_contacts where v_email is not null and lower(primary_email)=v_email and id is distinct from v_id
      union all
      select id, 'exact_phone'::text from public.os_contacts where v_phone is not null and regexp_replace(primary_phone,'\D','','g')=regexp_replace(v_phone,'\D','','g') and id is distinct from v_id
    ) d;
  end if;
  if p_action='create' then
    insert into public.os_contacts(display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,source,status,notes,created_by)
    values(btrim(p_payload->>'displayName'),nullif(btrim(p_payload->>'firstName'),''),nullif(btrim(p_payload->>'lastName'),''),nullif(btrim(p_payload->>'organizationName'),''),v_email,v_phone,
      case when p_payload->>'preferredChannel' in ('email','text','phone','portal') then p_payload->>'preferredChannel' else 'email' end,
      'hq_manual','active',nullif(btrim(p_payload->>'notes'),''),v_actor) returning id into v_id;
  elsif p_action='update' then
    update public.os_contacts set display_name=btrim(p_payload->>'displayName'),first_name=nullif(btrim(p_payload->>'firstName'),''),last_name=nullif(btrim(p_payload->>'lastName'),''),organization_name=nullif(btrim(p_payload->>'organizationName'),''),primary_email=v_email,primary_phone=v_phone,
      preferred_channel=case when p_payload->>'preferredChannel' in ('email','text','phone','portal') then p_payload->>'preferredChannel' else preferred_channel end,
      notes=nullif(btrim(p_payload->>'notes'),''),updated_at=now() where id=v_id;
  elsif p_action='archive' then update public.os_contacts set status='archived',updated_at=now() where id=v_id;
  else update public.os_contacts set status='active',updated_at=now() where id=v_id; end if;
  if not found then raise exception 'Contact not found' using errcode='P0002'; end if;
  insert into public.os_activity_events(contact_id,actor_user_id,event_type,visibility,payload)
  values(v_id,v_actor,'data_readiness.contact_'||p_action,'staff',jsonb_build_object('source','hq_data_readiness','duplicateWarningCount',jsonb_array_length(v_duplicate)));
  return jsonb_build_object('status',p_action,'contactId',v_id,'duplicateWarnings',v_duplicate);
end;
$$;

create or replace function public.os_manage_event(
  p_action text,
  p_event_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_service_ids uuid[] := array[]::uuid[];
  v_booking_id uuid;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_action not in ('update','archive','restore') or p_event_id is null then raise exception 'Unsupported event action' using errcode='22023'; end if;
  if p_action='update' then
    if char_length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 180 then raise exception 'Invalid event title' using errcode='22023'; end if;
    if p_payload->>'status' not in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed','cancelled','archived') then raise exception 'Invalid event status' using errcode='22023'; end if;
    if nullif(p_payload->>'startsAt','') is not null and nullif(p_payload->>'endsAt','') is not null and (p_payload->>'endsAt')::timestamptz <= (p_payload->>'startsAt')::timestamptz then raise exception 'End must follow start' using errcode='22023'; end if;
    update public.os_events set
      title=btrim(p_payload->>'title'), event_type=left(btrim(coalesce(p_payload->>'eventType',event_type)),80), status=p_payload->>'status',
      starts_at=nullif(p_payload->>'startsAt','')::timestamptz, ends_at=nullif(p_payload->>'endsAt','')::timestamptz,
      timezone=left(coalesce(nullif(btrim(p_payload->>'timezone'),''),timezone),100), venue_name=nullif(left(btrim(p_payload->>'venueName'),180),''),
      venue_address_1=nullif(left(btrim(p_payload->>'venueAddress1'),200),''), venue_address_2=nullif(left(btrim(p_payload->>'venueAddress2'),160),''),
      venue_city=nullif(left(btrim(p_payload->>'venueCity'),120),''), venue_state=nullif(left(btrim(p_payload->>'venueState'),80),''),
      venue_postal_code=nullif(left(btrim(p_payload->>'venuePostalCode'),24),''),
      guest_count=case when nullif(p_payload->>'guestCount','') is null then null else (p_payload->>'guestCount')::integer end, updated_at=now()
    where id=p_event_id;
    if not found then raise exception 'Event not found' using errcode='P0002'; end if;
    if jsonb_typeof(p_payload->'serviceIds')='array' then
      select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_service_ids from jsonb_array_elements_text(p_payload->'serviceIds');
      select id into v_booking_id from public.os_bookings where event_id=p_event_id order by created_at desc limit 1;
      if v_booking_id is not null then
        update public.os_booking_services set status='cancelled',updated_at=now() where booking_id=v_booking_id and service_id is not null and not(service_id=any(v_service_ids));
        update public.os_booking_services set status='booked',updated_at=now() where booking_id=v_booking_id and service_id=any(v_service_ids);
        insert into public.os_booking_services(booking_id,service_id,service_code,service_name,status)
        select v_booking_id,s.id,s.code,s.name,'booked' from public.os_service_catalog s
        where s.id=any(v_service_ids) and not exists(select 1 from public.os_booking_services bs where bs.booking_id=v_booking_id and bs.service_id=s.id);
      end if;
    end if;
  elsif p_action='archive' then update public.os_events set status='archived',updated_at=now() where id=p_event_id;
  else update public.os_events set status=case when status='archived' then 'inquiry' else status end,updated_at=now() where id=p_event_id; end if;
  if not found then raise exception 'Event not found' using errcode='P0002'; end if;
  insert into public.os_activity_events(event_id,actor_user_id,event_type,visibility,payload)
  values(p_event_id,v_actor,'data_readiness.event_'||p_action,'staff',jsonb_build_object('source','hq_data_readiness'));
  return jsonb_build_object('status',p_action,'eventId',p_event_id);
end;
$$;

create or replace function public.os_manage_lead(
  p_action text,
  p_lead_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_event uuid; v_contact uuid;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_action not in ('update','archive','restore') or p_lead_id is null then raise exception 'Unsupported lead action' using errcode='22023'; end if;
  if p_action='update' then
    if p_payload->>'status' not in ('new','qualifying','quoted','follow_up','won','lost','archived') then raise exception 'Invalid lead status' using errcode='22023'; end if;
    update public.os_leads set status=p_payload->>'status',next_follow_up_at=nullif(p_payload->>'nextFollowUpAt','')::timestamptz,updated_at=now() where id=p_lead_id returning event_id,contact_id into v_event,v_contact;
  elsif p_action='archive' then update public.os_leads set status='archived',updated_at=now() where id=p_lead_id returning event_id,contact_id into v_event,v_contact;
  else update public.os_leads set status=case when status='archived' then 'new' else status end,updated_at=now() where id=p_lead_id returning event_id,contact_id into v_event,v_contact; end if;
  if not found then raise exception 'Lead not found' using errcode='P0002'; end if;
  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload)
  values(v_event,v_contact,v_actor,'data_readiness.lead_'||p_action,'staff',jsonb_build_object('source','hq_data_readiness'));
  return jsonb_build_object('status',p_action,'leadId',p_lead_id);
end;
$$;

create or replace function public.os_stage_intake_manifest(p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_hash text; v_batch uuid; v_item jsonb; v_keys text[]:=array[]::text[]; v_required text[]; v_field text; v_warnings jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if jsonb_typeof(p_manifest)<>'object' or p_manifest->>'contractVersion'<>'intake_manifest_v1' or char_length(btrim(coalesce(p_manifest->>'sourceLabel',''))) not between 1 and 120 or jsonb_typeof(p_manifest->'items')<>'array' or jsonb_array_length(p_manifest->'items') not between 1 and 250 or octet_length(p_manifest::text)>524288 then raise exception 'Invalid intake manifest' using errcode='22023'; end if;
  v_hash:=encode(extensions.digest(convert_to(p_manifest::text,'UTF8'),'sha256'),'hex');
  select id into v_batch from public.os_import_batches where manifest_hash=v_hash;
  if v_batch is not null then return jsonb_build_object('status','replayed','batchId',v_batch,'manifestHash',v_hash); end if;
  for v_item in select value from jsonb_array_elements(p_manifest->'items') loop
    if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'key','') !~ '^[a-z0-9][a-z0-9._:-]{0,119}$' or v_item->>'type' not in ('contact','inquiry','event','staff_assignment','payment_fact','operational_note','calendar_fact') or jsonb_typeof(v_item->'data')<>'object' or coalesce(v_item->>'sourceHash','') !~ '^[a-f0-9]{64}$' or octet_length((v_item->'data')::text)>32768 then raise exception 'Invalid intake item' using errcode='22023'; end if;
    if v_item->>'key'=any(v_keys) then raise exception 'Duplicate intake item key' using errcode='22023'; end if;
    v_keys:=array_append(v_keys,v_item->>'key');
    v_required:=case v_item->>'type' when 'contact' then array['displayName'] when 'inquiry' then array['status'] when 'event' then array['title','eventType'] when 'staff_assignment' then array['eventId','teamMemberId','assignmentRole'] when 'payment_fact' then array['bookingId','paymentStatus'] when 'operational_note' then array['eventId','body'] when 'calendar_fact' then array['teamMemberId','entryType'] end;
    foreach v_field in array v_required loop
      if nullif(v_item->'data'->>v_field,'') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? v_field then raise exception 'Required intake value is missing or uncertain' using errcode='22023'; end if;
    end loop;
    if v_item->>'type'='contact' and ((nullif(v_item->'data'->>'primaryEmail','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'primaryEmail') and (nullif(v_item->'data'->>'primaryPhone','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'primaryPhone')) then raise exception 'Certain contact email or phone required' using errcode='22023'; end if;
    if v_item->>'type'='event' and ((nullif(v_item->'data'->>'primaryContactId','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'primaryContactId') and (nullif(v_item->'data'->>'primaryContactItemKey','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'primaryContactItemKey')) then raise exception 'Certain event contact reference required' using errcode='22023'; end if;
    if v_item->>'type'='inquiry' and (((nullif(v_item->'data'->>'contactId','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'contactId') and (nullif(v_item->'data'->>'contactItemKey','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'contactItemKey')) or ((nullif(v_item->'data'->>'eventId','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'eventId') and (nullif(v_item->'data'->>'eventItemKey','') is null or coalesce(v_item->'uncertainFields','[]'::jsonb) ? 'eventItemKey'))) then raise exception 'Certain inquiry contact and event references required' using errcode='22023'; end if;
    if v_item->>'type'='inquiry' and v_item->'data'->>'status' not in ('new','qualifying','quoted','follow_up','won','lost','archived') then raise exception 'Invalid inquiry status' using errcode='22023'; end if;
    if v_item->>'type'='event' and nullif(v_item->'data'->>'status','') is not null and v_item->'data'->>'status' not in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed','cancelled','archived') then raise exception 'Invalid event status' using errcode='22023'; end if;
    if v_item->>'type'='staff_assignment' and v_item->'data'->>'assignmentRole' not in ('dj','mc','vocalist','assistant','activity_helper','operator','other') then raise exception 'Invalid assignment role' using errcode='22023'; end if;
    if v_item->>'type'='payment_fact' and v_item->'data'->>'paymentStatus' not in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded') then raise exception 'Invalid payment status' using errcode='22023'; end if;
    if v_item->>'type'='calendar_fact' and v_item->'data'->>'entryType' not in ('available','unavailable','outside_booking','vacation','reminder','note') then raise exception 'Invalid calendar entry type' using errcode='22023'; end if;
  end loop;
  insert into public.os_import_batches(import_type,file_name,status,row_count,created_count,skipped_count,error_count,summary,created_by,contract_version,manifest_hash,source_label)
  values('manual_backfill',null,'previewed',jsonb_array_length(p_manifest->'items'),0,0,0,jsonb_build_object('contractVersion','intake_manifest_v1'),v_actor,'intake_manifest_v1',v_hash,btrim(p_manifest->>'sourceLabel')) returning id into v_batch;
  for v_item in select value from jsonb_array_elements(p_manifest->'items') loop
    v_warnings:='[]'::jsonb;
    if v_item->>'type'='contact' then
      select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'recordId',id)),'[]'::jsonb) into v_warnings from (
        select id,'exact_source_hash'::text kind from public.os_contacts where metadata->>'sourceHash'=v_item->>'sourceHash'
        union all select id,'exact_email'::text from public.os_contacts where nullif(lower(v_item->'data'->>'primaryEmail'),'') is not null and lower(primary_email)=lower(v_item->'data'->>'primaryEmail')
        union all select id,'exact_phone' from public.os_contacts where nullif(regexp_replace(v_item->'data'->>'primaryPhone','\D','','g'),'') is not null and regexp_replace(primary_phone,'\D','','g')=regexp_replace(v_item->'data'->>'primaryPhone','\D','','g')
      ) d;
    elsif v_item->>'type'='event' then
      select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'recordId',id)),'[]'::jsonb) into v_warnings from (
        select id,'exact_source_hash'::text kind from public.os_events where settings->>'sourceHash'=v_item->>'sourceHash'
        union all select id,'same_title_and_start'::text from public.os_events where lower(title)=lower(v_item->'data'->>'title') and starts_at is not distinct from nullif(v_item->'data'->>'startsAt','')::timestamptz
      ) d;
    elsif v_item->>'type'='inquiry' then
      select coalesce(jsonb_agg(jsonb_build_object('kind','exact_source_hash','recordId',id)),'[]'::jsonb) into v_warnings from public.os_leads where metadata->>'sourceHash'=v_item->>'sourceHash';
    end if;
    insert into public.os_import_batch_items(batch_id,item_key,candidate_type,source_ref,source_hash,proposed_data,uncertain_fields,duplicate_warnings)
    values(v_batch,v_item->>'key',v_item->>'type',nullif(left(v_item->>'sourceRef',240),''),v_item->>'sourceHash',v_item->'data',coalesce(v_item->'uncertainFields','[]'::jsonb),v_warnings);
  end loop;
  return jsonb_build_object('status','previewed','batchId',v_batch,'manifestHash',v_hash,'itemCount',array_length(v_keys,1));
end; $$;

create or replace function public.os_approve_intake_batch(p_batch_id uuid,p_manifest_hash text,p_item_keys text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_count integer;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_manifest_hash !~ '^[a-f0-9]{64}$' or coalesce(array_length(p_item_keys,1),0)<1 then raise exception 'Invalid approval' using errcode='22023'; end if;
  update public.os_import_batches set status='importing',approved_manifest_hash=p_manifest_hash,approved_by=v_actor,approved_at=now(),updated_at=now() where id=p_batch_id and manifest_hash=p_manifest_hash and contract_version='intake_manifest_v1' and status in ('previewed','partial','importing');
  if not found then raise exception 'Batch/hash mismatch' using errcode='P0002'; end if;
  update public.os_import_batch_items set status=case when item_key=any(p_item_keys) then 'approved' else 'excluded' end,approved_by=case when item_key=any(p_item_keys) then v_actor else approved_by end,approved_at=case when item_key=any(p_item_keys) then now() else approved_at end,error_code=null,updated_at=now() where batch_id=p_batch_id and status in ('previewed','approved','failed','excluded');
  select count(*) into v_count from public.os_import_batch_items where batch_id=p_batch_id and status='approved';
  if v_count<>cardinality(p_item_keys) then raise exception 'Approved item set mismatch' using errcode='22023'; end if;
  return jsonb_build_object('status','approved','batchId',p_batch_id,'approvedCount',v_count);
end; $$;

create or replace function public.os_apply_intake_batch(p_batch_id uuid,p_manifest_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_item record; v_id uuid; v_event uuid; v_contact uuid; v_before jsonb; v_created integer:=0; v_errors integer:=0; v_skipped integer:=0;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  perform 1 from public.os_import_batches where id=p_batch_id and manifest_hash=p_manifest_hash and approved_manifest_hash=p_manifest_hash and contract_version='intake_manifest_v1' and status='importing' for update;
  if not found then raise exception 'Approved batch/hash mismatch' using errcode='P0002'; end if;
  for v_item in
    select *
    from public.os_import_batch_items
    where batch_id=p_batch_id and status='approved'
    order by
      case candidate_type when 'contact' then 1 when 'event' then 2 when 'inquiry' then 3 else 4 end,
      created_at,
      id
  loop
    begin
      v_id:=null; v_event:=null; v_contact:=null; v_before:=null;
      update public.os_import_batch_items set status='applying',updated_at=now() where id=v_item.id;
      if v_item.candidate_type='contact' then
        insert into public.os_contacts(display_name,primary_email,primary_phone,preferred_channel,source,status,notes,created_by,metadata)
        values(btrim(v_item.proposed_data->>'displayName'),nullif(lower(btrim(v_item.proposed_data->>'primaryEmail')),''),nullif(btrim(v_item.proposed_data->>'primaryPhone'),''),'email','reviewed_intake','active',nullif(btrim(v_item.proposed_data->>'notes'),''),v_actor,jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash)) returning id into v_id;
        v_contact:=v_id;
      elsif v_item.candidate_type='event' then
        v_contact:=nullif(v_item.proposed_data->>'primaryContactId','')::uuid;
        if v_contact is null and nullif(v_item.proposed_data->>'primaryContactItemKey','') is not null then select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'primaryContactItemKey' and status='applied'; end if;
        if v_contact is null then raise exception 'Referenced contact is not applied' using errcode='P0002'; end if;
        insert into public.os_events(primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_city,venue_state,guest_count,source,created_by,settings)
        values(v_contact,btrim(v_item.proposed_data->>'title'),left(btrim(v_item.proposed_data->>'eventType'),80),coalesce(nullif(v_item.proposed_data->>'status',''),'inquiry'),nullif(v_item.proposed_data->>'startsAt','')::timestamptz,nullif(v_item.proposed_data->>'endsAt','')::timestamptz,coalesce(nullif(v_item.proposed_data->>'timezone',''),'America/Indiana/Indianapolis'),nullif(left(btrim(v_item.proposed_data->>'venueName'),180),''),nullif(left(btrim(v_item.proposed_data->>'venueCity'),120),''),nullif(left(btrim(v_item.proposed_data->>'venueState'),80),''),nullif(v_item.proposed_data->>'guestCount','')::integer,'reviewed_intake',v_actor,jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash)) returning id into v_id;
        v_event:=v_id;
      elsif v_item.candidate_type='inquiry' then
        v_contact:=nullif(v_item.proposed_data->>'contactId','')::uuid;
        v_event:=nullif(v_item.proposed_data->>'eventId','')::uuid;
        if v_contact is null and nullif(v_item.proposed_data->>'contactItemKey','') is not null then select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'contactItemKey' and status='applied'; end if;
        if v_event is null and nullif(v_item.proposed_data->>'eventItemKey','') is not null then select (canonical_record_ids->>'primaryId')::uuid into v_event from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'eventItemKey' and status='applied'; end if;
        if v_contact is null or v_event is null then raise exception 'Referenced contact or event is not applied' using errcode='P0002'; end if;
        insert into public.os_leads(contact_id,event_id,status,source,inquiry_summary,next_follow_up_at,metadata)
        values(v_contact,v_event,v_item.proposed_data->>'status','reviewed_intake',nullif(left(btrim(v_item.proposed_data->>'summary'),2000),''),nullif(v_item.proposed_data->>'nextFollowUpAt','')::timestamptz,jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash)) returning id into v_id;
      elsif v_item.candidate_type='staff_assignment' then
        insert into public.os_staff_assignments(event_id,team_member_id,assignment_role,call_time,status,created_by_user_id,updated_by_user_id)
        values((v_item.proposed_data->>'eventId')::uuid,(v_item.proposed_data->>'teamMemberId')::uuid,v_item.proposed_data->>'assignmentRole',nullif(v_item.proposed_data->>'callTime','')::timestamptz,'assigned',v_actor,v_actor) returning id into v_id;
      elsif v_item.candidate_type='payment_fact' then
        select jsonb_build_object('paymentStatus',payment_status,'totalAmount',total_amount,'depositAmount',deposit_amount,'balanceDue',balance_due) into v_before from public.os_bookings where id=(v_item.proposed_data->>'bookingId')::uuid for update;
        if not found then raise exception 'Booking not found' using errcode='P0002'; end if;
        update public.os_bookings set payment_status=v_item.proposed_data->>'paymentStatus',total_amount=coalesce(nullif(v_item.proposed_data->>'totalAmount','')::numeric,total_amount),deposit_amount=coalesce(nullif(v_item.proposed_data->>'depositAmount','')::numeric,deposit_amount),balance_due=coalesce(nullif(v_item.proposed_data->>'balanceDue','')::numeric,balance_due),updated_at=now() where id=(v_item.proposed_data->>'bookingId')::uuid returning id,event_id into v_id,v_event;
      elsif v_item.candidate_type='operational_note' then
        insert into public.os_event_notes(event_id,author_user_id,note_type,body,visibility,status)
        values((v_item.proposed_data->>'eventId')::uuid,v_actor,case when v_item.proposed_data->>'noteType' in ('general','client','venue','planning','payment','contract','staff','event_day') then v_item.proposed_data->>'noteType' else 'general' end,left(btrim(v_item.proposed_data->>'body'),4000),'staff','active') returning id,event_id into v_id,v_event;
      elsif v_item.candidate_type='calendar_fact' then
        insert into public.os_team_availability(team_member_id,entry_type,all_day,starts_at,ends_at,starts_on,ends_on,timezone,title,private_notes,privacy,created_by_user_id,updated_by_user_id)
        values((v_item.proposed_data->>'teamMemberId')::uuid,v_item.proposed_data->>'entryType',coalesce((v_item.proposed_data->>'allDay')::boolean,false),nullif(v_item.proposed_data->>'startsAt','')::timestamptz,nullif(v_item.proposed_data->>'endsAt','')::timestamptz,nullif(v_item.proposed_data->>'startsOn','')::date,nullif(v_item.proposed_data->>'endsOn','')::date,coalesce(nullif(v_item.proposed_data->>'timezone',''),'America/Indiana/Indianapolis'),nullif(left(btrim(v_item.proposed_data->>'title'),120),''),nullif(left(btrim(v_item.proposed_data->>'privateNotes'),2000),''),coalesce(nullif(v_item.proposed_data->>'privacy',''),'private'),v_actor,v_actor) returning id into v_id;
      end if;
      if v_id is null then raise exception 'Canonical record was not created or updated' using errcode='P0002'; end if;
      update public.os_import_batch_items set status='applied',canonical_record_ids=jsonb_build_object('primaryId',v_id),result=jsonb_strip_nulls(jsonb_build_object('before',v_before,'eventId',v_event,'contactId',v_contact)),applied_by=v_actor,applied_at=now(),updated_at=now() where id=v_item.id;
      insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
      values(v_event,v_contact,v_actor,'data_readiness.import_item_applied','staff',jsonb_build_object('batchId',p_batch_id,'itemKey',v_item.item_key,'candidateType',v_item.candidate_type),'data_readiness:'||p_batch_id::text||':'||v_item.item_key) on conflict do nothing;
      v_created:=v_created+1;
    exception when others then
      update public.os_import_batch_items set status='failed',error_code=sqlstate,updated_at=now() where id=v_item.id;
      v_errors:=v_errors+1;
    end;
  end loop;
  select count(*) into v_skipped from public.os_import_batch_items where batch_id=p_batch_id and status='excluded';
  update public.os_import_batches set status=case when v_errors>0 then 'partial' else 'completed' end,created_count=(select count(*) from public.os_import_batch_items where batch_id=p_batch_id and status='applied'),skipped_count=v_skipped,error_count=(select count(*) from public.os_import_batch_items where batch_id=p_batch_id and status='failed'),summary=summary||jsonb_build_object('lastApplyAt',now(),'lastApplyCreated',v_created,'lastApplyErrors',v_errors),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status',case when v_errors>0 then 'partial' else 'completed' end,'batchId',p_batch_id,'applied',v_created,'failed',v_errors,'excluded',v_skipped);
end; $$;

create or replace function public.os_compensate_intake_batch(p_batch_id uuid,p_manifest_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_item record; v_id uuid; v_count integer:=0;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  perform 1 from public.os_import_batches where id=p_batch_id and manifest_hash=p_manifest_hash and status in ('completed','partial') for update;
  if not found then raise exception 'Batch/hash mismatch' using errcode='P0002'; end if;
  for v_item in select * from public.os_import_batch_items where batch_id=p_batch_id and status='applied' order by applied_at desc loop
    v_id:=(v_item.canonical_record_ids->>'primaryId')::uuid;
    if v_item.candidate_type='contact' then update public.os_contacts set status='archived',updated_at=now() where id=v_id and source='reviewed_intake';
    elsif v_item.candidate_type='event' then update public.os_events set status='archived',updated_at=now() where id=v_id and source='reviewed_intake';
    elsif v_item.candidate_type='inquiry' then update public.os_leads set status='archived',updated_at=now() where id=v_id and source='reviewed_intake';
    elsif v_item.candidate_type='staff_assignment' then update public.os_staff_assignments set status='cancelled',updated_by_user_id=v_actor,updated_at=now() where id=v_id;
    elsif v_item.candidate_type='operational_note' then update public.os_event_notes set status='archived',updated_at=now() where id=v_id;
    elsif v_item.candidate_type='calendar_fact' then update public.os_team_availability set entry_type='note',privacy='private',title='Archived imported calendar fact',private_notes=null,updated_by_user_id=v_actor,updated_at=now() where id=v_id;
    elsif v_item.candidate_type='payment_fact' then update public.os_bookings set payment_status=v_item.result->'before'->>'paymentStatus',total_amount=(v_item.result->'before'->>'totalAmount')::numeric,deposit_amount=(v_item.result->'before'->>'depositAmount')::numeric,balance_due=(v_item.result->'before'->>'balanceDue')::numeric,updated_at=now() where id=v_id;
    end if;
    update public.os_import_batch_items set status='rolled_back',updated_at=now() where id=v_item.id; v_count:=v_count+1;
  end loop;
  update public.os_import_batch_items set status='excluded',updated_at=now() where batch_id=p_batch_id and status in ('previewed','approved','applying','failed');
  update public.os_import_batches set status='cancelled',rollback_at=now(),rollback_by=v_actor,summary=summary||jsonb_build_object('compensatedAt',now(),'compensatedCount',v_count),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status','compensated','batchId',p_batch_id,'itemCount',v_count);
end; $$;

revoke all on function public.os_manage_contact(text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.os_data_readiness_snapshot() from public, anon, authenticated;
revoke all on function public.os_manage_event(text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.os_manage_lead(text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.os_stage_intake_manifest(jsonb) from public, anon, authenticated;
revoke all on function public.os_approve_intake_batch(uuid,text,text[]) from public, anon, authenticated;
revoke all on function public.os_apply_intake_batch(uuid,text) from public, anon, authenticated;
revoke all on function public.os_compensate_intake_batch(uuid,text) from public, anon, authenticated;
grant execute on function public.os_manage_contact(text,uuid,jsonb) to authenticated, service_role;
grant execute on function public.os_data_readiness_snapshot() to authenticated, service_role;
grant execute on function public.os_manage_event(text,uuid,jsonb) to authenticated, service_role;
grant execute on function public.os_manage_lead(text,uuid,jsonb) to authenticated, service_role;
grant execute on function public.os_stage_intake_manifest(jsonb) to authenticated, service_role;
grant execute on function public.os_approve_intake_batch(uuid,text,text[]) to authenticated, service_role;
grant execute on function public.os_apply_intake_batch(uuid,text) to authenticated, service_role;
grant execute on function public.os_compensate_intake_batch(uuid,text) to authenticated, service_role;
