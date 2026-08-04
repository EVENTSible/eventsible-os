# EVENTSible Builder Outbox Quote Lookup Forward-Fix - 2026-08-03

- Status: IMPLEMENTED ON BRANCH / NEEDS VERIFICATION
- Branch: `fix/builder-outbox-production-quote-lookup`
- Base branch: `main`
- Base commit: `208f45bf8c90c75b30c76391faa3967db3641981`
- Related wiring merge commit: `5bbc427336c75c1551f6b71e5a99067757dc6b82`
- Production Supabase project: EVENTSible OS
- Production project ref: `cplpbzudjprzbnzocirc`
- Do-not-target project: EventsGame, `evhhhpitdjsqjufuvgcf`

## Scope

This branch prepares the narrow forward-fix for the Builder intake-to-outbox quote lookup incident. It does not modify Production Supabase, re-enable the Production trigger, submit a Production Builder lead, modify Event Builder behavior, modify ECC/VINCE or EventsGame, change Vercel settings, add outbox consumers, or begin unrelated GigTracker/homepage work.

## Production Incident Recap

The approved wiring migration was applied to Production. The first controlled Production Builder QA submission failed inside the database transaction with:

- PostgreSQL code: `42703`
- Safe message: `column q.quote_id does not exist`

Containment disabled only `os_activity_events_builder_submission_outbox_trg` on `public.os_activity_events`. The trigger still exists but is disabled. The failed QA created no partial records.

Containment evidence:

| Record | Count |
| --- | ---: |
| Contacts | 3 |
| Builder submissions | 3 |
| Leads | 3 |
| Events | 3 |
| Quote versions | 3 |
| Quote items | 15 |
| Activity events | 3 |
| Integration outbox | 1 |
| QA-specific records | 0 |

Production hashes recorded during containment:

- `public.os_ingest_builder_submission(jsonb)`: `329c0592aec62f78a182a7e3a741072a`
- `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)`: `4ee441189c423010d627d4158f17385c`
- Previous trigger helper: `73c33c06ddd6d4e6e00f488d611579ea`

## Read-Only Production Schema Findings

Read-only schema review confirmed:

- `public.os_quote_versions` does not contain `quote_id`.
- `public.os_quote_versions.id` is the available quote-version identifier.
- `public.os_quote_versions` includes `lead_id`, `event_id`, `version_number`, `status`, `currency`, `subtotal`, `discount_amount`, `travel_amount`, `tax_amount`, `total_amount`, `deposit_amount`, `snapshot`, and timestamps.
- `public.os_quote_items.quote_version_id` exists and links quote items to quote versions.
- `public.os_activity_events.payload` is JSONB and may carry optional related IDs, but no physical `quote_id` column can be assumed.
- Production trigger `os_activity_events_builder_submission_outbox_trg` remains disabled (`tgenabled = 'D'`).
- Existing intake and outbox helper hashes remain unchanged from containment.

No customer rows, auth-user details, private payloads, or secrets were exported.

## Root Cause

The merged trigger helper contained a direct physical-column reference:

```sql
q.quote_id
```

inside a query against `public.os_quote_versions q`. Production has no `quote_id` column on that table, so the trigger helper failed during the successful-intake activity insert. The fail-closed transaction behavior correctly rolled the intake back and prevented partial records.

## Forward-Fix Design

Migration candidate:

- `supabase/migrations/20260804003000_builder_submission_outbox_quote_lookup_fix.sql`

The migration only replaces:

- `public.os_enqueue_builder_submission_received_from_activity()`

It does not create, drop, enable, or disable triggers. It does not change `public.os_ingest_builder_submission(jsonb)`. It does not change table data, quote schema, CRM records, contacts, leads, events, bookings, or Vercel settings.

Behavior changes:

- Removes all direct `q.quote_id` / `os_quote_versions.quote_id` references.
- Selects the quote version using `q.event_id`, `q.lead_id`, `q.version_number`, and `q.created_at`.
- Treats `q.id` as `quote_version_id`.
- Includes `quote_id` only when it is genuinely available from the activity payload or from a schema-compatible JSON row projection.
- Omits `quote_id` when unavailable; it is not invented from `quote_version_id`.
- Preserves `builder.submission_received` event type, `builder_submission_received_v1` payload version, `eventsible-event-builder` source application, and deterministic idempotency key `builder.submission_received:<builder_submission_id>`.
- Preserves fail-closed behavior when required IDs, Builder submission, event, or quote version are missing.
- Preserves the privacy-minimized payload policy.
- Re-applies intended helper grants: public/anon/authenticated denied, service_role allowed.

## Event Payload Policy

Related IDs include safe available identifiers:

- `contact_id`
- `builder_submission_id`
- `lead_id`
- `event_id`
- `quote_version_id`
- `activity_id`
- `quote_id` only when safely and genuinely present

Payload fields remain limited to automation routing data:

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

## Production-Shaped CI Coverage

New CI script:

- `scripts/verify-builder-outbox-production-quote-shape.mjs`

The script runs only against local Supabase and refuses remote or Production URLs. It forces the clean local verification database into the mandatory Production-shaped condition by removing the local-only `quote_id` column, then verifies the corrected helper.

Coverage includes:

- `public.os_quote_versions` without `quote_id`.
- Fixed helper definition contains no direct physical `q.quote_id` / `os_quote_versions.quote_id` reference.
- Synthetic chain creates one contact, Builder submission, lead, event, newest quote version selection, expected quote items, one activity, and one outbox event.
- `quote_version_id` equals `public.os_quote_versions.id` for the newest valid version.
- `quote_id` is absent when unavailable.
- Known service mappings remain present.
- Unknown Custom Quote service remains preserved.
- Total, package savings, travel, outbox status, attempt count, and failure history remain correct.
- Activity replay and duplicate outbox idempotency key create no duplicate outbox row.
- Missing quote record fails closed and rolls back the synthetic records.
- Payload excludes contact, raw payload, and secret-like fields.
- Helper grants and outbox RLS remain verified by `scripts/verify-outbox-helper-grants.mjs`.

Guard update:

- `scripts/guard-local-supabase-ci.mjs` now fails future production migrations that introduce direct physical quote ID references, while preserving the already-merged historical migration as visible history.

## Classification

- Existing Builder intake: LIVE / RESTORED after containment
- Trigger wiring objects: IMPLEMENTED
- Trigger emission: DISABLED in Production
- Forward-fix: IMPLEMENTED ON BRANCH after this branch passes exact-head CI
- End-to-end Production integration: NEEDS VERIFICATION

## Recovery Plan

If the forward-fix is later applied and any issue appears:

1. Keep or return `os_activity_events_builder_submission_outbox_trg` to disabled state.
2. Preserve existing outbox rows.
3. Preserve Builder intake, contacts, submissions, leads, events, quotes, bookings, and activities.
4. Forward-fix the helper with narrow additive SQL.
5. Do not truncate, delete, or roll back legitimate records destructively.

## Production Authorization Gate

No Production action is authorized by this branch.

Later Production sequence must be separately approved:

1. Review and merge the forward-fix PR.
2. Observe automatic OS Vercel Production deployment.
3. Separately authorize applying only `supabase/migrations/20260804003000_builder_submission_outbox_quote_lookup_fix.sql`.
4. Verify the Production trigger remains disabled after migration.
5. Verify corrected helper definition and grants.
6. Separately authorize re-enabling only `os_activity_events_builder_submission_outbox_trg`.
7. Run one controlled Production Builder QA submission.
8. Verify one complete OS chain and one outbox event.
9. Verify Admin Leads and no duplicates.
10. Mark the Integration Foundation `PRODUCTION VERIFIED` only after all checks pass.

## Exact Next Phase

Open and review the pull request for `fix/builder-outbox-production-quote-lookup`. Do not merge, apply the migration, re-enable the trigger, or submit another Production Builder lead until the branch passes exact-head CI and Preview health checks.
