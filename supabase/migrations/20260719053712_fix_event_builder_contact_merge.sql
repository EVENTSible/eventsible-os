create or replace function public.os_ingest_builder_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
as $function$
declare
  raw_payload jsonb := coalesce(payload->'raw_payload', '{}'::jsonb);
  normalized jsonb := coalesce(payload->'normalized_payload', '{}'::jsonb);
  source_session text := nullif(payload->>'source_session_id', '');
  intake_source text := coalesce(nullif(payload->>'source', ''), 'lovable_event_builder');
  fingerprint text := nullif(payload->>'request_fingerprint', '');
  origin_label text := nullif(payload->>'submitted_from', '');
  intake_ver integer := greatest(coalesce((payload->>'intake_version')::integer, 1), 1);
  contact_name_value text := nullif(normalized #>> '{contact,name}', '');
  contact_email_value text := lower(nullif(normalized #>> '{contact,email}', ''));
  contact_phone_value text := nullif(normalized #>> '{contact,phone}', '');
  organization_name_value text := nullif(normalized #>> '{contact,organization}', '');
  event_title_value text := nullif(normalized->>'event_title', '');
  target_event_type text := coalesce(nullif(normalized->>'event_type', ''), 'Private Party');
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  guest_count_value integer;
  estimated_total numeric;
  estimated_deposit numeric;
  target_contact_id uuid;
  target_submission_id uuid;
  target_event_id uuid;
  target_lead_id uuid;
  target_quote_id uuid;
  existing_submission_id uuid;
  selected_services jsonb := coalesce(normalized->'selected_services', '[]'::jsonb);
  service_item jsonb;
  service_code_value text;
  service_name_value text;
  service_category_value text;
  service_id_value uuid;
  quantity_value numeric;
  unit_value text;
  unit_price_value numeric;
  line_total_value numeric;
begin
  if current_user <> 'service_role' then raise exception 'service_role required'; end if;
  if source_session is null then raise exception 'source_session_id is required'; end if;

  select id into existing_submission_id from public.os_builder_submissions where source_session_id = source_session limit 1;
  if existing_submission_id is not null then
    select e.id, l.id into target_event_id, target_lead_id
    from public.os_builder_submissions bs
    left join public.os_events e on e.builder_submission_id = bs.id
    left join lateral (select id from public.os_leads where builder_submission_id = bs.id order by created_at desc limit 1) l on true
    where bs.id = existing_submission_id;
    return jsonb_build_object('duplicate',true,'submission_id',existing_submission_id,'event_id',target_event_id,'lead_id',target_lead_id);
  end if;

  if contact_name_value is null then raise exception 'contact name is required'; end if;
  if contact_email_value is null and contact_phone_value is null then raise exception 'contact email or phone is required'; end if;

  begin starts_at_value := nullif(normalized->>'starts_at','')::timestamptz; exception when others then starts_at_value := null; end;
  begin ends_at_value := nullif(normalized->>'ends_at','')::timestamptz; exception when others then ends_at_value := null; end;
  begin guest_count_value := nullif(normalized->>'guest_count','')::integer; exception when others then guest_count_value := null; end;
  begin estimated_total := coalesce(nullif(normalized #>> '{pricing,estimated_total}','')::numeric,nullif(normalized->>'estimated_total','')::numeric); exception when others then estimated_total := null; end;
  begin estimated_deposit := coalesce(nullif(normalized #>> '{pricing,deposit_amount}','')::numeric,nullif(normalized->>'deposit_amount','')::numeric); exception when others then estimated_deposit := null; end;

  if contact_email_value is not null then
    select id into target_contact_id from public.os_contacts where lower(primary_email)=contact_email_value order by updated_at desc limit 1 for update;
  end if;
  if target_contact_id is null and contact_phone_value is not null then
    select id into target_contact_id from public.os_contacts where primary_phone=contact_phone_value order by updated_at desc limit 1 for update;
  end if;

  if target_contact_id is null then
    insert into public.os_contacts(display_name,organization_name,primary_email,primary_phone,preferred_channel,source,metadata)
    values(contact_name_value,organization_name_value,contact_email_value,contact_phone_value,case when contact_email_value is not null then 'email' else 'text' end,intake_source,jsonb_build_object('builder_source_session_id',source_session))
    returning id into target_contact_id;
  else
    update public.os_contacts
    set display_name=coalesce(nullif(display_name,''),contact_name_value),
        organization_name=coalesce(organization_name,organization_name_value),
        primary_email=coalesce(primary_email,contact_email_value),
        primary_phone=coalesce(primary_phone,contact_phone_value),
        metadata=metadata||jsonb_build_object('latest_builder_source_session_id',source_session),updated_at=now()
    where id=target_contact_id;
  end if;

  insert into public.os_builder_submissions(contact_id,source_session_id,event_type,raw_payload,normalized_payload,status,source,request_fingerprint,submitted_from,intake_version)
  values(target_contact_id,source_session,target_event_type,raw_payload,normalized,'normalized',intake_source,fingerprint,origin_label,intake_ver)
  on conflict(source_session_id) where source_session_id is not null do nothing returning id into target_submission_id;
  if target_submission_id is null then
    select id into target_submission_id from public.os_builder_submissions where source_session_id=source_session;
    return jsonb_build_object('duplicate',true,'submission_id',target_submission_id);
  end if;

  event_title_value := coalesce(event_title_value,contact_name_value||' — '||target_event_type||' Inquiry');
  insert into public.os_events(primary_contact_id,builder_submission_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_city,venue_state,venue_postal_code,guest_count,source,settings)
  values(target_contact_id,target_submission_id,event_title_value,target_event_type,'inquiry',starts_at_value,ends_at_value,coalesce(nullif(normalized->>'timezone',''),'America/Indiana/Indianapolis'),nullif(normalized #>> '{venue,name}',''),nullif(normalized #>> '{venue,address_1}',''),nullif(normalized #>> '{venue,city}',''),nullif(normalized #>> '{venue,state}',''),nullif(normalized #>> '{venue,postal_code}',''),guest_count_value,intake_source,jsonb_build_object('builder_source_session_id',source_session,'builder_submission_version',intake_ver,'requested_package',normalized->'recommended_package'))
  returning id into target_event_id;

  insert into public.os_leads(contact_id,event_id,builder_submission_id,status,source,inquiry_summary,estimated_value,metadata)
  values(target_contact_id,target_event_id,target_submission_id,'new',intake_source,coalesce(nullif(normalized->>'inquiry_summary',''),target_event_type||' inquiry from Event Builder'),estimated_total,jsonb_build_object('source_session_id',source_session,'selected_services',selected_services,'recommended_package',normalized->'recommended_package'))
  returning id into target_lead_id;

  if estimated_total is not null or (jsonb_typeof(selected_services)='array' and jsonb_array_length(selected_services)>0) then
    insert into public.os_quote_versions(lead_id,event_id,version_number,status,subtotal,total_amount,deposit_amount,snapshot)
    values(target_lead_id,target_event_id,1,'draft',coalesce(estimated_total,0),coalesce(estimated_total,0),coalesce(estimated_deposit,0),jsonb_build_object('source',intake_source,'source_session_id',source_session,'recommended_package',normalized->'recommended_package','pricing',normalized->'pricing'))
    returning id into target_quote_id;

    if jsonb_typeof(selected_services)='array' then
      for service_item in select value from jsonb_array_elements(selected_services) loop
        if jsonb_typeof(service_item)='string' then
          service_code_value:=trim(both '"' from service_item::text); service_name_value:=service_code_value; quantity_value:=1; unit_value:='flat'; unit_price_value:=0; line_total_value:=0;
        else
          service_code_value:=coalesce(nullif(service_item->>'code',''),nullif(service_item->>'service_code',''),'custom');
          service_name_value:=coalesce(nullif(service_item->>'name',''),nullif(service_item->>'service_name',''),service_code_value);
          begin quantity_value:=coalesce(nullif(service_item->>'quantity','')::numeric,1); exception when others then quantity_value:=1; end;
          unit_value:=coalesce(nullif(service_item->>'unit',''),'flat');
          begin unit_price_value:=coalesce(nullif(service_item->>'unit_price','')::numeric,0); exception when others then unit_price_value:=0; end;
          begin line_total_value:=coalesce(nullif(service_item->>'line_total','')::numeric,quantity_value*unit_price_value); exception when others then line_total_value:=quantity_value*unit_price_value; end;
        end if;
        select id,name,category into service_id_value,service_name_value,service_category_value from public.os_service_catalog where code=service_code_value limit 1;
        insert into public.os_quote_items(quote_version_id,service_id,service_code,service_name,category,quantity,unit,unit_price,line_total,metadata)
        values(target_quote_id,service_id_value,service_code_value,coalesce(service_name_value,service_code_value),service_category_value,quantity_value,unit_value,unit_price_value,line_total_value,jsonb_build_object('builder_item',service_item));
        service_id_value:=null; service_category_value:=null;
      end loop;
    end if;
  end if;

  perform private.os_sync_builder_facts_for_event(target_event_id);
  update public.os_builder_submissions set status='lead_created',processed_at=now(),error_message=null where id=target_submission_id;
  perform private.os_emit_event(target_event_id,'builder.submission_received',jsonb_build_object('submission_id',target_submission_id,'lead_id',target_lead_id,'quote_id',target_quote_id,'source_session_id',source_session,'source',intake_source),'builder:'||source_session||':received','staff');
  return jsonb_build_object('duplicate',false,'submission_id',target_submission_id,'contact_id',target_contact_id,'event_id',target_event_id,'lead_id',target_lead_id,'quote_id',target_quote_id);
end;
$function$;
revoke all on function public.os_ingest_builder_submission(jsonb) from public,anon,authenticated;
grant execute on function public.os_ingest_builder_submission(jsonb) to service_role;