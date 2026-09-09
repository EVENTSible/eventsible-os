create unique index if not exists os_booking_services_quote_item_unique
on public.os_booking_services(booking_id, quote_item_id)
where quote_item_id is not null;

create unique index if not exists os_message_threads_event_type_unique
on public.os_message_threads(event_id, thread_type);

create or replace function private.os_bootstrap_confirmed_booking()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_event public.os_events%rowtype;
  target_template_id uuid;
  target_assignment_id uuid;
  service_payload jsonb;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  select * into target_event
  from public.os_events
  where id = new.event_id
  for update;

  if not found then
    raise exception 'Cannot bootstrap booking %, event % does not exist', new.id, new.event_id;
  end if;

  update public.os_events
  set status = case
      when status in ('completed','cancelled','archived') then status
      else 'planning'
    end,
    updated_at = now()
  where id = new.event_id;

  if new.accepted_quote_version_id is not null then
    insert into public.os_booking_services(
      booking_id,quote_item_id,service_id,service_code,service_name,status,
      starts_at,ends_at,configuration
    )
    select
      new.id,qi.id,qi.service_id,qi.service_code,qi.service_name,'planning',
      target_event.starts_at,target_event.ends_at,
      jsonb_build_object(
        'quantity', qi.quantity,
        'unit', qi.unit,
        'unit_price', qi.unit_price,
        'line_total', qi.line_total,
        'quote_metadata', qi.metadata
      )
    from public.os_quote_items qi
    where qi.quote_version_id = new.accepted_quote_version_id
    on conflict (booking_id, quote_item_id) where quote_item_id is not null
    do update set
      service_id = excluded.service_id,
      service_code = excluded.service_code,
      service_name = excluded.service_name,
      status = 'planning',
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      configuration = excluded.configuration,
      updated_at = now();
  end if;

  if target_event.primary_contact_id is not null then
    insert into public.os_event_members(
      event_id,contact_id,member_role,permissions,is_active,invited_at
    )
    values(
      new.event_id,
      target_event.primary_contact_id,
      'client',
      '{"portal":true,"planning":true,"messages":true,"files":true}'::jsonb,
      true,
      now()
    )
    on conflict (event_id, contact_id, member_role) where contact_id is not null
    do update set
      permissions = excluded.permissions,
      is_active = true,
      invited_at = coalesce(public.os_event_members.invited_at, excluded.invited_at),
      updated_at = now();
  end if;

  select pt.id into target_template_id
  from public.os_planning_templates pt
  where pt.status = 'published'
    and pt.version = 1
    and pt.slug = case
      when lower(target_event.event_type) like '%wedding%' then 'wedding-hero'
      else 'event-hero'
    end
  order by pt.created_at desc
  limit 1;

  if target_template_id is null then
    raise exception 'No published Hero template is available for event type %', target_event.event_type;
  end if;

  insert into public.os_planning_assignments(
    event_id,template_id,status,progress_percent,assigned_at,settings
  )
  values(
    new.event_id,target_template_id,'assigned',0,now(),
    jsonb_build_object(
      'booking_id', new.id,
      'accepted_quote_version_id', new.accepted_quote_version_id,
      'auto_assigned', true
    )
  )
  on conflict(event_id, template_id)
  do update set
    status = case
      when public.os_planning_assignments.status in ('submitted','locked') then public.os_planning_assignments.status
      else 'assigned'
    end,
    settings = public.os_planning_assignments.settings || excluded.settings,
    updated_at = now()
  returning id into target_assignment_id;

  insert into public.os_message_threads(event_id, subject, thread_type, status)
  values(new.event_id, 'EVENTSible Event Planning', 'client', 'open')
  on conflict(event_id, thread_type)
  do update set status = 'open', updated_at = now();

  insert into public.os_event_facts(event_id, fact_key, value, source, source_reference, is_confirmed)
  values
    (new.event_id, 'event.title', to_jsonb(target_event.title), 'system', 'event:' || new.event_id::text, true),
    (new.event_id, 'event.type', to_jsonb(target_event.event_type), 'system', 'event:' || new.event_id::text, true),
    (new.event_id, 'event.starts_at', coalesce(to_jsonb(target_event.starts_at),'null'::jsonb), 'system', 'event:' || new.event_id::text, target_event.starts_at is not null),
    (new.event_id, 'event.ends_at', coalesce(to_jsonb(target_event.ends_at),'null'::jsonb), 'system', 'event:' || new.event_id::text, target_event.ends_at is not null),
    (new.event_id, 'event.guest_count', coalesce(to_jsonb(target_event.guest_count),'null'::jsonb), 'system', 'event:' || new.event_id::text, target_event.guest_count is not null),
    (new.event_id, 'venue.name', coalesce(to_jsonb(target_event.venue_name),'null'::jsonb), 'system', 'event:' || new.event_id::text, target_event.venue_name is not null),
    (new.event_id, 'venue.address', jsonb_build_object(
      'address_1', target_event.venue_address_1,
      'address_2', target_event.venue_address_2,
      'city', target_event.venue_city,
      'state', target_event.venue_state,
      'postal_code', target_event.venue_postal_code,
      'country', target_event.venue_country
    ), 'system', 'event:' || new.event_id::text, target_event.venue_address_1 is not null),
    (new.event_id, 'booking.total_amount', coalesce(to_jsonb(new.total_amount),'null'::jsonb), 'quote', 'booking:' || new.id::text, new.total_amount is not null),
    (new.event_id, 'booking.deposit_amount', coalesce(to_jsonb(new.deposit_amount),'null'::jsonb), 'quote', 'booking:' || new.id::text, new.deposit_amount is not null)
  on conflict(event_id, fact_key)
  do update set
    value = excluded.value,
    source = excluded.source,
    source_reference = excluded.source_reference,
    is_confirmed = excluded.is_confirmed,
    updated_at = now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', bs.service_code,
        'name', bs.service_name,
        'status', bs.status,
        'configuration', bs.configuration
      ) order by bs.created_at
    ),
    '[]'::jsonb
  ) into service_payload
  from public.os_booking_services bs
  where bs.booking_id = new.id and bs.status <> 'cancelled';

  insert into public.os_event_facts(event_id, fact_key, value, source, source_reference, is_confirmed)
  values(new.event_id, 'booking.services', service_payload, 'quote', 'booking:' || new.id::text, true)
  on conflict(event_id, fact_key)
  do update set
    value = excluded.value,
    source = excluded.source,
    source_reference = excluded.source_reference,
    is_confirmed = true,
    updated_at = now();

  insert into public.os_planning_answers(
    assignment_id,question_id,question_key,value,source,is_confirmed
  )
  select
    target_assignment_id,pq.id,pq.question_key,ef.value,ef.source,ef.is_confirmed
  from public.os_planning_questions pq
  join public.os_planning_sections ps on ps.id = pq.section_id
  join public.os_event_facts ef
    on ef.event_id = new.event_id
   and ef.fact_key = pq.writeback_fact_key
  where ps.template_id = target_template_id
    and pq.writeback_fact_key is not null
  on conflict(assignment_id, question_key)
  do update set
    question_id = excluded.question_id,
    value = case
      when public.os_planning_answers.source in ('client','owner','staff') then public.os_planning_answers.value
      else excluded.value
    end,
    source = case
      when public.os_planning_answers.source in ('client','owner','staff') then public.os_planning_answers.source
      else excluded.source
    end,
    is_confirmed = case
      when public.os_planning_answers.source in ('client','owner','staff') then public.os_planning_answers.is_confirmed
      else excluded.is_confirmed
    end,
    updated_at = now();

  perform private.os_emit_event(
    new.event_id,
    'planning.assigned',
    jsonb_build_object('booking_id',new.id,'assignment_id',target_assignment_id,'template_id',target_template_id),
    'booking:' || new.id::text || ':planning-assigned',
    'shared'
  );

  perform private.os_emit_event(
    new.event_id,
    'portal.ready',
    jsonb_build_object('booking_id',new.id,'primary_contact_id',target_event.primary_contact_id,'assignment_id',target_assignment_id),
    'booking:' || new.id::text || ':portal-ready',
    'shared'
  );

  perform private.os_emit_event(
    new.event_id,
    'client.welcome.requested',
    jsonb_build_object(
      'booking_id',new.id,
      'primary_contact_id',target_event.primary_contact_id,
      'assignment_id',target_assignment_id,
      'email_template',case when lower(target_event.event_type) like '%wedding%' then 'wedding_booking_welcome' else 'event_booking_welcome' end
    ),
    'booking:' || new.id::text || ':welcome-requested',
    'system'
  );

  return new;
end;
$$;

revoke all on function private.os_bootstrap_confirmed_booking() from public, anon, authenticated;

create trigger os_booking_bootstrap
after insert or update on public.os_bookings
for each row execute function private.os_bootstrap_confirmed_booking();