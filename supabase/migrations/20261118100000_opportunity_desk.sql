-- Source-only release candidate. Never apply to Production without separate approval.
-- All operations reuse the canonical leads, tasks, contacts, quotes and staff-only activity stream.
-- The existing event-private bucket permits client event members to read objects.
-- Source screenshots require their own staff-only bucket and must never be public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('opportunity-evidence','opportunity-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy os_opportunity_evidence_staff_read on storage.objects for select to authenticated
using (bucket_id = 'opportunity-evidence' and public.os_is_staff());
create policy os_opportunity_evidence_owner_write on storage.objects for insert to authenticated
with check (bucket_id = 'opportunity-evidence' and public.os_has_hq_capability('data.readiness.manage'));
create policy os_opportunity_evidence_owner_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'opportunity-evidence' and owner_id = (select auth.uid())::text
  and public.os_has_hq_capability('data.readiness.manage'));
create policy os_files_opportunity_evidence_owner_insert on public.os_files for insert to authenticated
with check (bucket_id = 'opportunity-evidence' and visibility = 'staff_only'
  and category = 'inquiry_evidence' and public.os_has_hq_capability('data.readiness.manage'));

create unique index if not exists os_leads_gigsalad_thread_unique
  on public.os_leads ((metadata->>'gigsalad_thread_url'))
  where source = 'gigsalad' and metadata ? 'gigsalad_thread_url';

create or replace function public.os_follow_up_operation(
  p_action text, p_lead_id uuid, p_operation_id uuid, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_lead public.os_leads%rowtype;
  v_task public.os_tasks%rowtype;
  v_target uuid;
  v_due timestamptz;
  v_body text;
  v_key text;
  v_hash text;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('task.write') then
    raise exception 'Staff authorization required' using errcode = '42501';
  end if;
  if p_lead_id is null or p_operation_id is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  v_key := 'opportunity_follow_up:' || v_actor::text || ':' || p_operation_id::text;
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object('action',p_action,'leadId',p_lead_id,'payload',p_payload)::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
  select payload into v_previous from public.os_activity_events where idempotency_key = v_key for update;
  if found then
    if v_previous->>'requestHash' is distinct from v_hash then
      raise exception 'Operation identifier reused with different details' using errcode = '22023';
    end if;
    return v_previous->'result';
  end if;
  select * into v_lead from public.os_leads where id = p_lead_id for update;
  if not found or v_lead.status not in ('new','qualifying','quoted','follow_up') then
    raise exception 'Open lead unavailable' using errcode = 'P0002';
  end if;
  select * into v_task from public.os_tasks
    where lead_id = p_lead_id and task_type = 'follow_up'
      and status not in ('completed','cancelled')
    order by created_at desc limit 1 for update;
  if p_action = 'claim' then
    if v_lead.assigned_to is not null or (v_task.id is not null and v_task.assigned_to is not null) then
      raise exception 'Follow-up is already claimed' using errcode = '23505';
    end if;
    update public.os_leads set assigned_to = v_actor where id = p_lead_id;
    if v_task.id is not null then update public.os_tasks set assigned_to = v_actor where id = v_task.id; end if;
    v_body := 'Follow-up claimed';
  elsif p_action = 'assign' then
    if not public.os_has_hq_capability('lead.lifecycle.manage') then
      raise exception 'Owner authorization required' using errcode = '42501';
    end if;
    begin v_target := (p_payload->>'assignee')::uuid; exception when others then raise exception 'Invalid team member' using errcode='22023'; end;
    if v_target is null or not exists (
      select 1 from public.os_profiles p join auth.users u on u.id = p.id
      where p.id = v_target and p.is_active and u.raw_app_meta_data->>'role' in ('owner','manager','staff','host')
    ) then raise exception 'Active HQ team member required' using errcode = '22023'; end if;
    update public.os_leads set assigned_to = v_target where id = p_lead_id;
    if v_task.id is not null then update public.os_tasks set assigned_to = v_target where id = v_task.id; end if;
    v_body := 'Follow-up assigned';
  elsif p_action in ('note','draft','attempt','schedule','task_create','task_complete') then
    if v_lead.assigned_to is distinct from v_actor and not public.os_has_hq_capability('lead.lifecycle.manage') then
      raise exception 'Claim this follow-up first' using errcode = '42501';
    end if;
    if p_action in ('note','draft','attempt') then
      v_body := pg_catalog.btrim(coalesce(p_payload->>'body',''));
      if pg_catalog.length(v_body) not between 1 and 4000 then raise exception 'Update must be 1 to 4000 characters' using errcode='22023'; end if;
    elsif p_action = 'schedule' then
      begin v_due := (p_payload->>'dueAt')::timestamptz; exception when others then raise exception 'Valid due date required' using errcode='22023'; end;
      if v_due is null then raise exception 'Due date required' using errcode='22023'; end if;
      update public.os_leads set next_follow_up_at = v_due where id = p_lead_id;
      if v_task.id is not null then update public.os_tasks set due_at = v_due where id = v_task.id; end if;
      v_body := 'Next follow-up date set';
    elsif p_action = 'task_create' then
      if v_task.id is not null then raise exception 'An open follow-up task already exists' using errcode='23505'; end if;
      if p_payload->>'priority' not in ('normal','high','urgent') then raise exception 'Invalid priority' using errcode='22023'; end if;
      insert into public.os_tasks(lead_id,event_id,title,task_type,status,priority,due_at,assigned_to,created_by,metadata)
      values(p_lead_id,v_lead.event_id,'Follow up with client','follow_up','todo',p_payload->>'priority',v_lead.next_follow_up_at,v_lead.assigned_to,v_actor,
        pg_catalog.jsonb_build_object('idempotency_key','hq-follow-up:' || p_lead_id::text || ':' || p_operation_id::text,'origin','hq_follow_up_board'));
      v_body := 'Follow-up task created';
    else
      if v_task.id is null then raise exception 'Open task unavailable' using errcode = 'P0002'; end if;
      update public.os_tasks set status='completed',completed_at=pg_catalog.now() where id=v_task.id;
      update public.os_leads set next_follow_up_at=null where id=p_lead_id;
      v_body := 'Follow-up task completed';
    end if;
  else
    raise exception 'Unsupported follow-up operation' using errcode = '22023';
  end if;
  v_result := pg_catalog.jsonb_build_object('status','saved','leadId',p_lead_id,'action',p_action);
  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
  values(v_lead.event_id,v_lead.contact_id,v_actor,'lead.follow_up.' || p_action,'staff',
    pg_catalog.jsonb_build_object('lead_id',p_lead_id,'body',v_body,'requestHash',v_hash,'result',v_result),v_key);
  return v_result;
end;
$$;
revoke all on function public.os_follow_up_operation(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.os_follow_up_operation(text,uuid,uuid,jsonb) to authenticated;

create or replace function public.os_create_opportunity(
  p_operation_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_hash text;
  v_prior jsonb;
  v_source text;
  v_thread text;
  v_contact uuid;
  v_event uuid;
  v_lead uuid;
  v_quote uuid;
  v_assignee uuid;
  v_due timestamptz;
  v_date date;
  v_amount numeric(12,2);
  v_deposit numeric(12,2);
  v_quote_state text;
  v_sent_at timestamptz;
  v_message text;
  v_screenshot text;
  v_screenshot_type text;
  v_screenshot_name text;
  v_screenshot_size integer;
  v_result jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner authorization required' using errcode='42501';
  end if;
  if p_operation_id is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid intake operation' using errcode='22023';
  end if;
  v_key := 'opportunity_intake:' || v_actor::text || ':' || p_operation_id::text;
  v_hash := pg_catalog.md5(p_payload::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
  select payload into v_prior from public.os_activity_events where idempotency_key = v_key for update;
  if found then
    if v_prior->>'requestHash' is distinct from v_hash then
      raise exception 'Intake operation reused with different facts' using errcode='22023';
    end if;
    return v_prior->'result';
  end if;
  v_source := p_payload->>'source';
  v_thread := pg_catalog.btrim(coalesce(p_payload->>'threadUrl',''));
  if v_source not in ('gigsalad','other') or pg_catalog.length(v_thread) > 1000 then
    raise exception 'Valid source and reference required' using errcode='22023';
  end if;
  if v_source = 'gigsalad' then
    if v_thread !~* '^https://(www\.)?gigsalad\.com/[^[:space:]@]+' then
      raise exception 'Verified GigSalad thread URL required' using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_thread,0));
    if exists(select 1 from public.os_leads where source='gigsalad' and metadata->>'gigsalad_thread_url'=v_thread) then
      raise exception 'GigSalad thread already exists in HQ' using errcode='23505';
    end if;
  end if;
  v_message := pg_catalog.btrim(coalesce(p_payload->>'originalMessage',''));
  v_screenshot := pg_catalog.btrim(coalesce(p_payload->>'screenshotPath',''));
  v_screenshot_type := p_payload->>'screenshotType';
  v_screenshot_name := p_payload->>'screenshotName';
  if v_screenshot <> '' then
    if coalesce(v_screenshot_type,'') not in ('image/png','image/jpeg','image/webp')
       or v_screenshot <> ('intake/' || p_operation_id::text || case v_screenshot_type
         when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '' end)
       or pg_catalog.length(coalesce(v_screenshot_name,'')) not between 1 and 180 then
      raise exception 'Invalid screenshot reference' using errcode='22023';
    end if;
    select (o.metadata->>'size')::integer into v_screenshot_size
      from storage.objects o where o.bucket_id='opportunity-evidence'
        and o.name=v_screenshot and o.owner_id=v_actor::text;
    if v_screenshot_size is null or v_screenshot_size < 1 or v_screenshot_size > 5242880 then
      raise exception 'Private screenshot must be uploaded first' using errcode='22023';
    end if;
  end if;
  if (v_message = '' and v_screenshot = '') or pg_catalog.length(v_message) > 12000
     or pg_catalog.length(coalesce(p_payload->>'originalReply','')) > 12000
     or pg_catalog.length(coalesce(p_payload->>'serviceOptions','')) > 3000
     or pg_catalog.length(coalesce(p_payload->>'summary','')) not between 1 and 2000 then
    raise exception 'Review the required inquiry and message lengths' using errcode='22023';
  end if;
  begin v_contact := nullif(p_payload->>'contactId','')::uuid; exception when others then raise exception 'Invalid contact' using errcode='22023'; end;
  if v_contact is null then
    if pg_catalog.length(pg_catalog.btrim(coalesce(p_payload->>'clientName',''))) not between 2 and 180
      or (nullif(p_payload->>'email','') is null and nullif(p_payload->>'phone','') is null) then
      raise exception 'Client name and one contact method required' using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'opportunity-contact:' || pg_catalog.lower(coalesce(nullif(p_payload->>'email',''),nullif(p_payload->>'phone',''))),0));
    select id into v_contact from public.os_contacts where status <> 'archived'
      and ((nullif(p_payload->>'email','') is not null and pg_catalog.lower(primary_email)=pg_catalog.lower(p_payload->>'email'))
        or (nullif(p_payload->>'phone','') is not null and primary_phone=p_payload->>'phone')) limit 1;
    if v_contact is not null then
      return pg_catalog.jsonb_build_object('status','duplicate_warning','contactId',v_contact,'message','Review the existing contact before intake');
    end if;
    insert into public.os_contacts(display_name,primary_email,primary_phone,source,created_by,metadata)
    values(pg_catalog.left(pg_catalog.btrim(p_payload->>'clientName'),180),nullif(p_payload->>'email',''),nullif(p_payload->>'phone',''),v_source,v_actor,
      pg_catalog.jsonb_build_object('evidenceClassification','Owner verified intake')) returning id into v_contact;
  else
    perform 1 from public.os_contacts where id=v_contact and status <> 'archived' for update;
    if not found then raise exception 'Active contact required' using errcode='22023'; end if;
  end if;
  if exists(select 1 from public.os_leads where contact_id=v_contact and status in ('new','qualifying','quoted','follow_up')) then
    return pg_catalog.jsonb_build_object('status','duplicate_warning','contactId',v_contact,'message','Review the existing open lead before intake');
  end if;
  begin v_assignee := nullif(p_payload->>'assignee','')::uuid; exception when others then raise exception 'Invalid assignee' using errcode='22023'; end;
  if v_assignee is not null and not exists (
    select 1 from public.os_profiles p join auth.users u on u.id=p.id
      where p.id=v_assignee and p.is_active and u.raw_app_meta_data->>'role' in ('owner','manager','staff','host')
  ) then raise exception 'Active HQ team member required' using errcode='22023'; end if;
  begin v_due := nullif(p_payload->>'dueAt','')::timestamptz; v_date := nullif(p_payload->>'eventDate','')::date;
    exception when others then raise exception 'Invalid event or follow-up date' using errcode='22023'; end;
  if p_payload->>'priority' not in ('normal','high','urgent') then raise exception 'Invalid task priority' using errcode='22023'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_payload->>'eventType',''))) not between 2 and 120 then raise exception 'Event type required' using errcode='22023'; end if;
  insert into public.os_events(primary_contact_id,title,event_type,status,historical_date,timezone,venue_name,venue_city,source,created_by)
    values(v_contact,pg_catalog.left(pg_catalog.btrim(p_payload->>'eventType') || ' inquiry',180),
      pg_catalog.left(pg_catalog.btrim(p_payload->>'eventType'),120),'inquiry',v_date,null,
      nullif(pg_catalog.left(p_payload->>'venue',180),''),nullif(pg_catalog.left(p_payload->>'city',120),''),v_source,v_actor)
    returning id into v_event;
  insert into public.os_leads(contact_id,event_id,status,source,assigned_to,inquiry_summary,next_follow_up_at,metadata)
    values(v_contact,v_event,'new',v_source,v_assignee,pg_catalog.left(p_payload->>'summary',2000),v_due,
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('gigsalad_thread_url',case when v_source='gigsalad' then v_thread end,
      'source_reference',nullif(v_thread,''),'evidenceClassification','Owner verified intake','createdByOpportunityDesk',true)))
    returning id into v_lead;
  v_quote_state := p_payload->>'quoteState';
  if v_quote_state not in ('unknown','draft','confirmed_sent') then raise exception 'Quote status must be verified' using errcode='22023'; end if;
  if v_quote_state <> 'unknown' then
    begin v_amount := (p_payload->>'quoteAmount')::numeric(12,2); v_deposit := coalesce(nullif(p_payload->>'deposit','')::numeric(12,2),0);
      exception when others then raise exception 'Invalid quote amounts' using errcode='22023'; end;
    if v_amount is null or v_amount < 0 or v_deposit < 0 or v_deposit > v_amount then raise exception 'Review quote and deposit' using errcode='22023'; end if;
    if v_quote_state = 'confirmed_sent' then
      if pg_catalog.btrim(coalesce(p_payload->>'originalReply','')) = '' then
        raise exception 'Original sent reply required' using errcode='22023';
      end if;
      begin v_sent_at := (p_payload->>'sentAt')::timestamptz; exception when others then raise exception 'Sent date required' using errcode='22023'; end;
      if v_sent_at is null or v_sent_at > pg_catalog.now() then raise exception 'Confirmed sent date required' using errcode='22023'; end if;
    end if;
    insert into public.os_quote_versions(lead_id,event_id,version_number,status,currency,subtotal,total_amount,deposit_amount,sent_at,snapshot,created_by)
      values(v_lead,v_event,1,case when v_quote_state='confirmed_sent' then 'sent' else 'draft' end,'USD',v_amount,v_amount,v_deposit,v_sent_at,
        pg_catalog.jsonb_build_object('source',v_source,'serviceOptions',pg_catalog.left(coalesce(p_payload->>'serviceOptions',''),3000),
          'evidenceClassification','Owner verified intake'),v_actor)
      returning id into v_quote;
  end if;
  insert into public.os_tasks(event_id,lead_id,title,task_type,status,priority,due_at,assigned_to,created_by,metadata)
    values(v_event,v_lead,'Follow up with client','follow_up','todo',p_payload->>'priority',v_due,v_assignee,v_actor,
      pg_catalog.jsonb_build_object('idempotency_key','hq-follow-up:' || v_lead::text,'origin','opportunity_desk'));
  if v_screenshot <> '' then
    insert into public.os_files(event_id,bucket_id,object_path,file_name,mime_type,size_bytes,category,visibility,uploaded_by_user_id,metadata)
      values(v_event,'opportunity-evidence',v_screenshot,v_screenshot_name,v_screenshot_type,v_screenshot_size,
        'inquiry_evidence','staff_only',v_actor,pg_catalog.jsonb_build_object('leadId',v_lead,
        'source','opportunity_desk','retention','retain_with_opportunity'));
  end if;
  v_result := pg_catalog.jsonb_build_object('status','created','leadId',v_lead,'eventId',v_event,'contactId',v_contact,'quoteId',v_quote);
  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_event,v_contact,v_actor,'opportunity.intake_created','staff',pg_catalog.jsonb_build_object(
      'lead_id',v_lead,'originalMessage',v_message,'originalReply',nullif(p_payload->>'originalReply',''),
      'threadUrl',nullif(v_thread,''),'requestHash',v_hash,'result',v_result),v_key);
  return v_result;
end;
$$;
revoke all on function public.os_create_opportunity(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.os_create_opportunity(uuid,jsonb) to authenticated;
