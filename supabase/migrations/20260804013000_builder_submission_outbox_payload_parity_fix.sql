-- EVENTSible OS Builder outbox payload parity forward-fix.
--
-- Scope:
-- - Replaces only public.os_enqueue_builder_submission_received_from_activity()
-- - Keeps the existing trigger object and its enabled/disabled state unchanged
-- - Omits quote_id unless a genuine quote_id exists on the quote row projection
-- - Derives package savings from Builder pricing snapshots when the quote total is already net of savings
-- - Canonicalizes public-safe Builder service codes for outbox automation
-- - Does not mutate contacts, leads, events, quote records, bookings, outbox rows, or customer data

-- Fail early if the already-reviewed outbox/wiring foundation is not present.
do $$
begin
  if to_regclass('public.os_integration_outbox') is null then
    raise exception 'Expected outbox table public.os_integration_outbox is missing before Builder payload parity fix.';
  end if;

  if to_regprocedure('public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)') is null then
    raise exception 'Expected helper public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text) is missing before Builder payload parity fix.';
  end if;

  if to_regprocedure('public.os_ingest_builder_submission(jsonb)') is null then
    raise exception 'Existing Builder intake function public.os_ingest_builder_submission(jsonb) is missing before Builder payload parity fix.';
  end if;

  if to_regprocedure('public.os_enqueue_builder_submission_received_from_activity()') is null then
    raise exception 'Expected Builder outbox wiring helper is missing before Builder payload parity fix.';
  end if;
end $$;

create or replace function public.os_enqueue_builder_submission_received_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  activity_record jsonb := to_jsonb(new);
  activity_payload jsonb := coalesce(to_jsonb(new)->'payload', to_jsonb(new)->'facts', '{}'::jsonb);
  activity_event_type text := coalesce(to_jsonb(new)->>'event_type', to_jsonb(new)->>'activity_type');
  event_id_value uuid := nullif(to_jsonb(new)->>'event_id', '')::uuid;
  builder_submission_id_value uuid := coalesce(
    nullif(activity_payload->>'submission_id', '')::uuid,
    nullif(to_jsonb(new)->>'builder_submission_id', '')::uuid
  );
  lead_id_value uuid := coalesce(
    nullif(activity_payload->>'lead_id', '')::uuid,
    nullif(to_jsonb(new)->>'lead_id', '')::uuid
  );
  activity_quote_id_value uuid := nullif(activity_payload->>'quote_id', '')::uuid;
  quote_id_value uuid;
  quote_version_id_value uuid;
  contact_id_value uuid := nullif(to_jsonb(new)->>'contact_id', '')::uuid;
  submission_record jsonb;
  event_record jsonb;
  quote_record jsonb;
  service_codes jsonb := '[]'::jsonb;
  custom_quote_service_codes jsonb := '[]'::jsonb;
  total_cents integer;
  travel_cents integer;
  package_savings_cents integer;
begin
  if activity_event_type <> 'builder.submission_received' then
    return new;
  end if;

  if event_id_value is null or builder_submission_id_value is null or lead_id_value is null then
    raise exception using
      errcode = '22023',
      message = 'Builder submission activity is missing related IDs required for integration outbox emission.';
  end if;

  select to_jsonb(s)
    into submission_record
    from public.os_builder_submissions s
   where s.id = builder_submission_id_value
   limit 1;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Builder submission activity references a missing Builder submission.';
  end if;

  select to_jsonb(e)
    into event_record
    from public.os_events e
   where e.id = event_id_value
   limit 1;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Builder submission activity references a missing event.';
  end if;

  contact_id_value := coalesce(
    contact_id_value,
    nullif(submission_record->>'contact_id', '')::uuid,
    nullif(event_record->>'primary_contact_id', '')::uuid
  );

  select to_jsonb(q)
    into quote_record
    from public.os_quote_versions q
   where q.event_id = event_id_value
     and (q.lead_id = lead_id_value or q.lead_id is null)
     and (activity_quote_id_value is null or q.id = activity_quote_id_value)
   order by q.version_number desc, q.created_at desc
   limit 1;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Builder submission activity references a missing quote version.';
  end if;

  quote_version_id_value := nullif(quote_record->>'id', '')::uuid;

  -- Production activity payloads may use quote_id to carry the quote version ID.
  -- Do not expose that as a genuine quote_id; include quote_id only when the row
  -- projection itself contains one.
  quote_id_value := nullif(quote_record->>'quote_id', '')::uuid;

  total_cents := coalesce(
    nullif(quote_record->>'total_cents', '')::integer,
    nullif(round(nullif(quote_record #>> '{snapshot,pricing,estimated_total}', '')::numeric * 100)::integer, 0),
    nullif(round(nullif(quote_record #>> '{metadata,pricing,estimated_total}', '')::numeric * 100)::integer, 0),
    nullif(round(nullif(submission_record #>> '{normalized_payload,pricing,estimated_total}', '')::numeric * 100)::integer, 0),
    round(coalesce(nullif(quote_record->>'total_amount', '')::numeric, 0) * 100)::integer
  );
  travel_cents := coalesce(
    nullif(quote_record->>'travel_cents', '')::integer,
    nullif(round(nullif(quote_record #>> '{snapshot,pricing,travel_fee}', '')::numeric * 100)::integer, 0),
    nullif(round(nullif(quote_record #>> '{metadata,pricing,travel_fee}', '')::numeric * 100)::integer, 0),
    nullif(round(nullif(submission_record #>> '{normalized_payload,pricing,travel_fee}', '')::numeric * 100)::integer, 0),
    round(coalesce(nullif(quote_record->>'travel_amount', '')::numeric, 0) * 100)::integer
  );
  package_savings_cents := coalesce(
    nullif(round(nullif(quote_record #>> '{snapshot,pricing,package_savings}', '')::numeric * 100)::integer, 0),
    nullif(quote_record #>> '{snapshot,pricing,package_savings_cents}', '')::integer,
    nullif(round(nullif(quote_record #>> '{metadata,pricing,package_savings}', '')::numeric * 100)::integer, 0),
    nullif(quote_record #>> '{metadata,pricing,package_savings_cents}', '')::integer,
    nullif(round(nullif(submission_record #>> '{normalized_payload,pricing,package_savings}', '')::numeric * 100)::integer, 0),
    nullif(submission_record #>> '{normalized_payload,pricing,package_savings_cents}', '')::integer,
    nullif(quote_record->>'package_savings_cents', '')::integer,
    round(coalesce(nullif(quote_record->>'discount_amount', '')::numeric, 0) * 100)::integer
  );

  with selected_services as (
    select value as item, ordinality::integer as sort_order
      from jsonb_array_elements(coalesce(submission_record #> '{normalized_payload,selected_services}', '[]'::jsonb)) with ordinality
  ), quote_item_services as (
    select to_jsonb(qi) as item, (1000 + row_number() over (order by qi.created_at, qi.id))::integer as sort_order
      from public.os_quote_items qi
     where qi.quote_version_id = quote_version_id_value
       and not exists (select 1 from selected_services)
  ), all_services as (
    select item, sort_order from selected_services
    union all
    select item, sort_order from quote_item_services
  ), canonical_services as (
    select
      sort_order,
      case
        when coalesce(item->>'id', item->>'service_id', item #>> '{metadata,builder_item,lovable_service_id}') in ('selfie-booth-prints', 'selfie-booth-prints-weekday')
          or coalesce(item->>'name', item->>'service_name') ilike '%Selfie Booth with Prints%'
          then 'selfie_booth_prints'
        when coalesce(item->>'id', item->>'service_id', item #>> '{metadata,builder_item,lovable_service_id}') = 'event-asst'
          or coalesce(item->>'name', item->>'service_name') ilike 'Event Assistant%'
          then 'event_staff'
        else coalesce(
          nullif(item->>'service_code', ''),
          nullif(item->>'code', ''),
          nullif(item #>> '{metadata,builder_item,service_code}', ''),
          nullif(item->>'service_id', ''),
          nullif(item->>'id', ''),
          'custom_service'
        )
      end as canonical_code,
      coalesce((item->>'custom_quote')::boolean, false)
        or coalesce((item #>> '{metadata,builder_item,custom_quote}')::boolean, false)
        or coalesce((item #>> '{metadata,custom_quote}')::boolean, false)
        or coalesce(
             nullif(item->>'line_total_cents', '')::integer,
             round(coalesce(nullif(item->>'line_total', '')::numeric, 0) * 100)::integer
           ) = 0 as is_custom_quote
    from all_services
  )
  select
    coalesce(jsonb_agg(canonical_code order by sort_order), '[]'::jsonb),
    coalesce(jsonb_agg(canonical_code order by sort_order) filter (where is_custom_quote), '[]'::jsonb)
    into service_codes, custom_quote_service_codes
    from canonical_services;

  perform public.os_enqueue_integration_event(
    'builder.submission_received',
    'builder_submission_received_v1',
    'eventsible-event-builder',
    jsonb_strip_nulls(jsonb_build_object(
      'contact_id', contact_id_value,
      'builder_submission_id', builder_submission_id_value,
      'lead_id', lead_id_value,
      'event_id', event_id_value,
      'quote_id', quote_id_value,
      'quote_version_id', quote_version_id_value,
      'activity_id', activity_record->>'id'
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'contract_version', coalesce(submission_record #>> '{normalized_payload,contract_version}', 'builder_submission_v1'),
      'source', 'eventsible-event-builder',
      'event_type', 'builder.submission_received',
      'selected_package_tier', coalesce(submission_record #>> '{normalized_payload,recommended_package,tier}', quote_record #>> '{snapshot,recommended_package,tier}', quote_record #>> '{metadata,recommended_package,tier}'),
      'service_codes', service_codes,
      'custom_quote_service_codes', custom_quote_service_codes,
      'total_cents', total_cents,
      'travel_cents', travel_cents,
      'package_savings_cents', package_savings_cents,
      'planning_stage', submission_record #>> '{normalized_payload,planning_stage}',
      'date_confidence', submission_record #>> '{normalized_payload,date_confidence}'
    )),
    'builder.submission_received:' || builder_submission_id_value::text
  );

  return new;
end;
$$;

revoke all on function public.os_enqueue_builder_submission_received_from_activity() from public;
revoke execute on function public.os_enqueue_builder_submission_received_from_activity() from anon;
revoke execute on function public.os_enqueue_builder_submission_received_from_activity() from authenticated;
grant execute on function public.os_enqueue_builder_submission_received_from_activity() to service_role;
