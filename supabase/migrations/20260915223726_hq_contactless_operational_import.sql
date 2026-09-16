-- Permit reviewed historical operational events without inventing a client.
-- Ordinary client work still requires a contact and remains compatible with
-- the native Wedding Hero and Event Builder intake paths.

create or replace function private.os_reject_contactless_operational_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1
    from public.os_events e
    where e.id = new.event_id
      and e.primary_contact_id is null
      and e.source = 'reviewed_intake'
      and e.settings->>'contactRelationship' = 'none_operational'
      and e.settings->>'recordDisposition' in ('vendor_appearance','operational_event')
  ) then
    raise exception 'Contactless operational events cannot become bookings' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function private.os_validate_reviewed_intake_event_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_operational boolean := coalesce(new.settings->>'recordDisposition','') in ('vendor_appearance','operational_event');
begin
  if new.source <> 'reviewed_intake' then return new; end if;
  if new.primary_contact_id is null and (
    not v_operational or coalesce(new.settings->>'contactRelationship','') <> 'none_operational'
  ) then
    raise exception 'Reviewed client events require a contact' using errcode='23514';
  end if;
  if new.primary_contact_id is not null and (
    v_operational or new.settings->>'contactRelationship' = 'none_operational'
  ) then
    raise exception 'Contactless operational classification cannot reference a client contact' using errcode='23514';
  end if;
  return new;
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
  v_operational boolean;
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

  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  lock table public.os_bookings, public.os_builder_intake_requests, public.os_builder_submissions,
    public.os_contacts, public.os_events, public.os_leads, public.os_planning_answers,
    public.os_planning_assignments in share row exclusive mode;
  if private.os_complete_intake_native_state_fingerprint()<>v_batch.summary->>'nativeStateHash' then
    raise exception 'Native submission or canonical record changed after preview; rebuild the reviewed manifest' using errcode='40001';
  end if;

  for v_item in select * from public.os_import_batch_items where batch_id=p_batch_id order by id loop
    v_warnings:=private.os_complete_manifest_duplicate_warnings(v_item.candidate_type,v_item.source_hash,v_item.proposed_data);
    if jsonb_array_length(v_warnings)>0 then raise exception 'Production duplicate detection stopped the complete import' using errcode='23505'; end if;
  end loop;

  for v_item in
    select * from public.os_import_batch_items where batch_id=p_batch_id and status='approved'
    order by case candidate_type when 'contact' then 1 when 'event' then 2 when 'inquiry' then 3 when 'booking' then 4 when 'booking_service' then 5 when 'payment_fact' then 6 when 'staff_assignment' then 7 when 'operational_note' then 8 when 'source_provenance' then 9 end, created_at, id
  loop
    v_id:=null; v_event:=null; v_contact:=null; v_lead:=null; v_booking:=null; v_service:=null; v_before:=null; v_booking_linked:=false;
    v_operational:=v_item.candidate_type='event' and v_item.proposed_data->>'recordDisposition' in ('vendor_appearance','operational_event');
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
      if v_operational then
        if coalesce(v_item.proposed_data->>'recordMode','create')<>'create' or nullif(v_item.proposed_data->>'primaryContactItemKey','') is not null or v_item.proposed_data->>'status' not in ('draft','planning','ready','active','completed','cancelled') then raise exception 'Invalid contactless operational record' using errcode='22023'; end if;
      else
        select (canonical_record_ids->>'primaryId')::uuid into v_contact from public.os_import_batch_items where batch_id=p_batch_id and item_key=v_item.proposed_data->>'primaryContactItemKey' and candidate_type='contact' and status='applied';
        if v_contact is null then raise exception 'Referenced contact is not applied' using errcode='P0002'; end if;
      end if;
      insert into public.os_events(primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,settings,created_by)
      values(v_contact,btrim(v_item.proposed_data->>'title'),left(btrim(v_item.proposed_data->>'eventType'),80),v_item.proposed_data->>'status',nullif(v_item.proposed_data->>'startsAt','')::timestamptz,nullif(v_item.proposed_data->>'endsAt','')::timestamptz,coalesce(nullif(v_item.proposed_data->>'timezone',''),'America/Indiana/Indianapolis'),nullif(left(btrim(v_item.proposed_data->>'venueName'),180),''),nullif(left(btrim(v_item.proposed_data->>'venueAddress1'),200),''),nullif(left(btrim(v_item.proposed_data->>'venueAddress2'),160),''),nullif(left(btrim(v_item.proposed_data->>'venueCity'),120),''),nullif(left(btrim(v_item.proposed_data->>'venueState'),80),''),nullif(left(btrim(v_item.proposed_data->>'venuePostalCode'),24),''),nullif(v_item.proposed_data->>'guestCount','')::integer,'reviewed_intake',jsonb_strip_nulls(jsonb_build_object('importBatchId',p_batch_id,'sourceHash',v_item.source_hash,'recordDisposition',v_item.proposed_data->>'recordDisposition','contactRelationship',case when v_operational then 'none_operational' end)),v_actor)
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
      if v_contact is null or v_event is null or exists(select 1 from public.os_events where id=v_event and settings->>'contactRelationship'='none_operational') then raise exception 'Referenced client contact or event is not applied' using errcode='P0002'; end if;
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
      if v_event is null or exists(select 1 from public.os_events where id=v_event and settings->>'contactRelationship'='none_operational') then raise exception 'Referenced bookable client event is not applied' using errcode='P0002'; end if;
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

  update public.os_bookings set metadata=metadata-'suppressAutomations',updated_at=now() where metadata->>'importBatchId'=p_batch_id::text and metadata->>'suppressAutomations'='true';
  update public.os_import_batches set status='completed',created_count=v_applied,skipped_count=0,error_count=0,summary=summary||jsonb_build_object('completedAt',now(),'atomic',true),updated_at=now() where id=p_batch_id;
  return jsonb_build_object('status','completed','batchId',p_batch_id,'applied',v_applied,'recordCount',p_record_count);
end;
$$;

revoke all on function public.os_stage_complete_intake_manifest(text,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.os_apply_complete_intake_batch(uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.os_stage_complete_intake_manifest(text,text,integer,jsonb) to authenticated, service_role;
grant execute on function public.os_apply_complete_intake_batch(uuid,text,integer,jsonb) to authenticated, service_role;

-- Rollback: restore the two RPC definitions from migration 20260915035447;
-- drop both guard triggers and their private functions.
-- Existing imported operational records remain reversible through the reviewed
-- batch rollback and must never be hard-deleted as part of schema rollback.

revoke all on function private.os_reject_contactless_operational_booking() from public, anon, authenticated;
revoke all on function private.os_validate_reviewed_intake_event_contact() from public, anon, authenticated;

create trigger os_event_reviewed_intake_contact_guard
before insert or update of primary_contact_id,source,settings on public.os_events
for each row execute function private.os_validate_reviewed_intake_event_contact();

create trigger os_booking_contactless_operational_guard
before insert or update of event_id on public.os_bookings
for each row execute function private.os_reject_contactless_operational_booking();

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
  v_operational boolean;
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
    v_operational:=v_type='event' and v_data->>'recordDisposition' in ('vendor_appearance','operational_event');
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
      when 'event' then case when v_operational then array['title','eventType','status','recordDisposition'] else array['primaryContactItemKey','title','eventType','status','recordDisposition'] end
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
    if v_type='event' and (v_data->>'status' not in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed','cancelled') or v_data->>'recordDisposition' not in ('confirmed','lower_confidence_review','pending_unbooked','vendor_appearance','operational_event')) then raise exception 'Invalid event classification' using errcode='22023'; end if;
    if v_type='event' and ((v_data->>'recordDisposition'='lower_confidence_review' and v_data->>'status'<>'inquiry') or (v_data->>'recordDisposition'='pending_unbooked' and v_data->>'status'<>'pending')) then raise exception 'Review-only and pending-unbooked events must retain bounded statuses' using errcode='22023'; end if;
    if v_operational and (v_mode<>'create' or nullif(v_data->>'primaryContactItemKey','') is not null or v_data->>'status' not in ('draft','planning','ready','active','completed','cancelled')) then raise exception 'Contactless operational records must be newly created, client-free, and noncommercial' using errcode='22023'; end if;
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
      when 'event' then case when v_data->>'recordDisposition' in ('vendor_appearance','operational_event') then array[]::text[] else array[v_data->>'primaryContactItemKey'] end
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
    if v_type='booking' and exists(
      select 1 from jsonb_array_elements(p_manifest->'items') x
      where x->>'key'=v_data->>'eventItemKey'
        and x->'data'->>'recordDisposition' in ('lower_confidence_review','pending_unbooked','vendor_appearance','operational_event')
    ) then raise exception 'Review-only, pending-unbooked, and contactless operational events cannot create bookings' using errcode='22023'; end if;
    if v_type='inquiry' and exists(
      select 1 from jsonb_array_elements(p_manifest->'items') x
      where x->>'key'=v_data->>'eventItemKey'
        and x->'data'->>'recordDisposition' in ('vendor_appearance','operational_event')
    ) then raise exception 'Contactless operational events cannot create client inquiries' using errcode='22023'; end if;
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
