# EVENTSible Builder Outbox Payload Parity Forward-Fix - 2026-08-04

- Status: IMPLEMENTED ON BRANCH / NEEDS VERIFICATION
- Branch: `fix/builder-outbox-payload-parity`
- Base branch: `main`
- Base commit: `b090cc301b6a0421ec408b74ab02661fc95edf8a`
- Production Supabase project: EVENTSible OS
- Production project ref: `cplpbzudjprzbnzocirc`
- Do-not-target project: EventsGame, `evhhhpitdjsqjufuvgcf`

## Scope

This branch prepares a narrow source-only follow-up after the quote-lookup forward-fix passed the SQL error gate but failed payload parity verification. It does not modify Production Supabase, re-enable the Production trigger, submit another Production Builder lead, modify Event Builder behavior, modify ECC/VINCE or EventsGame, change Vercel settings, add outbox consumers, or begin unrelated GigTracker/homepage work.

## Current Production State

Read-only Production checks confirmed:

- `os_activity_events_builder_submission_outbox_trg` exists on `public.os_activity_events` and is disabled.
- `public.os_ingest_builder_submission(jsonb)` hash remains `329c0592aec62f78a182a7e3a741072a`.
- `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)` hash remains `4ee441189c423010d627d4158f17385c`.
- Corrected trigger helper hash after the quote-lookup fix is `8aecc65e227e2083ab32a6b8b3ad1c35`.
- `public.os_quote_versions` has no physical `quote_id` column.
- Existing Builder intake is LIVE / RESTORED because the trigger is disabled.

Safe record counts observed after containment and one preserved QA2 chain:

| Record | Count |
| --- | ---: |
| Contacts | 4 |
| Builder submissions | 4 |
| Leads | 4 |
| Events | 4 |
| Quote versions | 4 |
| Quote items | 20 |
| Activity events | 4 |
| Integration outbox | 2 |

No customer rows, auth-user details, secrets, keys, passwords, tokens, PINs, or full connection strings were exported.

## Payload Parity Findings

The controlled `EVENTSible Outbox Production QA 2` submission created one complete OS chain and one outbox row, but the integration foundation remained `NEEDS VERIFICATION` because payload parity gates failed:

- `related_record_ids.quote_id` was set to the quote version ID carried in the activity payload. Production has no genuine quote ID column, so `quote_id` should be omitted when unavailable.
- Builder UI pricing showed subtotal `$790`, package savings `-$63`, travel `$0`, final total `$727`. The outbox payload preserved total and travel, but reported `package_savings_cents: 0` because the quote table total was already net of savings.
- Selected services included Selfie Booth with Prints and Event Staff, but outbox `service_codes` emitted legacy codes `selfie_booth_digital` and `event-asst`.

## Forward-Fix Design

Migration candidate:

- `supabase/migrations/20260804013000_builder_submission_outbox_payload_parity_fix.sql`

The migration only replaces:

- `public.os_enqueue_builder_submission_received_from_activity()`

It does not create, drop, enable, or disable triggers. It does not modify `public.os_ingest_builder_submission(jsonb)`, `public.os_enqueue_integration_event(...)`, table definitions, table data, CRM records, contacts, leads, events, bookings, outbox rows, migration history, Event Builder code, or Vercel settings.

Behavior changes:

- Keeps using activity `quote_id` only to select the existing quote version when it matches `os_quote_versions.id`.
- Does not promote activity `quote_id` into outbox `related_record_ids.quote_id`.
- Includes `quote_id` only when a genuine value exists on the quote row projection.
- Derives `package_savings_cents` from Builder pricing snapshots or normalized Builder pricing before falling back to quote-column discount values.
- Canonicalizes Selfie Booth with Prints to `selfie_booth_prints` when the selected Builder service ID/name indicates prints, even if the legacy code says `selfie_booth_digital`.
- Canonicalizes Event Assistant / `event-asst` to `event_staff` for public-safe downstream automation.
- Preserves fail-closed transaction behavior, deterministic idempotency key, privacy-minimized payloads, and secure grants.

## Event Payload Policy

Event identity remains:

- Event type: `builder.submission_received`
- Payload version: `builder_submission_received_v1`
- Source application: `eventsible-event-builder`
- Idempotency key: `builder.submission_received:<builder_submission_id>`

Related IDs include available safe identifiers:

- `contact_id`
- `builder_submission_id`
- `lead_id`
- `event_id`
- `quote_version_id`
- `activity_id`
- `quote_id` only when genuinely available on the quote row projection

Payload remains limited to operational automation fields:

- `contract_version`
- `source`
- `event_type`
- `selected_package_tier`
- `service_codes`
- `custom_quote_service_codes`
- `total_cents`
- `travel_cents`
- `package_savings_cents`
- `planning_stage`
- `date_confidence`

Payload must not include email, phone, full contact records, raw Builder payloads, auth tokens, service-role values, passwords, private customer notes, or unnecessary identifying information.

## CI Coverage

The Production-shaped local verification now reproduces the failed QA shape:

- `public.os_quote_versions` has no `quote_id` column.
- Activity facts include `quote_id` containing the quote-version ID.
- The expected outbox `related_record_ids` omits `quote_id`.
- Builder pricing metadata contains subtotal `790`, package savings `63`, travel `0`, and final total `727`.
- The expected outbox payload contains `package_savings_cents: 6300`.
- Selected Builder services include `selfie-booth-prints` with legacy code `selfie_booth_digital`, and `event-asst` with legacy code `event-asst`.
- The expected outbox service codes include `selfie_booth_prints` and `event_staff`, and exclude `selfie_booth_digital` and `event-asst`.
- Unknown Custom Quote services and Live Singer remain preserved as Custom Quote items.
- Missing quote rollback and duplicate idempotency behavior remain verified.

Guard updates also block future migrations from reintroducing direct physical `q.quote_id` references or promoting activity `quote_id` into outbox `quote_id` outside the preserved historical migration.

## Classification

- Existing Builder intake: LIVE / RESTORED
- Trigger wiring objects: IMPLEMENTED
- Trigger emission: DISABLED in Production
- Quote-lookup fix: APPLIED TO PRODUCTION, but payload parity failed
- Payload parity fix: IMPLEMENTED ON BRANCH after this branch passes exact-head CI
- End-to-end Production integration: NEEDS VERIFICATION

## Recovery Plan

If the payload parity fix is later applied and any issue appears:

1. Keep or return `os_activity_events_builder_submission_outbox_trg` to disabled state.
2. Preserve existing outbox rows, including the QA2 event.
3. Preserve Builder intake, contacts, submissions, leads, events, quotes, bookings, and activities.
4. Forward-fix the helper with narrow additive SQL.
5. Do not truncate, delete, or destructively roll back legitimate records.

## Production Authorization Gate

No Production action is authorized by this branch.

Later Production sequence must be separately approved:

1. Review and merge the payload parity PR.
2. Observe automatic OS Vercel Production deployment.
3. Apply only `supabase/migrations/20260804013000_builder_submission_outbox_payload_parity_fix.sql` to EVENTSible OS Production.
4. Verify the Production trigger remains disabled after migration.
5. Verify corrected helper definition, grants, and existing intake hash.
6. Separately re-enable only `os_activity_events_builder_submission_outbox_trg` after checks pass.
7. Run one controlled Production Builder QA submission.
8. Verify one complete OS chain and one outbox event with `quote_id` omitted, `package_savings_cents: 6300`, `selfie_booth_prints`, and `event_staff`.
9. Verify Admin Leads and no duplicates.
10. Mark the Integration Foundation `PRODUCTION VERIFIED` only after all gates pass.

## Exact Next Phase

Open and review the pull request for `fix/builder-outbox-payload-parity`. Do not merge, apply the migration, re-enable the trigger, or submit another Production Builder lead until exact-head CI and Preview health checks pass.
