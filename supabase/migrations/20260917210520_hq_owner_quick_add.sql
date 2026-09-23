-- Ordinary Owner-entered business facts belong directly in the canonical OS.
-- This is deliberately separate from reviewed intake, cleanup, and repair flows.

-- A newly recorded booking can legitimately have no payment evidence yet.
-- Preserve that truth explicitly instead of misclassifying it as unpaid.
alter table public.os_bookings drop constraint os_bookings_payment_status_check;
alter table public.os_bookings add constraint os_bookings_payment_status_check
  check (payment_status in ('unknown','unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded'));

create or replace function public.os_owner_quick_add(
  p_operation_id uuid,
  p_record_type text,
  p_payload jsonb default '{}'::jsonb,
  p_confirm_duplicates boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_contact uuid;
  v_event uuid;
  v_lead uuid;
  v_booking uuid;
  v_note uuid;
  v_activity uuid;
  v_email text;
  v_phone text;
  v_title text;
  v_status text;
  v_historical_date date;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_timezone text;
  v_payment_status text;
  v_total numeric(12,2);
  v_service_ids uuid[] := array[]::uuid[];
  v_duplicates jsonb := '[]'::jsonb;
  v_contact_result jsonb;
  v_operation_activity uuid;
  v_operation_key text;
  v_operation_payload jsonb;
  v_request_hash text;
  v_result jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'Operation identifier required' using errcode = '22023';
  end if;
  if p_record_type not in ('contact','lead','event','booking','note') or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Unsupported Quick Add record type' using errcode = '22023';
  end if;

  v_operation_key := 'owner_quick_add:' || v_actor::text || ':' || p_operation_id::text;
  v_request_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'recordType',p_record_type,'payload',p_payload
  )::text,'UTF8'),'sha256'),'hex');
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
  values(v_actor,'owner_truth.quick_add_operation','staff',jsonb_build_object(
    'status','processing','recordType',p_record_type,'requestHash',v_request_hash,'operationId',p_operation_id
  ),v_operation_key)
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_operation_activity;
  if v_operation_activity is null then
    select payload into v_operation_payload
    from public.os_activity_events
    where idempotency_key=v_operation_key
    for update;
    if v_operation_payload->>'recordType' is distinct from p_record_type
      or v_operation_payload->>'requestHash' is distinct from v_request_hash then
      raise exception 'Operation identifier was already used for different Quick Add facts' using errcode='22023';
    end if;
    v_result:=v_operation_payload->'result';
    if v_result is null then
      raise exception 'Quick Add operation is still processing; retry shortly' using errcode='40001';
    end if;
    if p_confirm_duplicates
      and v_result->>'status'='duplicate_warning'
      and coalesce((v_result->>'cannotOverride')::boolean,false) is false then
      update public.os_activity_events
      set payload=(payload-'result')||jsonb_build_object('status','processing','confirmedAt',now())
      where idempotency_key=v_operation_key;
      select id into v_operation_activity from public.os_activity_events where idempotency_key=v_operation_key;
    else
      return v_result||jsonb_build_object('replayed',true);
    end if;
  end if;

  if p_record_type = 'contact' then
    v_email := nullif(lower(btrim(p_payload->>'primaryEmail')), '');
    v_phone := nullif(btrim(p_payload->>'primaryPhone'), '');
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', d.kind, 'recordId', d.id, 'label', d.display_name, 'status', d.status
    ) order by d.kind, d.id), '[]'::jsonb)
    into v_duplicates
    from (
      select id, display_name, status, 'exact_email'::text as kind
      from public.os_contacts
      where v_email is not null and lower(primary_email) = v_email
      union all
      select id, display_name, status, 'exact_phone'::text
      from public.os_contacts
      where v_phone is not null
        and regexp_replace(primary_phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    ) d;
    if jsonb_array_length(v_duplicates) > 0 and not p_confirm_duplicates then
      v_result:=jsonb_build_object('status','duplicate_warning','duplicateWarnings',v_duplicates,'operationId',p_operation_id,'replayed',false);
      update public.os_activity_events set payload=payload||jsonb_build_object('status','warning','result',v_result) where id=v_operation_activity;
      return v_result;
    end if;
    v_contact_result := public.os_manage_contact('create', null, p_payload);
    v_result:=v_contact_result||jsonb_build_object('source','owner_attestation','operationId',p_operation_id,'replayed',false);
    update public.os_activity_events set contact_id=(v_result->>'contactId')::uuid,payload=payload||jsonb_build_object('status','completed','result',v_result) where id=v_operation_activity;
    return v_result;
  end if;

  if p_record_type = 'lead' then
    begin v_contact := nullif(p_payload->>'contactId','')::uuid; exception when others then
      raise exception 'Choose a valid contact' using errcode = '22023';
    end;
    if v_contact is null and jsonb_typeof(p_payload->'newContact') = 'object' then
      v_email := nullif(lower(btrim(p_payload->'newContact'->>'primaryEmail')), '');
      v_phone := nullif(btrim(p_payload->'newContact'->>'primaryPhone'), '');
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', d.kind, 'recordId', d.id, 'label', d.display_name, 'status', d.status
      ) order by d.kind, d.id), '[]'::jsonb)
      into v_duplicates
      from (
        select id, display_name, status, 'exact_email'::text as kind
        from public.os_contacts
        where v_email is not null and lower(primary_email) = v_email
        union all
        select id, display_name, status, 'exact_phone'::text
        from public.os_contacts
        where v_phone is not null
          and regexp_replace(primary_phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
      ) d;
      if jsonb_array_length(v_duplicates) > 0 and not p_confirm_duplicates then
        v_result:=jsonb_build_object('status','duplicate_warning','duplicateWarnings',v_duplicates,'operationId',p_operation_id,'replayed',false);
        update public.os_activity_events set payload=payload||jsonb_build_object('status','warning','result',v_result) where id=v_operation_activity;
        return v_result;
      end if;
      v_contact_result := public.os_manage_contact('create', null, p_payload->'newContact');
      v_contact := (v_contact_result->>'contactId')::uuid;
    end if;
    if v_contact is null or not exists (
      select 1 from public.os_contacts where id = v_contact and status <> 'archived'
    ) then raise exception 'Choose an active contact or enter a new one' using errcode = '22023'; end if;
    v_status := coalesce(nullif(p_payload->>'status',''),'new');
    if v_status not in ('new','qualifying','quoted','follow_up') then
      raise exception 'Invalid new lead status' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind','active_contact_lead','recordId',id,'label',coalesce(inquiry_summary,'Existing lead'),'status',status
    )), '[]'::jsonb)
    into v_duplicates
    from public.os_leads
    where contact_id = v_contact and status in ('new','qualifying','quoted','follow_up');
    if jsonb_array_length(v_duplicates) > 0 and not p_confirm_duplicates then
      v_result:=jsonb_build_object('status','duplicate_warning','duplicateWarnings',v_duplicates,'operationId',p_operation_id,'replayed',false);
      update public.os_activity_events set contact_id=v_contact,payload=payload||jsonb_build_object('status','warning','result',v_result) where id=v_operation_activity;
      return v_result;
    end if;
    insert into public.os_leads(contact_id,status,source,inquiry_summary,next_follow_up_at,metadata)
    values(
      v_contact,v_status,coalesce(nullif(left(btrim(p_payload->>'source'),120),''),'owner_manual'),
      nullif(left(btrim(p_payload->>'summary'),2000),''),nullif(p_payload->>'nextFollowUpAt','')::timestamptz,
      jsonb_build_object('evidenceClassification','Owner attestation','createdByQuickAdd',true)
    ) returning id into v_lead;
    insert into public.os_activity_events(contact_id,actor_user_id,event_type,visibility,payload)
    values(v_contact,v_actor,'owner_truth.lead_created','staff',jsonb_build_object(
      'summary','Owner created a lead through Quick Add.','leadId',v_lead,'source','hq_quick_add',
      'note',nullif(left(btrim(p_payload->>'notes'),4000),'')
    )) returning id into v_activity;
    v_result:=jsonb_build_object('status','created','recordType','lead','leadId',v_lead,'contactId',v_contact,'activityId',v_activity,'operationId',p_operation_id,'replayed',false);
    update public.os_activity_events set contact_id=v_contact,payload=payload||jsonb_build_object('status','completed','result',v_result) where id=v_operation_activity;
    return v_result;
  end if;

  if p_record_type = 'event' then
    begin v_contact := nullif(p_payload->>'contactId','')::uuid; exception when others then
      raise exception 'Choose a valid client contact' using errcode = '22023';
    end;
    if v_contact is null or not exists (
      select 1 from public.os_contacts where id = v_contact and status <> 'archived'
    ) then raise exception 'Choose an active client contact' using errcode = '22023'; end if;
    v_title := btrim(coalesce(p_payload->>'title',''));
    if char_length(v_title) not between 1 and 180 then raise exception 'Invalid event title' using errcode = '22023'; end if;
    v_status := coalesce(nullif(p_payload->>'status',''),'inquiry');
    if v_status not in ('draft','inquiry','quoted','pending','booked','planning','ready','active','completed') then
      raise exception 'Invalid new event status' using errcode = '22023';
    end if;
    begin v_historical_date := nullif(p_payload->>'historicalDate','')::date; exception when others then
      raise exception 'Invalid event date' using errcode = '22023';
    end;
    begin v_starts_at := nullif(p_payload->>'startsAt','')::timestamptz; v_ends_at := nullif(p_payload->>'endsAt','')::timestamptz; exception when others then
      raise exception 'Invalid event time' using errcode = '22023';
    end;
    v_timezone := nullif(left(btrim(p_payload->>'timezone'),100),'');
    if v_historical_date is null and v_starts_at is null then raise exception 'Event date required' using errcode = '22023'; end if;
    if v_historical_date is not null and (v_starts_at is not null or v_ends_at is not null or v_timezone is not null) then
      raise exception 'Date-only events cannot include a time or timezone' using errcode = '22023';
    end if;
    if v_starts_at is not null and v_timezone is null then raise exception 'Timezone required for timed events' using errcode = '22023'; end if;
    if v_ends_at is not null and (v_starts_at is null or v_ends_at <= v_starts_at) then raise exception 'End must follow start' using errcode = '22023'; end if;
    if jsonb_typeof(coalesce(p_payload->'serviceIds','[]'::jsonb)) <> 'array' then raise exception 'Invalid service selection' using errcode = '22023'; end if;
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_service_ids
    from jsonb_array_elements_text(coalesce(p_payload->'serviceIds','[]'::jsonb));
    if exists (select 1 from unnest(v_service_ids) as requested(service_id) where not exists (
      select 1 from public.os_service_catalog s where s.id=requested.service_id and s.is_active
    )) then raise exception 'Choose active services only' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind','same_title_and_date','recordId',id,'label',title,'status',status
    )), '[]'::jsonb) into v_duplicates
    from public.os_events
    where lower(title)=lower(v_title)
      and ((v_historical_date is not null and historical_date=v_historical_date)
        or (v_starts_at is not null and starts_at::date=v_starts_at::date));
    if jsonb_array_length(v_duplicates) > 0 and not p_confirm_duplicates then
      v_result:=jsonb_build_object('status','duplicate_warning','duplicateWarnings',v_duplicates,'operationId',p_operation_id,'replayed',false);
      update public.os_activity_events set contact_id=v_contact,payload=payload||jsonb_build_object('status','warning','result',v_result) where id=v_operation_activity;
      return v_result;
    end if;
    insert into public.os_events(primary_contact_id,title,event_type,status,starts_at,ends_at,historical_date,timezone,
      venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,settings,created_by)
    values(v_contact,v_title,left(btrim(coalesce(p_payload->>'eventType','other')),80),v_status,v_starts_at,v_ends_at,v_historical_date,v_timezone,
      nullif(left(btrim(p_payload->>'venueName'),180),''),nullif(left(btrim(p_payload->>'venueAddress1'),200),''),nullif(left(btrim(p_payload->>'venueAddress2'),160),''),
      nullif(left(btrim(p_payload->>'venueCity'),120),''),nullif(left(btrim(p_payload->>'venueState'),80),''),nullif(left(btrim(p_payload->>'venuePostalCode'),24),''),
      case when nullif(p_payload->>'guestCount','') is null then null else (p_payload->>'guestCount')::integer end,
      'hq_owner_manual',jsonb_build_object('evidenceClassification','Owner attestation','createdByQuickAdd',true,'requestedServiceIds',to_jsonb(v_service_ids)),v_actor)
    returning id into v_event;
    if nullif(btrim(p_payload->>'notes'),'') is not null then
      insert into public.os_event_notes(event_id,author_user_id,note_type,body,visibility,status)
      values(v_event,v_actor,'general',left(btrim(p_payload->>'notes'),10000),'staff','active') returning id into v_note;
    end if;
    insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload)
    values(v_event,v_contact,v_actor,'owner_truth.event_created','staff',jsonb_build_object(
      'summary','Owner created an event through Quick Add.','source','hq_quick_add','noteId',v_note
    )) returning id into v_activity;
    v_result:=jsonb_build_object('status','created','recordType','event','eventId',v_event,'contactId',v_contact,'noteId',v_note,'activityId',v_activity,'operationId',p_operation_id,'replayed',false);
    update public.os_activity_events set event_id=v_event,contact_id=v_contact,payload=payload||jsonb_build_object('status','completed','result',v_result) where id=v_operation_activity;
    return v_result;
  end if;

  if p_record_type = 'booking' then
    begin v_event := nullif(p_payload->>'eventId','')::uuid; exception when others then
      raise exception 'Choose a valid event' using errcode = '22023';
    end;
    select primary_contact_id into v_contact from public.os_events where id=v_event and status <> 'archived' for update;
    if not found then raise exception 'Choose an active event' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('kind','event_booking','recordId',id,'label','Existing booking','status',status)), '[]'::jsonb)
    into v_duplicates from public.os_bookings where event_id=v_event;
    if jsonb_array_length(v_duplicates)>0 then
      v_result:=jsonb_build_object('status','duplicate_warning','duplicateWarnings',v_duplicates,'cannotOverride',true,'operationId',p_operation_id,'replayed',false);
      update public.os_activity_events set event_id=v_event,contact_id=v_contact,payload=payload||jsonb_build_object('status','warning','result',v_result) where id=v_operation_activity;
      return v_result;
    end if;
    v_status:=coalesce(nullif(p_payload->>'status',''),'pending');
    if v_status not in ('pending','pending_contract','pending_deposit','confirmed') then raise exception 'Invalid booking status' using errcode='22023'; end if;
    begin v_total:=nullif(p_payload->>'contractedAmount','')::numeric; exception when others then raise exception 'Invalid contracted amount' using errcode='22023'; end;
    if v_total is not null and v_total < 0 then raise exception 'Contracted amount cannot be negative' using errcode='23514'; end if;
    v_payment_status:=nullif(p_payload->>'paymentStatus','');
    if v_payment_status is not null and v_payment_status not in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded') then
      raise exception 'Invalid payment status' using errcode='22023';
    end if;
    if jsonb_typeof(coalesce(p_payload->'serviceIds','[]'::jsonb)) <> 'array' then raise exception 'Invalid service selection' using errcode='22023'; end if;
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_service_ids from jsonb_array_elements_text(coalesce(p_payload->'serviceIds','[]'::jsonb));
    if exists (select 1 from unnest(v_service_ids) as requested(service_id) where not exists (select 1 from public.os_service_catalog s where s.id=requested.service_id and s.is_active)) then raise exception 'Choose active services only' using errcode='22023'; end if;
    insert into public.os_bookings(event_id,status,booked_at,contract_status,payment_status,total_amount,deposit_amount,balance_due,metadata)
    values(v_event,v_status,case when v_status='confirmed' then now() else null end,'not_sent',
      coalesce(v_payment_status,'unknown'),
      v_total,null,null,jsonb_build_object('source','hq_quick_add','ownerAttestation',true,'paymentStatusKnown',v_payment_status is not null))
    returning id into v_booking;
    insert into public.os_booking_services(booking_id,service_id,service_code,service_name,status)
    select v_booking,s.id,s.code,s.name,'booked' from public.os_service_catalog s where s.id=any(v_service_ids);
    if nullif(btrim(p_payload->>'notes'),'') is not null then
      insert into public.os_event_notes(event_id,author_user_id,note_type,body,visibility,status)
      values(v_event,v_actor,'contract',left(btrim(p_payload->>'notes'),10000),'staff','active') returning id into v_note;
    end if;
    insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload)
    values(v_event,v_contact,v_actor,'owner_truth.booking_created','staff',jsonb_build_object(
      'summary','Owner created a booking through Quick Add.','bookingId',v_booking,'source','hq_quick_add',
      'paymentStatusKnown',v_payment_status is not null,'noteId',v_note
    )) returning id into v_activity;
    v_result:=jsonb_build_object('status','created','recordType','booking','bookingId',v_booking,'eventId',v_event,'serviceCount',cardinality(v_service_ids),'noteId',v_note,'activityId',v_activity,'operationId',p_operation_id,'replayed',false);
    update public.os_activity_events set event_id=v_event,contact_id=v_contact,payload=payload||jsonb_build_object('status','completed','result',v_result) where id=v_operation_activity;
    return v_result;
  end if;

  -- A plain note uses the existing event-note model when an event is available,
  -- and the canonical activity stream for contact-only notes.
  if char_length(btrim(coalesce(p_payload->>'body',''))) not between 1 and 10000 then raise exception 'Invalid note' using errcode='22023'; end if;
  begin
    if p_payload->>'entityType'='event' then v_event:=(p_payload->>'entityId')::uuid;
    elsif p_payload->>'entityType'='booking' then select event_id into v_event from public.os_bookings where id=(p_payload->>'entityId')::uuid;
    elsif p_payload->>'entityType'='lead' then select event_id,contact_id into v_event,v_contact from public.os_leads where id=(p_payload->>'entityId')::uuid;
    elsif p_payload->>'entityType'='contact' then v_contact:=(p_payload->>'entityId')::uuid;
    else raise exception 'Choose a supported note record' using errcode='22023'; end if;
  exception when invalid_text_representation then raise exception 'Choose a valid note record' using errcode='22023'; end;
  if v_event is not null then
    select coalesce(v_contact,primary_contact_id) into v_contact from public.os_events where id=v_event and status<>'archived';
    if not found then raise exception 'Choose an active event' using errcode='22023'; end if;
    insert into public.os_event_notes(event_id,author_user_id,note_type,body,visibility,status)
    values(v_event,v_actor,'general',btrim(p_payload->>'body'),'staff','active') returning id into v_note;
  elsif v_contact is null or not exists(select 1 from public.os_contacts where id=v_contact and status<>'archived') then
    raise exception 'Choose an active contact' using errcode='22023';
  end if;
  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload)
  values(v_event,v_contact,v_actor,'owner_truth.note_added','staff',jsonb_build_object(
    'summary',btrim(p_payload->>'body'),'source','hq_quick_add','entityType',p_payload->>'entityType','entityId',p_payload->>'entityId','noteId',v_note
  )) returning id into v_activity;
  v_result:=jsonb_build_object('status','created','recordType','note','eventId',v_event,'contactId',v_contact,'noteId',v_note,'activityId',v_activity,'operationId',p_operation_id,'replayed',false);
  update public.os_activity_events set event_id=v_event,contact_id=v_contact,payload=payload||jsonb_build_object('status','completed','result',v_result) where id=v_operation_activity;
  return v_result;
end;
$$;

revoke all on function public.os_owner_quick_add(uuid,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.os_owner_quick_add(uuid,text,jsonb,boolean) to authenticated, service_role;

comment on function public.os_owner_quick_add(uuid,text,jsonb,boolean) is
  'Owner-only atomic and idempotent creation of ordinary contacts, leads, events, bookings, and notes. Reviewed intake and repair workflows are intentionally excluded.';

-- Rollback is executable at supabase/rollbacks/20260917210520_hq_owner_quick_add.sql.
-- It blocks rather than inventing a known payment state while any booking remains unknown.
