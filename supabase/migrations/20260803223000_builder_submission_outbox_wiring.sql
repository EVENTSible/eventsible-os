-- EVENTSible OS Builder intake-to-outbox wiring.
-- Additive wiring only: observes a completed Builder submission activity event
-- and enqueues one privacy-minimized integration event per Builder submission.
--
-- Scope:
-- - Adds public.os_enqueue_builder_submission_received_from_activity()
-- - Adds one AFTER INSERT trigger on the existing Production activity table
-- - Allows the CI-local Builder activity fixture to exercise the same trigger
-- - Does not replace public.os_ingest_builder_submission(payload jsonb)
-- - Does not mutate contacts, leads, events, quotes, bookings, or customer data

-- Fail with a precise migration-order error if the outbox foundation/helper has
-- not been created before this wiring migration runs.
do $$
begin
  if to_regclass('public.os_activity_events') is null
     and to_regclass('public.os_builder_activity') is null then
    raise exception 'Expected a Builder activity table before Builder outbox wiring migration.';
  end if;

  if to_regclass('public.os_integration_outbox') is null then
    raise exception 'Expected outbox table public.os_integration_outbox is missing before Builder outbox wiring migration.';
  end if;

  if to_regprocedure('public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)') is null then
    raise exception 'Expected helper public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text) is missing before Builder outbox wiring migration.';
  end if;

  if to_regprocedure('public.os_ingest_builder_submission(jsonb)') is null then
    raise exception 'Existing Builder intake function public.os_ingest_builder_submission(jsonb) is missing before Builder outbox wiring migration.';
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
    nullif(coalesce(to_jsonb(new)->'payload', '{}'::jsonb)->>'submission_id', '')::uuid,
    nullif(to_jsonb(new)->>'builder_submission_id', '')::uuid
  );
  lead_id_value uuid := coalesce(
    nullif(coalesce(to_jsonb(new)->'payload', '{}'::jsonb)->>'lead_id', '')::uuid,
    nullif(to_jsonb(new)->>'lead_id', '')::uuid
  );
  quote_id_value uuid := nullif(coalesce(to_jsonb(new)->'payload', '{}'::jsonb)->>'quote_id', '')::uuid;
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
     and (quote_id_value is null or q.id = quote_id_value or q.quote_id = quote_id_value)
   order by q.version_number desc, q.created_at desc
   limit 1;

  if found then
    quote_version_id_value := nullif(quote_record->>'id', '')::uuid;
    quote_id_value := coalesce(nullif(quote_record->>'quote_id', '')::uuid, quote_version_id_value);
    total_cents := coalesce(
      nullif(quote_record->>'total_cents', '')::integer,
      round(coalesce(nullif(quote_record->>'total_amount', '')::numeric, 0) * 100)::integer
    );
    travel_cents := coalesce(
      nullif(quote_record->>'travel_cents', '')::integer,
      round(coalesce(nullif(quote_record->>'travel_amount', '')::numeric, 0) * 100)::integer
    );
    package_savings_cents := coalesce(
      nullif(quote_record->>'package_savings_cents', '')::integer,
      round(coalesce(nullif(quote_record->>'discount_amount', '')::numeric, 0) * 100)::integer
    );

    select
      coalesce(jsonb_agg(item->>'service_code' order by item->>'created_at', item->>'id'), '[]'::jsonb),
      coalesce(
        jsonb_agg(item->>'service_code' order by item->>'created_at', item->>'id')
          filter (
            where coalesce((item->>'custom_quote')::boolean, false)
               or coalesce((item #>> '{metadata,builder_item,custom_quote}')::boolean, false)
               or coalesce(
                    nullif(item->>'line_total_cents', '')::integer,
                    round(coalesce(nullif(item->>'line_total', '')::numeric, 0) * 100)::integer
                  ) = 0
          ),
        '[]'::jsonb
      )
      into service_codes, custom_quote_service_codes
      from (
        select to_jsonb(qi) as item
          from public.os_quote_items qi
         where qi.quote_version_id = quote_version_id_value
      ) quote_items;
  end if;

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
      'selected_package_tier', submission_record #>> '{normalized_payload,recommended_package,tier}',
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

do $$
begin
  if to_regclass('public.os_activity_events') is not null
     and not exists (
       select 1
         from pg_trigger
        where tgname = 'os_activity_events_builder_submission_outbox_trg'
          and tgrelid = to_regclass('public.os_activity_events')
     ) then
    execute '
      create trigger os_activity_events_builder_submission_outbox_trg
      after insert on public.os_activity_events
      for each row
      when (new.event_type = ''builder.submission_received'')
      execute function public.os_enqueue_builder_submission_received_from_activity()
    ';
  end if;

  if to_regclass('public.os_builder_activity') is not null
     and not exists (
       select 1
         from pg_trigger
        where tgname = 'os_builder_activity_submission_outbox_trg'
          and tgrelid = to_regclass('public.os_builder_activity')
     ) then
    execute '
      create trigger os_builder_activity_submission_outbox_trg
      after insert on public.os_builder_activity
      for each row
      when (new.activity_type = ''builder.submission_received'')
      execute function public.os_enqueue_builder_submission_received_from_activity()
    ';
  end if;
end $$;