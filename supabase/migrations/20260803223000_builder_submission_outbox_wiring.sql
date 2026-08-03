-- EVENTSible OS Builder intake-to-outbox wiring.
-- Additive wiring only: observes the existing successful Builder activity event
-- and enqueues one privacy-minimized integration event per Builder submission.
--
-- Scope:
-- - Adds public.os_enqueue_builder_submission_received_from_activity()
-- - Adds one AFTER INSERT trigger on public.os_activity_events
-- - Does not replace public.os_ingest_builder_submission(payload jsonb)
-- - Does not mutate contacts, leads, events, quotes, bookings, or customer data

-- Fail with a precise migration-order error if the outbox foundation/helper has
-- not been created before this wiring migration runs.
do $$
begin
  if to_regclass('public.os_activity_events') is null then
    raise exception 'Expected activity table public.os_activity_events is missing before Builder outbox wiring migration.';
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
  builder_submission_id_value uuid;
  lead_id_value uuid;
  quote_id_value uuid;
  quote_version_id_value uuid;
  contact_id_value uuid;
  submission_record public.os_builder_submissions%rowtype;
  event_record public.os_events%rowtype;
  quote_record public.os_quote_versions%rowtype;
  service_codes jsonb := '[]'::jsonb;
  custom_quote_service_codes jsonb := '[]'::jsonb;
  total_cents integer;
  travel_cents integer;
  package_savings_cents integer;
begin
  if new.event_type <> 'builder.submission_received' then
    return new;
  end if;

  builder_submission_id_value := nullif(new.payload->>'submission_id', '')::uuid;
  lead_id_value := nullif(new.payload->>'lead_id', '')::uuid;
  quote_id_value := nullif(new.payload->>'quote_id', '')::uuid;

  if new.event_id is null or builder_submission_id_value is null or lead_id_value is null then
    raise exception using
      errcode = '22023',
      message = 'Builder submission activity is missing related IDs required for integration outbox emission.';
  end if;

  select *
    into submission_record
    from public.os_builder_submissions
   where id = builder_submission_id_value
   limit 1;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Builder submission activity references a missing Builder submission.';
  end if;

  select *
    into event_record
    from public.os_events
   where id = new.event_id
   limit 1;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Builder submission activity references a missing event.';
  end if;

  contact_id_value := coalesce(new.contact_id, submission_record.contact_id, event_record.primary_contact_id);

  select *
    into quote_record
    from public.os_quote_versions
   where event_id = new.event_id
     and (lead_id = lead_id_value or lead_id is null)
     and (quote_id_value is null or id = quote_id_value or quote_id = quote_id_value)
   order by version_number desc, created_at desc
   limit 1;

  if found then
    quote_version_id_value := quote_record.id;
    quote_id_value := coalesce(quote_record.quote_id, quote_record.id);
    total_cents := round(coalesce(quote_record.total_amount, 0) * 100)::integer;
    travel_cents := round(coalesce(quote_record.travel_amount, 0) * 100)::integer;
    package_savings_cents := round(coalesce(quote_record.discount_amount, 0) * 100)::integer;

    select
      coalesce(jsonb_agg(qi.service_code order by qi.created_at, qi.id), '[]'::jsonb),
      coalesce(
        jsonb_agg(qi.service_code order by qi.created_at, qi.id)
          filter (
            where coalesce((qi.metadata #>> '{builder_item,custom_quote}')::boolean, false)
               or coalesce(qi.line_total, 0) = 0
          ),
        '[]'::jsonb
      )
      into service_codes, custom_quote_service_codes
      from public.os_quote_items qi
     where qi.quote_version_id = quote_version_id_value;
  end if;

  perform public.os_enqueue_integration_event(
    'builder.submission_received',
    'builder_submission_received_v1',
    'eventsible-event-builder',
    jsonb_strip_nulls(jsonb_build_object(
      'contact_id', contact_id_value,
      'builder_submission_id', builder_submission_id_value,
      'lead_id', lead_id_value,
      'event_id', new.event_id,
      'quote_id', quote_id_value,
      'quote_version_id', quote_version_id_value,
      'activity_id', new.id
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'contract_version', coalesce(submission_record.normalized_payload->>'contract_version', 'builder_submission_v1'),
      'source', 'eventsible-event-builder',
      'event_type', 'builder.submission_received',
      'selected_package_tier', submission_record.normalized_payload #>> '{recommended_package,tier}',
      'service_codes', service_codes,
      'custom_quote_service_codes', custom_quote_service_codes,
      'total_cents', total_cents,
      'travel_cents', travel_cents,
      'package_savings_cents', package_savings_cents,
      'planning_stage', submission_record.normalized_payload->>'planning_stage',
      'date_confidence', submission_record.normalized_payload->>'date_confidence'
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
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'os_activity_events_builder_submission_outbox_trg'
       and tgrelid = 'public.os_activity_events'::regclass
  ) then
    execute '
      create trigger os_activity_events_builder_submission_outbox_trg
      after insert on public.os_activity_events
      for each row
      when (new.event_type = ''builder.submission_received'')
      execute function public.os_enqueue_builder_submission_received_from_activity()
    ';
  end if;
end $$;