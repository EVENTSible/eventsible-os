# Builder Event Staff Quote Label Forward Fix - 2026-08-04

- Status: PRODUCTION MIGRATION APPLIED / NEEDS FOLLOW-UP FIX
- Repository: `EVENTSible/eventsible-os`
- Branch merged through main commit `983068a5734a0c233aeef625c7f4d3221cb41e88`
- Production Supabase project: EVENTSible OS, ref `cplpbzudjprzbnzocirc`
- Existing Builder intake: LIVE / RESTORED
- Builder outbox emission: ACTIVE in Production from prior verified activation
- End-to-end Integration Foundation classification: PARTIAL / NEEDS VERIFICATION

## Scope

This forward-fix addressed the display-label defect found during controlled Builder intake-to-outbox Production QA: an Event Staff quote item could be stored with a machine-shaped value in `public.os_quote_items.service_name`.

This branch did not modify Event Builder code, ECC/VINCE, EventsGame, Vercel environment variables, outbox consumers, or existing Production data.

## Original Production Finding

Controlled QA label: `EVENTSible Outbox Production QA 3`

The prior Production verification created exactly one complete OS chain and one outbox event. Idempotent replay created no duplicates. The remaining defect was limited to display-label polish:

| Service code | Production service name observed |
| --- | --- |
| `event_staff` | `event_staff` |

The outbox payload itself already canonicalized Event Staff correctly, and Custom Quote/totals behavior remained correct.

## Original Root Cause

Read-only Production function inspection showed the live intake inserts quote items from `public.os_service_catalog` when a catalog match exists:

- The Builder-selected service intent is Event Staff.
- The intake stores `coalesce(service_name_value, service_code_value)`.
- When the catalog value is machine-shaped, `os_quote_items.service_name` receives a machine label.

Replacing `public.os_ingest_builder_submission(jsonb)` was intentionally avoided. Adding a quote identifier column or mutating Production quote schema was also intentionally avoided.

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

## Production Migration Execution

Authorized migration applied to the EVENTSible OS Production project:

- Migration history name: `builder_quote_item_event_staff_label_fix`
- Migration history version: `20260804023227`
- Source blob SHA: `f5a3355aa94cc66f3c28078348bf81760206f14b`
- Execution result: success

Post-migration verification:

- `public.os_normalize_builder_quote_item_service_name()` exists.
- `os_quote_items_builder_service_name_trg` exists on `public.os_quote_items`.
- Trigger is enabled and fires `BEFORE INSERT`.
- Trigger condition is restricted to `new.service_code = 'event_staff'`.
- `public.os_ingest_builder_submission(jsonb)` hash remained `329c0592aec62f78a182a7e3a741072a`.
- Existing CRM/event/quote/outbox row counts were unchanged by the migration itself.

## Production QA Result

Controlled QA label: `EVENTSible Outbox Production QA 4`

The first attempt after browser reset only reached the prior thank-you state and created no records. The browser was then reset through the public Builder UI and one actual controlled Production submission was sent through the normal quote form.

Pre-QA counts:

| Object | Count |
| --- | ---: |
| contacts | 5 |
| builder_submissions | 5 |
| leads | 5 |
| events | 5 |
| quote_versions | 5 |
| quote_items | 24 |
| activity_events | 5 |
| integration_outbox | 3 |

Post-QA counts:

| Object | Count |
| --- | ---: |
| contacts | 6 |
| builder_submissions | 6 |
| leads | 6 |
| events | 6 |
| quote_versions | 6 |
| quote_items | 29 |
| activity_events | 6 |
| integration_outbox | 4 |

The controlled QA created exactly one new contact, Builder submission, lead, event, quote version, five quote items, activity event, and integration outbox event.

Verified QA values:

- Event type: `Private Party`
- Date: `2026-08-11`
- Timezone: `America/Indiana/Indianapolis`
- Location: South Bend, IN
- Quote status: `draft`
- Quote item count: `5`
- Quote item numeric sum: `790`
- Quote version total: `727`
- Travel amount: `0`
- Outbox event type: `builder.submission_received`
- Outbox payload version: `builder_submission_received_v1`
- Outbox source application: `eventsible-event-builder`
- Outbox status: `pending`
- Outbox attempt count: `0`
- Outbox failure history: empty
- Outbox payload privacy: no email or phone detected

## Follow-Up Finding

The Event Staff display-label migration did not correct the new controlled QA item because the live Production quote item used:

| Field | Observed value |
| --- | --- |
| `service_code` | `event-asst` |
| `service_name` | `event-asst` |

The trigger condition only fires for:

```sql
when (new.service_code = 'event_staff')
```

Because Production currently writes the service code as `event-asst`, the trigger did not fire for this item. This is a narrow source/Production parity miss, not an intake-chain failure.

## Security

The trigger helper uses `security invoker` and an explicit search path. Direct execution is not granted to public clients:

- `public`: revoked
- `anon`: revoked
- `authenticated`: revoked
- `service_role`: granted

Outbox and helper security remained intact after QA:

- anon cannot execute the outbox helper.
- authenticated cannot execute the outbox helper.
- anon cannot read or insert outbox rows.
- authenticated cannot read or insert outbox rows.
- outbox RLS remains enabled.

No service-role values, database passwords, Host PINs, customer rows, or private payloads are stored in this migration or test fixture.

## Runtime And Admin Checks

- EVENTSible OS `/api/health`: HTTP 200, `ok: true`, service `EVENTSible OS Admin`.
- Event Builder `/admin` unauthenticated behavior: redirected to Staff sign-in.
- Vercel runtime errors: none found for `eventsible-os` or `eventsible-event-builder` in the checked 30-minute window.

Authenticated Admin Leads visual QA was not completed in this pass because the label mapping gate failed first.

## Recovery / Disable Plan

If the normalization must be stopped, disable or drop only:

```sql
alter table public.os_quote_items
  disable trigger os_quote_items_builder_service_name_trg;
```

or remove only the trigger/function with a reviewed forward-fix migration. Preserve all existing quote items, Builder intake records, and outbox rows.

## Required Next Fix

Prepare a narrow follow-up migration that expands the normalization trigger condition to include the actual Production Event Staff service code variants, including `event-asst` and `event_asst`, while preserving existing behavior for `event_staff`.

The follow-up migration should:

- Replace only `public.os_normalize_builder_quote_item_service_name()` and/or the trigger condition.
- Avoid modifying `public.os_ingest_builder_submission(jsonb)`.
- Avoid updating existing quote rows unless separately authorized.
- Avoid changing outbox helpers, outbox consumers, or Event Builder code.
- Preserve grants: service-role allowed, anon/authenticated denied, public not granted.
- Add Production-shaped CI coverage where `service_code = 'event-asst'` stores `service_name = 'Event Staff'`.

## Current Classification

- Existing Builder intake: LIVE
- Builder intake-to-outbox emission: ACTIVE
- Event Staff label migration: APPLIED BUT INCOMPLETE
- End-to-end Integration Foundation: NEEDS VERIFICATION

Do not mark the Ecosystem Integration Foundation `PRODUCTION VERIFIED` until the Event Staff label follow-up fix is reviewed, applied, and one final controlled Production QA submission plus Admin Leads visual QA passes.
