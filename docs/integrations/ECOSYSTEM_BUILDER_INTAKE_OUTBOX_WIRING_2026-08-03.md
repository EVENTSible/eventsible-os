# EVENTSible Builder Intake Outbox Wiring - 2026-08-03

- Status: CI VERIFIED ON FEATURE BRANCH / PRODUCTION MIGRATION NOT APPLIED
- Repository: EVENTSible/eventsible-os
- Branch: `feat/builder-intake-outbox-wiring`
- Base branch: `main`
- Starting base commit: `875323c1d0319a3fa0e68dd3bd3a01c04ad065c5`
- Verified feature commit: `1cbf22f41ead2808e2c98f02ce76cc6a2704139f`
- Production Supabase project: EVENTSible OS
- Production project ref: `cplpbzudjprzbnzocirc`

## Scope

This phase prepares the final Builder intake-to-outbox wiring as a migration candidate and CI verification update only. It does not apply any Production database migration, submit a Production Builder lead, modify Event Builder behavior, modify ECC/VINCE or EventsGame, change Vercel environment variables, or weaken existing authentication/RLS.

## Baseline Reviewed

Canonical documents reviewed before implementation:

- `docs/README.md`
- `docs/integrations/ECOSYSTEM_OUTBOX_PRODUCTION_VERIFICATION_2026-08-03.md`
- `docs/integrations/ECOSYSTEM_OUTBOX_SOURCE_PARITY_2026-08-03.md`
- `docs/integrations/ECOSYSTEM_INTEGRATION_FOUNDATION.md`

Read-only Production schema inspection confirmed:

- Existing live intake remains `public.os_ingest_builder_submission(payload jsonb)`.
- Existing outbox helper remains `public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)`.
- Production activity table for the live intake path is `public.os_activity_events`.
- The live intake emits `builder.submission_received` through the existing internal activity path after creating the contact, Builder submission, lead, event, quote version, quote items, and activity record.
- No customer rows or private payload contents were inspected.

## Wiring Design Selected

Selected design: additive `AFTER INSERT` trigger on the existing successful Builder activity record.

Production trigger target:

- Table: `public.os_activity_events`
- Trigger: `os_activity_events_builder_submission_outbox_trg`
- Predicate: `new.event_type = 'builder.submission_received'`
- Function: `public.os_enqueue_builder_submission_received_from_activity()`

The CI-local fixture also attaches the same trigger function to its synthetic `public.os_builder_activity` table so the local Supabase workflow proves the same successful-activity-to-outbox behavior from a clean database.

This is safer than replacing the live intake function because it preserves the existing `public.os_ingest_builder_submission(payload jsonb)` definition and uses the already-established final activity boundary as the integration event boundary.

## Event Contract

Integration event emitted:

- Event type: `builder.submission_received`
- Payload version: `builder_submission_received_v1`
- Source application: `eventsible-event-builder`
- Idempotency key: `builder.submission_received:<builder_submission_id>`

Related record IDs include available safe identifiers:

- `contact_id`
- `builder_submission_id`
- `lead_id`
- `event_id`
- `quote_id`
- `quote_version_id`
- `activity_id`

Payload is privacy-minimized and limited to automation routing data:

- Builder contract version
- Source marker
- Event type
- Selected package tier when present
- Service codes
- Custom Quote service codes
- Total cents
- Travel cents
- Package savings cents
- Planning stage
- Date-confidence status

Payload must not include service-role keys, auth tokens, passwords, raw customer payloads, full private contact records, primary email, primary phone, or private customer notes.

## Failure Policy

The trigger runs inside the same database transaction as the activity insert. If the outbox helper, payload construction, missing-ID validation, or duplicate-handling path fails unexpectedly, the intake transaction fails rather than reporting a false success with missing integration state.

Recommended EVENTSible behavior for this phase: fail closed and rollback the intake chain on outbox wiring failure. This keeps the public result honest and prevents a silent automation gap. If operational experience shows the outbox should become best-effort later, that should be a separately reviewed processor/error-recording design rather than a silent trigger swallow.

## Idempotency

The same Builder submission can create no more than one integration outbox row because the migration uses the deterministic idempotency key:

```text
builder.submission_received:<builder_submission_id>
```

The outbox helper keeps the existing unique `idempotency_key` behavior. Intake replay and activity replay should return or preserve the existing outbox row instead of inserting another event. A distinct Builder submission uses a different `builder_submission_id` and creates a distinct outbox event.

## Migration Candidate

Migration path:

- `supabase/migrations/20260803223000_builder_submission_outbox_wiring.sql`

Objects affected:

- Adds `public.os_enqueue_builder_submission_received_from_activity()`.
- Adds `os_activity_events_builder_submission_outbox_trg` on `public.os_activity_events` when that table exists.
- Adds a CI-local trigger attachment for `public.os_builder_activity` only when that fixture table exists.

Safety properties:

- No `DROP TABLE`.
- No `TRUNCATE`.
- No `DELETE FROM`.
- No CRM/contact/lead/event/quote/booking recreation.
- No customer data mutation.
- No replacement of `public.os_ingest_builder_submission(payload jsonb)`.
- No public, anon, or authenticated grants for the outbox helper or wiring function.
- Service-role execution remains explicitly granted.

## CI Verification

Workflow:

- `.github/workflows/ecosystem-integration-local-supabase.yml`
- Run ID: `30860265175`
- Job ID: `91840490331`
- Commit: `1cbf22f41ead2808e2c98f02ce76cc6a2704139f`
- Result: success
- Runner: Ubuntu 24.04 hosted runner
- Docker: Docker Engine 28.0.4, `hello-world` passed
- Supabase CLI: `npx supabase@2.111.0`
- Node/npm: Node v24.14.1, npm 11.11.0

Clean local database verification passed:

- Migrations applied from zero, including `20260731000000_ecosystem_integration_local_foundation.sql`, `20260803173541_ecosystem_integration_outbox_helper_grants_fix.sql`, and `20260803223000_builder_submission_outbox_wiring.sql`.
- One synthetic Builder submission created one contact, Builder submission, lead, event, quote version, five quote items, Builder activity record, and one outbox event.
- Replay with the same idempotency key created no duplicates.
- Direct activity replay created no duplicate outbox event.
- A second distinct submission created a second connected chain and second outbox event.
- Outbox event type, payload version, source application, related IDs, totals, known service codes, and Custom Quote flags were correct.
- Unknown custom service remained preserved.
- Failure paths left no partial outbox row.
- Anon/authenticated/public could not access the outbox/helper surfaces.
- Service-role access to the helper/table remained allowed.

Actual CI row counts:

| Checkpoint | Contacts | Builder submissions | Leads | Events | Quote versions | Quote items | Builder activity | Outbox |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| After first submission | 1 | 1 | 1 | 1 | 1 | 5 | 1 | 1 |
| After replay with same idempotency key | 1 | 1 | 1 | 1 | 1 | 5 | 1 | 1 |
| After second distinct submission | 2 | 2 | 2 | 2 | 2 | 10 | 2 | 2 |

First synthetic chain IDs from CI:

| Record | ID |
| --- | --- |
| Contact | `4aac5092-fd9b-4d0f-8e10-bb4f3a823658` |
| Builder submission | `113bf744-8c6c-4a0a-a9eb-b4e5200494da` |
| Lead | `13b15c2e-46e8-4a52-bc55-43e04aa519fe` |
| Event | `89dfe8fd-561e-4e5f-b48e-507cccb58ad6` |
| Quote | `fc9b7003-f95e-4324-bb4b-511e8f02cfa2` |
| Quote version | `a6e4ec2e-4779-4733-97b8-86a945fbf869` |
| Outbox | `1b55d150-1720-4854-a74d-64d30b54a5f7` |

Other CI assertions:

- Second `event_id`: `4eb744a6-904e-4328-bdf5-48593120a0bd`.
- Contract versions verified: `builder_submission_v1`, `quote_draft_v1`, `public_service_catalog_v1`.
- Known service codes verified: `dj_mc`, `selfie_booth_prints`, `live_performer`, `event_staff`.
- Unknown service verified: `unknown-synthetic-service`.
- UI/OS total verified: `66700` cents.
- Package savings verified: `6300` cents.
- Travel verified: `0` cents.

Standard checks in the same workflow:

- `npm install`: passed; 380 packages installed and 381 audited.
- `npm run guard:local-supabase-ci`: passed.
- `npm run test:ecosystem:local-supabase`: passed.
- `npm run test:outbox-helper-grants`: passed.
- `npm run test`: passed, 4 contract tests.
- `npm run lint:ci`: passed with the documented inherited `public/gigtracker-v1.js` parse error and inherited warnings.
- `npm run build`: passed.
- `npm audit`: reported 4 high inherited advisories; the workflow records this non-blocking advisory result without dependency upgrades.
- Supabase cleanup: passed with `npx supabase@2.111.0 stop --no-backup`.

## Vercel Preview

Vercel created a Preview deployment for the branch:

- Project: `eventsible-os`
- Deployment ID: `dpl_3SuFDgUzHMe93kchcajxeQoqUgLg`
- Deployed commit: `1cbf22f41ead2808e2c98f02ce76cc6a2704139f`
- Preview URL: `https://eventsible-3qhcqnbnn-firstfamdjs-5913s-projects.vercel.app`
- Branch alias: `https://eventsible-os-git-feat-builde-7e35eb-firstfamdjs-5913s-projects.vercel.app`
- Build status: READY
- Build-log error scan: no error lines; build completed in 16 seconds
- Runtime error scan: no runtime error clusters found in the selected two-hour range

No Production deployment was promoted, and no Vercel environment variables, aliases, or domains were modified.

## Recovery / Disable Plan

If the wiring must be disabled after an authorized deployment:

1. Disable or drop only `os_activity_events_builder_submission_outbox_trg`.
2. Preserve existing `os_integration_outbox` rows.
3. Keep `public.os_ingest_builder_submission(payload jsonb)` unchanged and functional.
4. Revoke helper/wiring function execution if needed.
5. Forward-fix schema defects with narrow additive SQL.
6. Avoid destructive rollback, truncation, or deletion of legitimate records.

## Production Authorization Gate

Separate explicit authorization is required before applying this migration to the EVENTSible OS Production Supabase project. Approval must name the migration file and confirm no Production Builder synthetic submission should be run until the migration is applied and a controlled cloud QA plan is approved.

## Remaining Cloud Verification Gap

CI-local verification proves migration-from-zero and synthetic behavior. It does not prove the Production database has received this new wiring migration, and it does not replace controlled cloud readback after a future authorized migration.

## Exact Next Phase

Open and review the pull request for `feat/builder-intake-outbox-wiring`. If approved, merge the OS branch, then request separate explicit authorization to apply `supabase/migrations/20260803223000_builder_submission_outbox_wiring.sql` to Production and perform one controlled cloud Builder submission/readback QA.
