# Builder Event Staff Quote Label Forward Fix - 2026-08-04

- Status: IMPLEMENTED ON BRANCH / NEEDS PRODUCTION AUTHORIZATION
- Repository: `EVENTSible/eventsible-os`
- Branch: `fix/builder-event-staff-quote-label`
- Production Supabase project: EVENTSible OS, ref `cplpbzudjprzbnzocirc`
- Existing Builder intake: LIVE / RESTORED
- Builder outbox emission: ACTIVE in Production from prior verified activation
- End-to-end Integration Foundation classification: PARTIAL / NEEDS VERIFICATION

## Scope

This forward-fix addresses the final mapping defect found during the controlled Builder intake-to-outbox Production QA pass: the stable service code `event_staff` was correct, but the quote item display value stored in `public.os_quote_items.service_name` was the machine label `event_staff`.

This branch does not modify Event Builder code, ECC/VINCE, EventsGame, Vercel environment variables, outbox consumers, or Production data.

## Production Finding

Controlled QA label: `EVENTSible Outbox Production QA 3`

The prior Production verification created exactly one complete OS chain and one outbox event. Idempotent replay created no duplicates. The remaining defect was limited to display-label polish:

| Service code | Production service name observed |
| --- | --- |
| `event_staff` | `event_staff` |

The outbox payload itself already canonicalized `event_staff` correctly, and Custom Quote/totals behavior remained correct.

## Root Cause

Read-only Production function inspection showed the live intake inserts quote items from `public.os_service_catalog` when a catalog match exists:

- The Builder-selected service code is `event_staff`.
- The intake stores `coalesce(service_name_value, service_code_value)`.
- When the catalog value is machine-shaped, `os_quote_items.service_name` receives `event_staff`.

Replacing `public.os_ingest_builder_submission(jsonb)` is intentionally avoided. Adding a quote identifier column or mutating Production quote schema is also intentionally avoided.

## Forward-Fix Design

Migration candidate:

`supabase/migrations/20260804153000_builder_quote_item_event_staff_label_fix.sql`

Objects added or replaced:

- Function: `public.os_normalize_builder_quote_item_service_name()`
- Trigger: `os_quote_items_builder_service_name_trg` on `public.os_quote_items`

Behavior:

- Fires `BEFORE INSERT` only on future quote items where `new.service_code = 'event_staff'`.
- Changes `new.service_name` to `Event Staff` only when the incoming value is blank or a known machine label: `event_staff`, `event-asst`, or `event_asst`.
- Does not update existing quote items.
- Does not touch contacts, leads, events, quote versions, activity events, outbox rows, or Builder submissions.
- Does not change the Builder intake function or the Builder intake-to-outbox trigger.

## Security

The trigger helper uses `security invoker` and an explicit search path. Direct execution is not granted to public clients:

- `public`: revoked
- `anon`: revoked
- `authenticated`: revoked
- `service_role`: granted

No service-role values, database passwords, Host PINs, customer rows, or private payloads are stored in this migration or test fixture.

## CI Coverage

New verifier:

`node scripts/verify-builder-event-staff-label.mjs`

The verifier refuses remote or Production Supabase URLs, inserts a synthetic local quote item with:

- `service_code = 'event_staff'`
- `service_name = 'event_staff'`

and asserts the stored `service_name` becomes `Event Staff` after the new trigger runs. It also checks helper grants by role.

The local Supabase workflow now runs:

`npm run test:builder-event-staff-label`

on branch:

`fix/builder-event-staff-quote-label`

## Recovery / Disable Plan

If the migration is later applied and the display normalization must be stopped, disable or drop only:

```sql
alter table public.os_quote_items
  disable trigger os_quote_items_builder_service_name_trg;
```

or remove only the trigger/function with a reviewed forward-fix migration. Preserve all existing quote items, Builder intake records, and outbox rows.

## Production Authorization Gate

No Production action is authorized by this branch alone.

Before Production verification resumes:

1. Review and merge this branch after exact-head CI passes.
2. Separately authorize applying only `20260804153000_builder_quote_item_event_staff_label_fix.sql` to the EVENTSible OS Production project.
3. Verify the trigger/function and grants.
4. Submit one controlled Builder QA lead only after explicit authorization.
5. Complete authenticated Admin Leads visual QA.
6. Mark the Ecosystem Integration Foundation `PRODUCTION VERIFIED` only if the new QA chain, outbox event, label mapping, totals, idempotency, RLS/grants, Admin display, and security checks all pass.
