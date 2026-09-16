-- Preserve reviewed historical financial evidence without conflating receipts
-- with contract value, and preserve known dates whose times are unknown.

alter table public.os_booking_payment_facts
  add column contracted_or_quoted_amount numeric(12,2),
  add column deposit_received_amount numeric(12,2),
  add column tip_amount numeric(12,2),
  add column overtime_amount numeric(12,2),
  add column balance_due_amount numeric(12,2),
  add constraint os_booking_payment_facts_evidence_amounts_chk check (
    (contracted_or_quoted_amount is null or contracted_or_quoted_amount >= 0)
    and (deposit_received_amount is null or deposit_received_amount >= 0)
    and (tip_amount is null or tip_amount >= 0)
    and (overtime_amount is null or overtime_amount >= 0)
    and (balance_due_amount is null or balance_due_amount >= 0)
  ),
  add constraint os_booking_payment_facts_deposit_contract_chk check (
    contracted_or_quoted_amount is null
    or deposit_received_amount is null
    or deposit_received_amount <= contracted_or_quoted_amount
  ),
  add constraint os_booking_payment_facts_deposit_gross_chk check (
    gross_client_amount is null
    or deposit_received_amount is null
    or deposit_received_amount <= gross_client_amount
  );

alter table public.os_events
  add column historical_date date,
  add constraint os_events_historical_date_precision_chk check (
    historical_date is null or (starts_at is null and ends_at is null and timezone is null)
  );

alter table public.os_events alter column timezone drop not null;

create index os_events_historical_date_idx
  on public.os_events(historical_date, id)
  where historical_date is not null;

create or replace function private.os_validate_complete_import_evidence_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_contract numeric;
  v_deposit numeric;
  v_gross numeric;
  v_tip numeric;
  v_overtime numeric;
  v_fee numeric;
  v_net numeric;
  v_balance numeric;
  v_historical_date text;
begin
  if not exists (
    select 1
    from public.os_import_batches b
    where b.id = new.batch_id
      and b.contract_version = 'intake_manifest_v2'
  ) then
    return new;
  end if;

  if new.candidate_type = 'event' then
    v_historical_date := nullif(new.proposed_data->>'historicalDate','');
    if v_historical_date is not null then
      if v_historical_date !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'historicalDate must be an ISO calendar date' using errcode='22023';
      end if;
      perform v_historical_date::date;
      if nullif(new.proposed_data->>'startsAt','') is not null
        or nullif(new.proposed_data->>'endsAt','') is not null then
        raise exception 'Date-only events cannot include a start or end timestamp' using errcode='22023';
      end if;
    end if;
  elsif new.candidate_type = 'payment_fact' then
    begin
      v_contract := nullif(new.proposed_data->>'contractedOrQuotedValue','')::numeric;
      v_deposit := nullif(new.proposed_data->>'depositAmount','')::numeric;
      v_gross := nullif(new.proposed_data->>'grossClientAmount','')::numeric;
      v_tip := nullif(new.proposed_data->>'tipAmount','')::numeric;
      v_overtime := nullif(new.proposed_data->>'overtimeAmount','')::numeric;
      v_fee := nullif(new.proposed_data->>'platformFeeAmount','')::numeric;
      v_net := nullif(new.proposed_data->>'netPayoutAmount','')::numeric;
      v_balance := nullif(new.proposed_data->>'balanceDue','')::numeric;
    exception when others then
      raise exception 'Financial evidence amounts must be valid numbers' using errcode='22023';
    end;
    if v_contract < 0 or v_deposit < 0 or v_gross < 0 or v_tip < 0
      or v_overtime < 0 or v_fee < 0 or v_net < 0 or v_balance < 0 then
      raise exception 'Financial evidence amounts must be non-negative' using errcode='22023';
    end if;
    if v_contract is not null and v_deposit is not null and v_deposit > v_contract then
      raise exception 'Deposit cannot exceed the reviewed contract value' using errcode='23514';
    end if;
    if v_gross is not null and v_deposit is not null and v_deposit > v_gross then
      raise exception 'Deposit cannot exceed reviewed gross receipts' using errcode='23514';
    end if;
    if v_gross is not null and v_fee is not null and v_net is not null
      and abs(v_gross - v_fee - v_net) > 0.01 then
      raise exception 'Gross less platform fee must equal net payout' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.os_validate_complete_import_evidence_item() from public, anon, authenticated;

create trigger os_import_item_financial_date_guard
before insert or update of candidate_type, proposed_data on public.os_import_batch_items
for each row execute function private.os_validate_complete_import_evidence_item();

create or replace function private.os_populate_complete_import_payment_fact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_data jsonb;
begin
  select i.proposed_data into v_data
  from public.os_import_batch_items i
  join public.os_import_batches b on b.id = i.batch_id
  where i.id = new.import_batch_item_id
    and i.candidate_type = 'payment_fact'
    and i.status = 'applying'
    and b.contract_version = 'intake_manifest_v2'
    and b.status = 'importing'
    and b.approved_by = auth.uid();
  if v_data is null or auth.uid() is null
    or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner-authorized reviewed payment evidence required' using errcode='42501';
  end if;
  new.contracted_or_quoted_amount := nullif(v_data->>'contractedOrQuotedValue','')::numeric;
  new.deposit_received_amount := nullif(v_data->>'depositAmount','')::numeric;
  new.tip_amount := nullif(v_data->>'tipAmount','')::numeric;
  new.overtime_amount := nullif(v_data->>'overtimeAmount','')::numeric;
  new.balance_due_amount := nullif(v_data->>'balanceDue','')::numeric;
  return new;
end;
$$;

revoke all on function private.os_populate_complete_import_payment_fact() from public, anon, authenticated;

create trigger os_payment_fact_complete_import_evidence
before insert on public.os_booking_payment_facts
for each row execute function private.os_populate_complete_import_payment_fact();

create or replace function private.os_correct_complete_import_booking_financials()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fact public.os_booking_payment_facts%rowtype;
begin
  if coalesce(old.metadata->>'suppressAutomations','false') <> 'true'
    or coalesce(new.metadata->>'suppressAutomations','false') <> 'true' then
    return new;
  end if;
  select f.* into v_fact
  from public.os_booking_payment_facts f
  join public.os_import_batch_items i on i.id = f.import_batch_item_id
  join public.os_import_batches b on b.id = i.batch_id
  where f.booking_id = old.id
    and f.status = 'active'
    and i.status = 'applying'
    and b.status = 'importing'
    and b.contract_version = 'intake_manifest_v2'
    and b.approved_by = auth.uid()
  order by f.created_at desc, f.id desc
  limit 1;
  if not found or auth.uid() is null
    or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner-authorized reviewed payment evidence required' using errcode='42501';
  end if;
  new.payment_status := v_fact.payment_status;
  new.total_amount := v_fact.contracted_or_quoted_amount;
  new.deposit_amount := v_fact.deposit_received_amount;
  new.balance_due := v_fact.balance_due_amount;
  return new;
end;
$$;

revoke all on function private.os_correct_complete_import_booking_financials() from public, anon, authenticated;

create trigger os_booking_complete_import_financial_integrity
before update of payment_status, total_amount, deposit_amount, balance_due on public.os_bookings
for each row execute function private.os_correct_complete_import_booking_financials();

create or replace function private.os_populate_complete_import_historical_date()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_date text;
begin
  if new.source <> 'reviewed_intake' then return new; end if;
  select i.proposed_data->>'historicalDate' into v_date
  from public.os_import_batch_items i
  join public.os_import_batches b on b.id = i.batch_id
  where i.batch_id = (new.settings->>'importBatchId')::uuid
    and i.candidate_type = 'event'
    and i.source_hash = new.settings->>'sourceHash'
    and i.proposed_data->>'title' = new.title
    and i.status = 'applying'
    and b.contract_version = 'intake_manifest_v2'
    and b.status = 'importing'
    and b.approved_by = auth.uid()
  order by i.id
  limit 1;
  if nullif(v_date,'') is not null then
    if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') then
      raise exception 'Owner-authorized reviewed date evidence required' using errcode='42501';
    end if;
    new.historical_date := v_date::date;
    new.starts_at := null;
    new.ends_at := null;
    new.timezone := null;
  end if;
  return new;
end;
$$;

revoke all on function private.os_populate_complete_import_historical_date() from public, anon, authenticated;

create trigger os_event_complete_import_historical_date
before insert on public.os_events
for each row execute function private.os_populate_complete_import_historical_date();

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
      union all select id,'same_title_and_start' from public.os_events where nullif(p_data->>'startsAt','') is not null and lower(title)=lower(p_data->>'title') and starts_at = (p_data->>'startsAt')::timestamptz and id is distinct from v_target
      union all select id,'same_title_and_historical_date' from public.os_events where nullif(p_data->>'historicalDate','') is not null and lower(title)=lower(p_data->>'title') and historical_date = (p_data->>'historicalDate')::date and id is distinct from v_target
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

create or replace function public.os_data_readiness_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  return jsonb_build_object(
    'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc,c.id) from (select id,display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,status,notes,source,updated_at from public.os_contacts order by updated_at desc,id limit 200) c),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.updated_at desc,e.id) from (select id,primary_contact_id,title,event_type,status,starts_at,ends_at,historical_date,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,updated_at from public.os_events order by updated_at desc,id limit 200) e),'[]'::jsonb),
    'leads',coalesce((select jsonb_agg(to_jsonb(l) order by l.updated_at desc,l.id) from (select id,contact_id,event_id,status,source,next_follow_up_at,updated_at from public.os_leads order by updated_at desc,id limit 200) l),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from (select id,code,name,'active'::text as status from public.os_service_catalog where is_active is true order by name,id) s),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.updated_at desc,b.id) from (select id,event_id,status,contract_status,payment_status,total_amount,deposit_amount,balance_due,updated_at from public.os_bookings order by updated_at desc,id limit 200) b),'[]'::jsonb),
    'paymentFacts',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc,f.id) from (select id,booking_id,contracted_or_quoted_amount,gross_client_amount,deposit_received_amount,tip_amount,overtime_amount,platform_fee_amount,net_payout_amount,payment_method,payment_status,payout_status,currency,status,created_at from public.os_booking_payment_facts order by created_at desc,id limit 500) f),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select id,status,row_count,created_count,skipped_count,error_count,contract_version,manifest_hash,source_label,summary,created_at,approved_at,rollback_at from public.os_import_batches where contract_version in ('intake_manifest_v1','intake_manifest_v2') order by created_at desc limit 30) b),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from (select id,batch_id,item_key,candidate_type,source_ref,source_hash,uncertain_fields,duplicate_warnings,status,canonical_record_ids,error_code,created_at,applied_at from public.os_import_batch_items order by created_at desc limit 1000) i),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc,a.id) from (select id,event_id,contact_id,event_type,occurred_at from public.os_activity_events where event_type like 'data_readiness.%' order by occurred_at desc,id limit 100) a),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.os_data_readiness_snapshot() from public, anon, authenticated;
grant execute on function public.os_data_readiness_snapshot() to authenticated, service_role;

-- Rollback: restore the prior snapshot and duplicate-warning definitions; drop
-- these four private trigger functions and triggers; then drop the date index,
-- additive columns, and constraints. Never delete imported or audit history.
