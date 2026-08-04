import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (databaseUrl.includes(productionRef) || databaseUrl.includes("supabase.co")) {
  throw new Error("Refusing to run Production quote-shape verification against a remote or Production Supabase database URL.");
}

const sql = String.raw`
\set ON_ERROR_STOP on

drop index if exists public.os_quote_versions_quote_id_version_idx;
alter table public.os_quote_versions drop column if exists quote_id;

set role service_role;

do $$
declare
  before_counts jsonb;
  after_counts jsonb;
  rollback_before jsonb;
  rollback_after jsonb;
  contact_id_value uuid;
  event_id_value uuid;
  submission_id_value uuid;
  lead_id_value uuid;
  old_quote_version_id uuid;
  quote_version_id_value uuid;
  activity_id_value uuid;
  outbox_id_value uuid;
  outbox_related jsonb;
  outbox_payload jsonb;
begin
  if to_regprocedure('public.os_enqueue_builder_submission_received_from_activity()') is null then
    raise exception 'Builder outbox wiring helper is missing.';
  end if;

  if pg_get_functiondef('public.os_enqueue_builder_submission_received_from_activity()'::regprocedure) ~* '(\Wq|os_quote_versions)\.quote_id' then
    raise exception 'Builder outbox wiring helper still contains a direct physical quote_id reference.';
  end if;


  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'os_quote_versions'
       and column_name = 'quote_id'
  ) then
    raise exception 'Production-shaped quote schema still has quote_id.';
  end if;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into before_counts;

  insert into public.os_contacts(display_name, first_name, last_name, primary_email, preferred_channel, source, metadata)
  values ('EVENTSible Production Quote Shape QA', 'EVENTSible', 'QA', 'production-quote-shape@example.invalid', 'email', 'eventsible_event_builder', '{"synthetic":true}'::jsonb)
  returning id into contact_id_value;

  insert into public.os_events(primary_contact_id, title, event_type, status, starts_at, ends_at, timezone, guest_count, venue_name, venue_city, venue_state, source, settings)
  values (contact_id_value, 'EVENTSible Production Quote Shape QA - Private Party', 'Private Party', 'inquiry', current_date + time '18:00', current_date + time '21:00', 'America/Indiana/Indianapolis', 80, 'Synthetic South Bend Venue', 'South Bend', 'Indiana', 'eventsible_event_builder', jsonb_build_object('planning_stage','Ready for a quote','date_confidence','confirmed'))
  returning id into event_id_value;

  insert into public.os_builder_submissions(contact_id, event_id, source, source_session_id, request_fingerprint, intake_version, contract_version, raw_payload, normalized_payload, submitted_from)
  values (
    contact_id_value,
    event_id_value,
    'eventsible_event_builder',
    'production-quote-shape-001',
    'production-quote-shape-001',
    2,
    'builder_submission_v1',
    '{"fixture":"production_quote_shape"}'::jsonb,
    jsonb_build_object(
      'contract_version', 'builder_submission_v1',
      'planning_stage', 'Ready for a quote',
      'date_confidence', 'confirmed',
      'recommended_package', jsonb_build_object('tier', 'premium'),
      'selected_services', jsonb_build_array('dj_mc', 'selfie_booth_prints', 'live_performer', 'event_staff', 'unknown-synthetic-service')
    ),
    'eventsible-event-builder'
  )
  returning id into submission_id_value;

  insert into public.os_leads(contact_id, event_id, builder_submission_id, status, source, inquiry_summary, estimated_value, metadata)
  values (contact_id_value, event_id_value, submission_id_value, 'new', 'eventsible_event_builder', 'Synthetic Production quote-shape verification', 667, '{"synthetic":true}'::jsonb)
  returning id into lead_id_value;

  insert into public.os_quote_versions(lead_id, event_id, builder_submission_id, version_number, status, currency, subtotal_cents, package_savings_cents, travel_cents, total_cents, deposit_cents, metadata)
  values (lead_id_value, event_id_value, submission_id_value, 1, 'draft', 'USD', 100, 0, 0, 100, 25, '{"older":true}'::jsonb)
  returning id into old_quote_version_id;

  insert into public.os_quote_versions(lead_id, event_id, builder_submission_id, version_number, status, currency, subtotal_cents, package_savings_cents, travel_cents, total_cents, deposit_cents, metadata)
  values (lead_id_value, event_id_value, submission_id_value, 2, 'draft', 'USD', 73000, 6300, 0, 66700, 16675, '{"newest":true}'::jsonb)
  returning id into quote_version_id_value;

  insert into public.os_quote_items(quote_version_id, event_id, service_id, service_code, service_name, label, quantity, unit, unit_price_cents, line_total_cents, custom_quote, metadata)
  values
    (quote_version_id_value, event_id_value, 'dj-mc-foundation', 'dj_mc', 'DJ / MC', 'DJ / MC', 1, 'event', 37500, 37500, false, '{"synthetic":true}'::jsonb),
    (quote_version_id_value, event_id_value, 'selfie-booth-prints', 'selfie_booth_prints', 'Selfie Booth with Prints', 'Selfie Booth with Prints', 1, 'event', 25000, 25000, false, '{"synthetic":true}'::jsonb),
    (quote_version_id_value, event_id_value, 'live-singer', 'live_performer', 'Live Singer', 'Live Singer', 1, 'custom', 0, 0, true, '{"builder_item":{"custom_quote":true}}'::jsonb),
    (quote_version_id_value, event_id_value, 'event-asst', 'event_staff', 'Event Staff', 'Event Staff', 3, 'hour', 3500, 10500, false, '{"synthetic":true}'::jsonb),
    (quote_version_id_value, event_id_value, 'unknown-synthetic-service', 'unknown-synthetic-service', 'Synthetic Unknown Service', 'Synthetic Unknown Service', 1, 'custom', 0, 0, true, '{"builder_item":{"custom_quote":true}}'::jsonb);

  insert into public.os_builder_activity(contact_id, builder_submission_id, lead_id, event_id, activity_type, facts)
  values (contact_id_value, submission_id_value, lead_id_value, event_id_value, 'builder.submission_received', jsonb_build_object('source','production_quote_shape'))
  returning id into activity_id_value;

  select id, related_record_ids, payload
    into outbox_id_value, outbox_related, outbox_payload
    from public.os_integration_outbox
   where idempotency_key = 'builder.submission_received:' || submission_id_value::text
   limit 1;

  if outbox_id_value is null then
    raise exception 'Production-shaped quote lookup did not create an outbox event.';
  end if;

  if outbox_related->>'quote_version_id' <> quote_version_id_value::text then
    raise exception 'Outbox quote_version_id did not use os_quote_versions.id for the newest valid version.';
  end if;

  if outbox_related ? 'quote_id' then
    raise exception 'Outbox related IDs invented quote_id when Production-shaped schema had none.';
  end if;

  if outbox_related->>'activity_id' <> activity_id_value::text then
    raise exception 'Outbox activity_id did not link to the inserted activity.';
  end if;

  if outbox_payload->>'event_type' <> 'builder.submission_received'
     or outbox_payload->>'contract_version' <> 'builder_submission_v1'
     or (outbox_payload->>'total_cents')::integer <> 66700
     or (outbox_payload->>'package_savings_cents')::integer <> 6300
     or (outbox_payload->>'travel_cents')::integer <> 0 then
    raise exception 'Outbox payload values were not preserved.';
  end if;

  if not ((outbox_payload->'service_codes') ? 'dj_mc')
     or not ((outbox_payload->'service_codes') ? 'selfie_booth_prints')
     or not ((outbox_payload->'custom_quote_service_codes') ? 'live_performer')
     or not ((outbox_payload->'custom_quote_service_codes') ? 'unknown-synthetic-service') then
    raise exception 'Known or Custom Quote service codes were not preserved.';
  end if;

  if outbox_payload::text ~* 'email|phone|primary_email|primary_phone|service_role|password|token|raw_payload' then
    raise exception 'Outbox payload leaked contact, raw payload, or secret-like data.';
  end if;

  if (select status from public.os_integration_outbox where id = outbox_id_value) <> 'pending'
     or (select attempt_count from public.os_integration_outbox where id = outbox_id_value) <> 0
     or (select failure_history from public.os_integration_outbox where id = outbox_id_value) <> '[]'::jsonb then
    raise exception 'Outbox initial processing fields are incorrect.';
  end if;

  insert into public.os_builder_activity(contact_id, builder_submission_id, lead_id, event_id, activity_type, facts)
  values (contact_id_value, submission_id_value, lead_id_value, event_id_value, 'builder.submission_received', '{"replay":true}'::jsonb)
  on conflict (builder_submission_id, activity_type) do nothing;

  if (select count(*) from public.os_integration_outbox where idempotency_key = 'builder.submission_received:' || submission_id_value::text) <> 1 then
    raise exception 'Activity replay created duplicate outbox event.';
  end if;

  perform public.os_enqueue_integration_event(
    'builder.submission_received',
    'builder_submission_received_v1',
    'eventsible-event-builder',
    outbox_related,
    outbox_payload,
    'builder.submission_received:' || submission_id_value::text
  );

  if (select count(*) from public.os_integration_outbox where idempotency_key = 'builder.submission_received:' || submission_id_value::text) <> 1 then
    raise exception 'Duplicate outbox idempotency key created a second outbox event.';
  end if;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into after_counts;

  if after_counts <> jsonb_build_object(
    'contacts', (before_counts->>'contacts')::integer + 1,
    'builder_submissions', (before_counts->>'builder_submissions')::integer + 1,
    'leads', (before_counts->>'leads')::integer + 1,
    'events', (before_counts->>'events')::integer + 1,
    'quote_versions', (before_counts->>'quote_versions')::integer + 2,
    'quote_items', (before_counts->>'quote_items')::integer + 5,
    'builder_activity', (before_counts->>'builder_activity')::integer + 1,
    'outbox', (before_counts->>'outbox')::integer + 1
  ) then
    raise exception 'Production-shaped quote lookup counts were unexpected. before=%, after=%', before_counts, after_counts;
  end if;

  select after_counts into rollback_before;

  begin
    insert into public.os_contacts(display_name, primary_email, preferred_channel, source)
    values ('EVENTSible Missing Quote QA', 'missing-quote@example.invalid', 'email', 'eventsible_event_builder')
    returning id into contact_id_value;

    insert into public.os_events(primary_contact_id, title, event_type, status, timezone, source)
    values (contact_id_value, 'Missing Quote QA', 'Private Party', 'inquiry', 'America/Indiana/Indianapolis', 'eventsible_event_builder')
    returning id into event_id_value;

    insert into public.os_builder_submissions(contact_id, event_id, source, source_session_id, request_fingerprint, intake_version, contract_version, raw_payload, normalized_payload, submitted_from)
    values (contact_id_value, event_id_value, 'eventsible_event_builder', 'missing-quote-001', 'missing-quote-001', 2, 'builder_submission_v1', '{}'::jsonb, '{"contract_version":"builder_submission_v1"}'::jsonb, 'eventsible-event-builder')
    returning id into submission_id_value;

    insert into public.os_leads(contact_id, event_id, builder_submission_id, status, source, metadata)
    values (contact_id_value, event_id_value, submission_id_value, 'new', 'eventsible_event_builder', '{}'::jsonb)
    returning id into lead_id_value;

    insert into public.os_builder_activity(contact_id, builder_submission_id, lead_id, event_id, activity_type, facts)
    values (contact_id_value, submission_id_value, lead_id_value, event_id_value, 'builder.submission_received', '{"missing_quote":true}'::jsonb);

    raise exception 'Missing quote record false success.';
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'Missing quote record false success.' then
      raise;
    end if;
  end;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into rollback_after;

  if rollback_after <> rollback_before then
    raise exception 'Missing quote failure left partial records. before=%, after=%', rollback_before, rollback_after;
  end if;

  raise notice 'EVENTSIBLE_PRODUCTION_QUOTE_SHAPE_SUMMARY %', jsonb_build_object(
    'schema', 'os_quote_versions without quote_id',
    'counts_before', before_counts,
    'counts_after', after_counts,
    'quote_version_id', quote_version_id_value,
    'quote_id_present', false,
    'outbox_id', outbox_id_value,
    'idempotency', 'activity replay and duplicate outbox key preserved one event',
    'failure_paths', 'missing quote rollback verified',
    'privacy', 'payload excludes contact and raw payload fields'
  );
end;
$$;

reset role;
`;

const dir = mkdtempSync(join(tmpdir(), "eventsible-production-quote-shape-"));
const sqlPath = join(dir, "verify-production-quote-shape.sql");
writeFileSync(sqlPath, sql);

try {
  execFileSync("psql", [databaseUrl, "--no-password", "--file", sqlPath], {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: process.env.PGPASSWORD ?? "postgres",
    },
  });
} catch (error) {
  process.exitCode = error.status || 1;
}
