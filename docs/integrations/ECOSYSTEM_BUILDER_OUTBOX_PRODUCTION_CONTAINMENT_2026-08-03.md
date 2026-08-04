# EVENTSible Builder Outbox Production Containment - 2026-08-03

- Status: NEEDS VERIFICATION
- Repository: EVENTSible/eventsible-os
- Production Supabase project: EVENTSible OS
- Production project ref: `cplpbzudjprzbnzocirc`
- Do-not-target project: EventsGame, `evhhhpitdjsqjufuvgcf`
- Related migration source: `supabase/migrations/20260803223000_builder_submission_outbox_wiring.sql`
- Containment action: disabled only `os_activity_events_builder_submission_outbox_trg`
- Table: `public.os_activity_events`

## Incident Summary

The approved Builder intake-to-outbox wiring migration was applied to Production and the trigger/helper/grants initially verified. The first controlled Production Builder QA submission then failed in the server-side intake path.

Safe error evidence:

- PostgreSQL code: `42703`
- Safe message: `column q.quote_id does not exist`
- Runtime source: Builder server function calling `public.os_ingest_builder_submission(payload jsonb)`

The failure occurred inside the database transaction. Safe Production readback confirmed the transaction rolled back completely and created no partial QA record chain.

## Pre-Containment Counts

| Table/check | Count |
| --- | ---: |
| `public.os_contacts` | 3 |
| `public.os_builder_submissions` | 3 |
| `public.os_leads` | 3 |
| `public.os_events` | 3 |
| `public.os_quote_versions` | 3 |
| `public.os_quote_items` | 15 |
| `public.os_activity_events` | 3 |
| `public.os_integration_outbox` | 1 |
| QA contacts | 0 |
| QA Builder submissions | 0 |
| QA leads | 0 |
| QA events | 0 |
| QA quote versions | 0 |
| QA quote items | 0 |
| QA activities | 0 |
| QA outbox rows | 0 |

## Preflight Before Disablement

Safe read-only inspection confirmed:

- `public.os_activity_events` exists.
- Trigger `os_activity_events_builder_submission_outbox_trg` existed and was enabled (`tgenabled = 'O'`).
- Trigger definition: `AFTER INSERT ON public.os_activity_events FOR EACH ROW WHEN ((new.event_type = 'builder.submission_received'::text)) EXECUTE FUNCTION os_enqueue_builder_submission_received_from_activity()`.
- Trigger helper `public.os_enqueue_builder_submission_received_from_activity()` exists.
- Existing intake function `public.os_ingest_builder_submission(jsonb)` exists.
- Existing outbox helper `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)` exists.
- Intake function hash before containment: `329c0592aec62f78a182a7e3a741072a`.
- Outbox helper hash before containment: `4ee441189c423010d627d4158f17385c`.
- Existing outbox row count was `1`.
- QA-specific counts were all `0`.

No customer rows, auth user details, secrets, or private payloads were exported into this document.

## Containment Action

Authorized command summary:

```sql
alter table public.os_activity_events
  disable trigger os_activity_events_builder_submission_outbox_trg;
```

Execution method: Supabase MCP `execute_sql` against project `cplpbzudjprzbnzocirc`.

No migration was applied for containment. No `DROP TRIGGER`, function replacement, table data mutation, broad repair SQL, Vercel change, Event Builder code change, ECC/VINCE change, EventsGame change, or additional Production Builder submission was performed.

## Post-Containment Verification

Safe readback confirmed:

- Trigger still exists.
- Trigger is disabled (`tgenabled = 'D'`).
- Trigger helper still exists.
- Existing intake function hash after containment: `329c0592aec62f78a182a7e3a741072a`.
- Existing outbox helper hash after containment: `4ee441189c423010d627d4158f17385c`.
- Existing outbox row count remains `1`.
- All CRM/intake/quote/activity/outbox table counts remained unchanged.
- QA-specific counts remained all `0`.
- No migration-history entry was removed.
- No customer data changed.

Helper execution grants after containment:

| Surface | anon | authenticated | public | service_role |
| --- | --- | --- | --- | --- |
| `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)` | denied | denied | not granted | allowed |
| `public.os_enqueue_builder_submission_received_from_activity()` | denied | denied | not granted | allowed |

## Application Health

Post-containment checks:

- EVENTSible OS health: `https://eventsible-os.vercel.app/api/health` returned HTTP 200 with `ok: true` and `service: EVENTSible OS Admin`.
- Public Builder availability: `https://build.eventsible.info` returned HTTP 200.
- No Vercel deployment was required for containment.
- No Vercel environment variable, domain, or alias changed.
- OS runtime error scan in the checked window found no runtime error groups.
- Builder runtime error scan still showed the known failed QA attempt from before containment; no additional Builder lead was submitted after the trigger was disabled.

## Current Production Behavior

Normal Builder intake is no longer connected to the broken outbox emission trigger because `os_activity_events_builder_submission_outbox_trg` is disabled.

The outbox schema, outbox helper, wiring helper, and trigger object remain present for investigation and forward-fix work. Existing outbox rows remain preserved.

## Classification

Final classification: NEEDS VERIFICATION.

Do not mark the Ecosystem Integration Foundation PRODUCTION VERIFIED until the narrow forward-fix is reviewed, merged, applied, and a new controlled Production QA pass succeeds.

## Required Forward-Fix

Prepare a narrow additive fix for `public.os_enqueue_builder_submission_received_from_activity()` so it does not reference nonexistent `public.os_quote_versions.quote_id` in Production.

Recommended direction:

1. Inspect the Production `public.os_quote_versions` schema and source migration history.
2. Update the wiring helper to derive quote/version identifiers only from columns that exist in both clean CI and Production, likely using `quote_version_id = q.id` and omitting `quote_id` unless a compatible column is present.
3. Preserve the disabled trigger state until the fixed helper is applied and reviewed.
4. Extend CI to cover the Production-shaped `os_quote_versions` schema without a `quote_id` column.
5. Re-enable the trigger only after a separate explicit Production authorization.
6. Run one controlled Production Builder QA submission only after the fix is applied and health checks pass.

No outbox consumers or automatic dispatching should be added in the forward-fix phase.
