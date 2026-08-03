import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (databaseUrl.includes(productionRef) || databaseUrl.includes("supabase.co")) {
  throw new Error("Refusing to run against a remote or Production Supabase database URL.");
}

const sql = String.raw`
\set ON_ERROR_STOP on

create or replace function public.ecosystem_ci_assert(_condition boolean, _message text)
returns void
language plpgsql
as $$
begin
  if not _condition then
    raise exception '%', _message;
  end if;
end;
$$;

create or replace function public.ecosystem_ci_payload(_submission_id text, _contact_suffix text, _event_date date)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'source_session_id', _submission_id,
    'source', 'eventsible_event_builder',
    'submitted_from', 'eventsible-event-builder',
    'intake_version', 2,
    'request_fingerprint', _submission_id,
    'raw_payload', jsonb_build_object('fixture', 'ecosystem_ci'),
    'normalized_payload', jsonb_build_object(
      'contact', jsonb_build_object(
        'name', 'EVENTSible Local Contract QA',
        'email', concat('ecosystem-ci-', _contact_suffix, '@example.invalid'),
        'phone', concat('574555', _contact_suffix),
        'preferred_contact_method', 'email'
      ),
      'event_title', concat('EVENTSible Local Contract QA - ', _contact_suffix),
      'event_type', 'Private Party',
      'starts_at', to_char(_event_date, 'YYYY-MM-DD') || ' 18:00',
      'ends_at', to_char(_event_date, 'YYYY-MM-DD') || ' 21:00',
      'timezone', 'America/Indiana/Indianapolis',
      'guest_count', 80,
      'planning_stage', 'Ready for a quote',
      'date_confidence', 'confirmed',
      'service_length', 3,
      'venue', jsonb_build_object(
        'name', 'Synthetic South Bend Venue',
        'address_1', 'Synthetic QA Address',
        'city', 'South Bend',
        'state', 'Indiana',
        'status', 'selected'
      ),
      'selected_goals', jsonb_build_array('Packed Dance Floor', 'Photos & Video', 'Guest Interaction'),
      'explicit_service_selections', jsonb_build_array('DJ/MC', 'Selfie Booth with Prints', 'Live Singer', 'Event Staff'),
      'selected_services', jsonb_build_array(
        jsonb_build_object(
          'id', 'dj-mc-foundation',
          'code', 'dj_mc',
          'service_code', 'dj_mc',
          'name', 'DJ / MC',
          'service_name', 'DJ / MC',
          'category', 'Entertainment',
          'quantity', 1,
          'unit', 'event',
          'hours', 3,
          'unit_price', 125,
          'line_total', 375,
          'custom_quote', false
        ),
        jsonb_build_object(
          'id', 'selfie-booth-prints',
          'code', 'selfie_booth_prints',
          'service_code', 'selfie_booth_prints',
          'name', 'Selfie Booth with Prints',
          'service_name', 'Selfie Booth with Prints',
          'category', 'Photo Booths',
          'quantity', 1,
          'unit', 'event',
          'unit_price', 250,
          'line_total', 250,
          'custom_quote', false
        ),
        jsonb_build_object(
          'id', 'live-singer',
          'code', 'live_performer',
          'service_code', 'live_performer',
          'name', 'Live Singer',
          'service_name', 'Live Singer',
          'category', 'Entertainment',
          'quantity', 1,
          'unit', 'custom',
          'line_total', null,
          'custom_quote', true
        ),
        jsonb_build_object(
          'id', 'event-asst',
          'code', 'event_staff',
          'service_code', 'event_staff',
          'name', 'Event Staff',
          'service_name', 'Event Staff',
          'category', 'Staffing',
          'quantity', 1,
          'unit', 'hour',
          'hours', 3,
          'unit_price', 35,
          'line_total', 105,
          'custom_quote', false
        ),
        jsonb_build_object(
          'id', 'unknown-synthetic-service',
          'name', 'Synthetic Unknown Service',
          'service_name', 'Synthetic Unknown Service',
          'category', 'Custom',
          'quantity', 1,
          'unit', 'custom',
          'line_total', null,
          'custom_quote', true
        )
      ),
      'pricing', jsonb_build_object(
        'subtotal', 730,
        'package_savings', 63,
        'estimated_total_without_travel', 667,
        'travel_fee', 0,
        'estimated_total', 667,
        'deposit_amount', 166.75,
        'applied_bundles', jsonb_build_array('Synthetic private party package')
      ),
      'travel', jsonb_build_object('fee', 0, 'tierLabel', 'Local / included', 'basis', 'local'),
      'custom_quote_items', jsonb_build_array('Live Singer', 'Synthetic Unknown Service'),
      'staffing_needs', jsonb_build_array('Event Staff'),
      'equipment_needs', jsonb_build_array('DJ/MC audio', 'Selfie Booth printer'),
      'inquiry_summary', 'Synthetic Event Builder CI verification',
      'contract_version', 'builder_submission_v1',
      'contract_payload', jsonb_build_object(
        'version', 'builder_submission_v1',
        'source_application', 'event_builder',
        'submission_id', _submission_id
      )
    )
  );
$$;

set role service_role;

do $$
declare
  first_result jsonb;
  replay_result jsonb;
  second_result jsonb;
  first_event_id uuid;
  first_quote_version_id uuid;
  first_quote_id uuid;
  counts_after_first jsonb;
  counts_after_replay jsonb;
  counts_after_second jsonb;
  before_failure jsonb;
  after_failure jsonb;
  future_tuesday date;
  public_catalog jsonb;
begin
  if current_database() <> 'postgres' then
    raise exception 'Unexpected database name: %', current_database();
  end if;

  select d::date
    into future_tuesday
    from generate_series(current_date + interval '1 day', current_date + interval '21 days', interval '1 day') as d
   where extract(isodow from d) = 2
   limit 1;

  perform public.ecosystem_ci_assert(future_tuesday > current_date, 'Future Tuesday fixture was not generated.');

  select public.os_ingest_builder_submission(public.ecosystem_ci_payload('ecosystem-ci-submission-001', '0101', future_tuesday))
    into first_result;

  first_event_id := (first_result->>'event_id')::uuid;
  first_quote_id := (first_result->>'quote_id')::uuid;
  first_quote_version_id := (first_result->>'quote_version_id')::uuid;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into counts_after_first;

  perform public.ecosystem_ci_assert(counts_after_first = '{"contacts":1,"builder_submissions":1,"leads":1,"events":1,"quote_versions":1,"quote_items":5,"builder_activity":1,"outbox":1}'::jsonb, 'First submission did not create exactly one OS chain.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_leads where event_id = first_event_id) = 1, 'Lead did not link to first event_id.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_quote_versions where event_id = first_event_id and quote_id = first_quote_id) = 1, 'Quote version did not link to first event_id/quote_id.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_quote_items where event_id = first_event_id and quote_version_id = first_quote_version_id) = 5, 'Quote items did not share first event_id.');
  perform public.ecosystem_ci_assert((select contract_version from public.os_builder_submissions limit 1) = 'builder_submission_v1', 'Contract version was not stored.');
  perform public.ecosystem_ci_assert((select source from public.os_builder_submissions limit 1) = 'eventsible_event_builder', 'Source application/source was not stored.');
  perform public.ecosystem_ci_assert((select request_fingerprint from public.os_builder_submissions limit 1) = 'ecosystem-ci-submission-001', 'Idempotency key was not stored.');
  perform public.ecosystem_ci_assert((select timezone from public.os_events limit 1) = 'America/Indiana/Indianapolis', 'Timezone was not preserved.');
  perform public.ecosystem_ci_assert((select starts_at::time from public.os_events limit 1) = '18:00'::time, 'Start time was not preserved.');
  perform public.ecosystem_ci_assert((select ends_at::time from public.os_events limit 1) = '21:00'::time, 'End time was not preserved.');
  perform public.ecosystem_ci_assert((select total_cents from public.os_quote_versions limit 1) = 66700, 'Quote total did not match Builder UI total.');
  perform public.ecosystem_ci_assert((select package_savings_cents from public.os_quote_versions limit 1) = 6300, 'Package savings were not preserved.');
  perform public.ecosystem_ci_assert((select travel_cents from public.os_quote_versions limit 1) = 0, 'Travel total was not preserved.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_quote_items where service_code in ('dj_mc', 'selfie_booth_prints', 'live_performer', 'event_staff')) = 4, 'Known services did not map to expected service codes.');
  perform public.ecosystem_ci_assert((select service_name from public.os_quote_items where service_code = 'selfie_booth_prints') = 'Selfie Booth with Prints', 'Known service label was not human-readable.');
  perform public.ecosystem_ci_assert((select custom_quote and line_total_cents = 0 from public.os_quote_items where service_code = 'live_performer') is true, 'Live Singer was not preserved as Custom Quote.');
  perform public.ecosystem_ci_assert((select custom_quote and line_total_cents = 0 from public.os_quote_items where service_id = 'unknown-synthetic-service') is true, 'Unknown service was not preserved as Custom Quote.');
  perform public.ecosystem_ci_assert((select sum(line_total_cents) from public.os_quote_items where custom_quote) = 0, 'Custom Quote items inflated numeric total.');

  select public.os_ingest_builder_submission(public.ecosystem_ci_payload('ecosystem-ci-submission-001', '0101', future_tuesday))
    into replay_result;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into counts_after_replay;

  perform public.ecosystem_ci_assert((replay_result->>'duplicate')::boolean is true, 'Replay was not reported as duplicate.');
  perform public.ecosystem_ci_assert(counts_after_replay = counts_after_first, 'Replay created duplicate records.');

  select public.os_ingest_builder_submission(public.ecosystem_ci_payload('ecosystem-ci-submission-002', '0102', future_tuesday + 7))
    into second_result;

  select jsonb_build_object(
    'contacts', (select count(*) from public.os_contacts),
    'builder_submissions', (select count(*) from public.os_builder_submissions),
    'leads', (select count(*) from public.os_leads),
    'events', (select count(*) from public.os_events),
    'quote_versions', (select count(*) from public.os_quote_versions),
    'quote_items', (select count(*) from public.os_quote_items),
    'builder_activity', (select count(*) from public.os_builder_activity),
    'outbox', (select count(*) from public.os_integration_outbox)
  ) into counts_after_second;

  perform public.ecosystem_ci_assert((second_result->>'duplicate')::boolean is false, 'Second submission was incorrectly treated as duplicate.');
  perform public.ecosystem_ci_assert((second_result->>'event_id')::uuid <> first_event_id, 'Second submission reused the first event_id.');
  perform public.ecosystem_ci_assert(counts_after_second = '{"contacts":2,"builder_submissions":2,"leads":2,"events":2,"quote_versions":2,"quote_items":10,"builder_activity":2,"outbox":2}'::jsonb, 'Second submission did not create a second distinct chain.');

  perform public.ecosystem_ci_assert((select count(*) from public.os_integration_outbox where event_type = 'builder.submission_received' and payload_version = 'builder_submission_v1' and source_application = 'event_builder' and status = 'pending' and attempt_count = 0 and failure_history = '[]'::jsonb) = 2, 'Outbox event fields were not initialized correctly.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_integration_outbox where related_record_ids ? 'event_id' and related_record_ids ? 'builder_submission_id' and related_record_ids ? 'quote_id') = 2, 'Outbox related IDs are incomplete.');
  perform public.ecosystem_ci_assert((select count(*) from public.os_integration_outbox where payload::text ~* 'service_role|secret|password|token|private_email|primary_email|primary_phone') = 0, 'Outbox payload contains secret or unnecessary private contact fields.');

  public_catalog := public.os_public_catalog_from_builder(jsonb_build_object(
    'id', 'dj-mc-foundation',
    'name', 'DJ / MC',
    'public_description', 'Public-safe DJ and MC service.',
    'pricing_type', 'hourly',
    'public_pricing', jsonb_build_object('starting_price_cents', 14500),
    'minimum_hours', 2,
    'weekday_rules', jsonb_build_array('Mon-Thu public pricing may apply.'),
    'custom_quote_status', 'not_required',
    'public_media', jsonb_build_array(),
    'active', true,
    'internal_cost_cents', 100,
    'margin', 0.5,
    'partner_rate', 50,
    'internal_notes', 'private',
    'private_staff_notes', 'private',
    'private_equipment_notes', 'private',
    'service_role_metadata', 'private'
  ));

  perform public.ecosystem_ci_assert(public_catalog ? 'version', 'Public catalog version missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'stable_service_id', 'Public catalog stable service ID missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'public_name', 'Public catalog name missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'public_description', 'Public catalog description missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'public_pricing', 'Public catalog pricing missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'minimum_hours', 'Public catalog minimum hours missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'weekday_rules', 'Public catalog weekday rules missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'custom_quote_status', 'Public catalog Custom Quote flag missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'public_media', 'Public catalog media missing.');
  perform public.ecosystem_ci_assert(public_catalog ? 'active', 'Public catalog active status missing.');
  perform public.ecosystem_ci_assert(public_catalog::text !~* 'internal_cost|margin|partner|internal_notes|private_staff|private_equipment|service_role', 'Public catalog leaked private fields.');

  select counts_after_second into before_failure;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-invalid-contact', '0201', future_tuesday), '{normalized_payload,contact,email}', '""'::jsonb) #- '{normalized_payload,contact,phone}');
    raise exception 'Invalid contact false success.';
  exception when others then
    perform public.ecosystem_ci_assert(sqlerrm not like '%os_%' and sqlerrm not like '%select %' and sqlerrm not like '%SQL%', 'Invalid contact leaked SQL/internal details.');
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-missing-services', '0202', future_tuesday), '{normalized_payload,selected_services}', '[]'::jsonb));
    raise exception 'Missing services false success.';
  exception when others then null;
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-invalid-contract', '0203', future_tuesday), '{normalized_payload,contract_version}', '"builder_submission_v0"'::jsonb));
    raise exception 'Invalid contract false success.';
  exception when others then null;
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-oversized-notes', '0204', future_tuesday), '{normalized_payload,inquiry_summary}', to_jsonb(repeat('x', 4001))));
    raise exception 'Oversized notes false success.';
  exception when others then null;
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-honeypot', '0205', future_tuesday), '{raw_payload,website}', '"filled"'::jsonb));
    raise exception 'Honeypot false success.';
  exception when others then null;
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-privileged', '0206', future_tuesday), '{normalized_payload,admin_override}', 'true'::jsonb));
    raise exception 'Privileged field false success.';
  exception when others then null;
  end;

  begin
    perform public.os_ingest_builder_submission(jsonb_set(public.ecosystem_ci_payload('ecosystem-ci-forced-failure', '0207', future_tuesday), '{force_database_failure}', '"true"'::jsonb));
    raise exception 'Forced failure false success.';
  exception when others then null;
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
  ) into after_failure;

  perform public.ecosystem_ci_assert(after_failure = before_failure, 'Failure-path tests left partial records.');

  raise notice 'EVENTSIBLE_CI_SUMMARY %', jsonb_build_object(
    'counts_after_first', counts_after_first,
    'counts_after_replay', counts_after_replay,
    'counts_after_second', counts_after_second,
    'first_ids', jsonb_build_object(
      'contact_id', first_result->>'contact_id',
      'builder_submission_id', first_result->>'submission_id',
      'lead_id', first_result->>'lead_id',
      'event_id', first_result->>'event_id',
      'quote_id', first_result->>'quote_id',
      'quote_version_id', first_result->>'quote_version_id',
      'outbox_id', first_result->>'outbox_id'
    ),
    'second_event_id', second_result->>'event_id',
    'contract_versions', jsonb_build_array('builder_submission_v1', 'quote_draft_v1', 'public_service_catalog_v1'),
    'known_service_codes', jsonb_build_array('dj_mc', 'selfie_booth_prints', 'live_performer', 'event_staff'),
    'unknown_service', 'unknown-synthetic-service',
    'ui_total_cents', 66700,
    'package_savings_cents', 6300,
    'travel_cents', 0,
    'rls', 'anon denied CRM and outbox access',
    'failure_paths', 'invalid contact, missing services, invalid contract, oversized notes, honeypot, privileged field, duplicate, forced failure'
  );
end;
$$;

reset role;
`;

const dir = mkdtempSync(join(tmpdir(), "eventsible-os-ci-"));
const sqlPath = join(dir, "verify.sql");
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

if (!process.exitCode) {
  for (const check of [
    {
      name: "anon cannot read outbox",
      sql: "set role anon; select count(*) from public.os_integration_outbox;",
    },
    {
      name: "anon cannot insert outbox",
      sql: "set role anon; insert into public.os_integration_outbox(event_type, payload_version, source_application, idempotency_key) values ('builder.submission_received', 'builder_submission_v1', 'event_builder', 'anon-bad');",
    },
    {
      name: "anon cannot read CRM contacts",
      sql: "set role anon; select count(*) from public.os_contacts;",
    },
  ]) {
    let denied = false;
    try {
      execFileSync("psql", [databaseUrl, "--no-password", "--command", check.sql], {
        encoding: "utf8",
        stdio: "pipe",
        env: {
          ...process.env,
          PGPASSWORD: process.env.PGPASSWORD ?? "postgres",
        },
      });
    } catch {
      denied = true;
    }
    if (!denied) {
      console.error(`Expected RLS denial failed: ${check.name}.`);
      process.exitCode = 1;
      break;
    }
    console.log(`RLS denial check passed: ${check.name}.`);
  }
}
