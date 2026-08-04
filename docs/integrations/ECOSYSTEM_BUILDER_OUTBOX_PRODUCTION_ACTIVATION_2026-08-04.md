# Builder Intake-To-Outbox Production Activation - 2026-08-04

- Status: PRODUCTION VERIFIED
- Repository: `EVENTSible/eventsible-os`
- Production Supabase project: EVENTSible OS, ref `cplpbzudjprzbnzocirc`
- EVENTSible OS main commit under activation: `d82ed58f806026b27fe9e5685c938de3ca9d9366`
- Event Builder Production deployment observed: `dpl_DFZsX5gHRwkD8SLPRrRiyG54tCdV`
- Event Builder Production URL: `https://build.eventsible.info`
- Authenticated Admin Leads visual QA: PASSED on 2026-08-04
- ECC/VINCE and EventsGame: unchanged

## Scope

This activation applied only the reviewed Event Staff code-parity migration and ran one controlled Production Builder QA submission through the normal public Builder flow.

No Event Builder code, ECC/VINCE code, EventsGame data, Vercel environment variables, domains, aliases, outbox consumers, or automatic dispatching were changed.

Outbox processing and external dispatch remain future work. This verification proves intake-to-outbox event creation only.

## Migration Applied

Authorized migration:

`supabase/migrations/20260804181000_builder_quote_item_event_staff_code_parity.sql`

Reviewed source blob SHA:

`5c25e1205678b268bfd05e178c8b2c3a374f16c2`

Production migration history:

- Name: `builder_quote_item_event_staff_code_parity`
- Version: `20260804033918`
- Execution method: Supabase migration API, single authorized migration
- Result: success

The migration replaced only `public.os_normalize_builder_quote_item_service_name()` and recreated only `os_quote_items_builder_service_name_trg` on `public.os_quote_items`.

It did not modify `public.os_ingest_builder_submission(jsonb)`, `public.os_enqueue_integration_event(...)`, CRM tables, existing customer data, existing quote data, Builder code, or Vercel settings.

## Preflight And Post-Migration Counts

Counts before the migration:

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

Counts immediately after migration:

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

The migration itself created no CRM, contact, lead, event, quote, activity, or outbox rows.

## Object Verification

- `public.os_ingest_builder_submission(jsonb)` hash remained `329c0592aec62f78a182a7e3a741072a`.
- `public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)` hash remained `4ee441189c423010d627d4158f17385c`.
- `public.os_enqueue_builder_submission_received_from_activity()` hash remained `71ec907835fbb6f42279ecc94135c121`.
- `public.os_normalize_builder_quote_item_service_name()` hash became `ed0731e1235be1ef38b3f57a1a434a99`.
- `os_activity_events_builder_submission_outbox_trg` remained enabled on `public.os_activity_events` and restricted to `event_type = 'builder.submission_received'`.
- `os_quote_items_builder_service_name_trg` remained enabled on `public.os_quote_items` and now fires for `event_staff`, `event-asst`, and `event_asst`.

## Controlled Production QA Submission

Controlled QA label:

`EVENTSible Outbox Production QA 5`

Before submission, QA-specific counts were all zero and total outbox count was `4`.

The public Builder UI was used end-to-end. The final review page showed:

- Event type: Private Party
- Date: 2026-08-11
- Length: 3 hours
- Location: South Bend, IN
- Package: premium
- Services: DJ / MC, Selfie Booth with Prints, Basic Dance Floor Lighting, Live Singer / Vocalist, Event Assistant
- Subtotal displayed by Builder: `$790`
- Package savings displayed by Builder: `-$63`
- Travel displayed by Builder: `$0`
- Estimated total displayed by Builder: `$727`

The public UI returned the thank-you page and `Event request submitted!` notification. Browser console errors for the submission tab: none.

## Production Record Counts After QA

QA-specific counts after submission:

| Object | Count |
| --- | ---: |
| contacts | 1 |
| builder_submissions | 1 |
| leads | 1 |
| events | 1 |
| quote_versions | 1 |
| quote_items | 5 |
| activity_events | 1 |
| integration_outbox | 1 |

Global counts after submission:

| Object | Count |
| --- | ---: |
| contacts | 7 |
| builder_submissions | 7 |
| leads | 7 |
| events | 7 |
| quote_versions | 7 |
| quote_items | 34 |
| activity_events | 7 |
| integration_outbox | 5 |

## ID Linking

Production readback confirmed the QA chain is linked:

- contact_id: `0308a168-4198-49f5-93af-1a5199945147`
- builder_submission_id: `b48d0e5f-97ea-4d09-a9eb-3b59f4af98b4`
- lead_id: `a1ba31e5-eeef-4bb4-b164-76a4a754f79c`
- event_id: `72624d36-6db8-4839-a2b2-ecb201ebc313`
- quote_version_id: `f201f84b-aa24-4b3a-9464-1d1ed6407d16`
- activity_id: `01d45808-6121-4407-b781-b2fcee3fa9cd`
- outbox_id: `84223983-49ad-4142-85af-3faf5b60750d`

All expected relationships matched: submission-to-contact, event-to-submission, lead-to-contact/event/submission, quote-version-to-lead/event, activity-to-event, and outbox related IDs to the created records.

## Quote And Service Mapping

Quote version values:

- Version: `1`
- Status: `draft`
- Currency: `USD`
- Stored total: `727.00`
- Travel amount: `0.00`

Quote items:

| service_code | service_name | quantity | unit_price | line_total |
| --- | --- | ---: | ---: | ---: |
| `dj_mc` | `DJ & MC` | 3.00 | 95.00 | 285.00 |
| `selfie_booth_digital` | `Selfie Booth - Digital` | 3.00 | 100.00 | 300.00 |
| `dance-lighting` | `dance-lighting` | 1.00 | 100.00 | 100.00 |
| `live_performer` | `Live Performer / Singer` | 1.00 | 0.00 | 0.00 |
| `event-asst` | `Event Staff` | 3.00 | 35.00 | 105.00 |

The Event Staff code-parity fix passed: Production wrote `service_code = event-asst` and the quote item stored `service_name = Event Staff`.

Live Singer remained zero-dollar Custom Quote behavior and did not inflate the numeric total.

## Outbox Event

The QA submission created exactly one outbox row:

- Event type: `builder.submission_received`
- Payload version: `builder_submission_received_v1`
- Source application: `eventsible-event-builder`
- Idempotency key: `builder.submission_received:b48d0e5f-97ea-4d09-a9eb-3b59f4af98b4`
- Status: `pending`
- Attempt count: `0`
- Failure history: empty

Payload contained the expected operational fields:

- `contract_version = builder_submission_v1`
- `selected_package_tier = premium`
- `service_codes`
- `custom_quote_service_codes`
- `total_cents = 72700`
- `travel_cents = 0`
- `package_savings_cents = 6300`
- `planning_stage = Ready for a quote`
- `date_confidence = exact`

Payload privacy checks passed:

- No email key.
- No phone key.
- No raw payload key.
- No email pattern detected.
- No phone pattern detected.

The outbox event was not processed or dispatched during this verification.

## Idempotency Evidence

No second Production submission replay was attempted because it would create or risk a second client-visible inquiry. Production idempotency is supported by:

- Exactly one QA chain for the submitted QA label.
- Exactly one outbox row for the QA builder submission.
- Unique `os_builder_submissions_source_session_unique` index.
- Unique `os_activity_events_idempotency_unique` index.
- Unique `os_integration_outbox_idempotency_key_idx` index.
- Exact-head CI replay coverage from the integration workflow.

## RLS And Grants

Outbox table access:

- RLS enabled: yes
- `anon` select/insert: denied
- `authenticated` select/insert: denied
- `service_role` select/insert: allowed

Function execution grants:

| Function | anon | authenticated | public | service_role |
| --- | --- | --- | --- | --- |
| `os_enqueue_integration_event(...)` | denied | denied | denied | allowed |
| `os_enqueue_builder_submission_received_from_activity()` | denied | denied | denied | allowed |
| `os_ingest_builder_submission(jsonb)` | denied | denied | denied | allowed |
| `os_normalize_builder_quote_item_service_name()` | denied | denied | denied | allowed |

## Runtime And Security

- EVENTSible OS `/api/health`: HTTP 200, `ok: true`, service `EVENTSible OS Admin`.
- Event Builder public routes loaded during QA.
- Event Builder `/admin` remained protected when unauthenticated and showed Staff sign-in.
- Vercel runtime errors for `eventsible-os`: none found in the checked 30-minute window.
- Vercel runtime errors for `eventsible-event-builder`: none found in the checked 30-minute window.
- No service-role key, database password, access token, Host PIN, customer row dump, or private payload was printed in the verification notes.
- No Event Builder code changed.
- No ECC/VINCE or EventsGame change occurred.
- No Vercel environment variable, domain, or alias was changed.

## Admin Leads Visual QA

Authenticated Admin Leads visual QA was completed successfully on 2026-08-04.

Verified lead:

`EVENTSible Outbox Production QA 5`

Confirmed visual checks:

- Exactly one lead displayed.
- Private Party event type displayed correctly.
- Date and time displayed correctly.
- Event length displayed as 3 hours.
- South Bend location displayed correctly.
- DJ/MC displayed.
- Selfie Booth with Prints displayed.
- Live Singer remained Custom Quote.
- Event Staff displayed.
- Final estimate displayed as `$727`.
- Travel displayed as `$0`.
- Package savings and quote status displayed correctly.
- No duplicate lead existed.
- No duplicated services existed.
- No raw JSON displayed.
- No outbox payload displayed.
- No unnecessary internal IDs displayed.
- No secrets displayed.
- Admin route remained protected when signed out.

## Recovery Checkpoint

If intake-to-outbox emission must be stopped, disable only:

```sql
alter table public.os_activity_events
  disable trigger os_activity_events_builder_submission_outbox_trg;
```

If Event Staff normalization must be stopped, disable only:

```sql
alter table public.os_quote_items
  disable trigger os_quote_items_builder_service_name_trg;
```

Preserve Builder intake, contacts, leads, events, quotes, activity records, and outbox rows. Prefer a narrow forward-fix over destructive rollback.

## Final Classification

- Existing Builder intake: LIVE
- Builder intake-to-outbox trigger: ACTIVE
- Event Staff code-parity migration: APPLIED
- Controlled Production QA chain/outbox: PASSED
- RLS/grants/security: PASSED
- Authenticated Admin Leads visual QA: PASSED
- Outbox processing/external dispatch: FUTURE WORK / NOT ACTIVATED
- Ecosystem Integration Foundation: PRODUCTION VERIFIED

## Recommended Next Phase

Build the `eventsible.info` public homepage and service website foundation.
