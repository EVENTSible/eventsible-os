# Builder Outbox Production Activation - 2026-08-04

- Status: PARTIAL / NEEDS VERIFICATION
- Repository: `EVENTSible/eventsible-os`
- Production Supabase project: EVENTSible OS, ref `cplpbzudjprzbnzocirc`
- OS production URL: `https://eventsible-os.vercel.app`
- Builder production URL: `https://build.eventsible.info`

## Scope

This report records the authorized Production activation and verification of the Builder submission outbox trigger after the quote-lookup and payload-parity forward fixes.

No Event Builder code was changed. ECC/VINCE and EventsGame were not modified. No outbox consumers or external dispatchers were added.

## Migration And Trigger State

Authorized wiring objects were already present from prior approved migrations. The payload-parity helper migration was applied before this verification:

- Migration source: `supabase/migrations/20260804013000_builder_submission_outbox_payload_parity_fix.sql`
- Supabase migration name: `builder_submission_outbox_payload_parity_fix`
- Recorded migration version: `20260804014458`
- Function replaced: `public.os_enqueue_builder_submission_received_from_activity()`
- Trigger: `os_activity_events_builder_submission_outbox_trg` on `public.os_activity_events`

The trigger was re-enabled only after the helper verification passed.

Verified function hashes after re-enable:

| Object | Hash |
| --- | --- |
| `public.os_ingest_builder_submission(jsonb)` | `329c0592aec62f78a182a7e3a741072a` |
| `public.os_enqueue_integration_event(...)` | `4ee441189c423010d627d4158f17385c` |
| `public.os_enqueue_builder_submission_received_from_activity()` | `71ec907835fbb6f42279ecc94135c121` |

The live intake function remained unchanged. The trigger helper contains no direct `q.quote_id` reference and does not promote `activity.payload.quote_id` unless a genuine quote ID exists.

## Controlled Production QA Submission

One synthetic QA submission was sent through the deployed Builder server function used by the public Builder flow.

Synthetic label: `EVENTSible Outbox Production QA 3`

Scenario:

- Event type: Private Party
- Planning stage: Ready for a quote
- Date: 2026-08-11
- Time: 18:00 to 21:00
- Length: 3 hours
- Location: South Bend, Indiana
- Goals: Packed Dance Floor, Photos & Video, Guest Interaction
- Services: DJ/MC, Selfie Booth with Prints, Live Singer, Event Staff

Contact details are intentionally omitted from this report.

## Record Counts

Global Production counts before submission:

| Object | Count |
| --- | ---: |
| Contacts | 4 |
| Builder submissions | 4 |
| Leads | 4 |
| Events | 4 |
| Quote versions | 4 |
| Quote items | 20 |
| Activity events | 4 |
| Integration outbox | 2 |

Global Production counts after first submission and idempotent replay:

| Object | Count |
| --- | ---: |
| Contacts | 5 |
| Builder submissions | 5 |
| Leads | 5 |
| Events | 5 |
| Quote versions | 5 |
| Quote items | 24 |
| Activity events | 5 |
| Integration outbox | 3 |

QA-specific counts after submission:

| Object | Count |
| --- | ---: |
| Contact | 1 |
| Builder submission | 1 |
| Lead | 1 |
| Event | 1 |
| Quote version | 1 |
| Quote items | 4 |
| Activity event | 1 |
| Integration outbox event | 1 |

The idempotent replay with the same Builder submission identity returned the duplicate path and did not change any row counts.

## ID Linking

| Record | ID |
| --- | --- |
| Contact | `438f122e-5a60-484b-9128-165330b1c98d` |
| Builder submission | `1e12071d-1a5b-48a1-a445-8eb8c78d1863` |
| Lead | `488e8c10-d9cc-4a3a-bfb3-850164675961` |
| Event | `c37cf565-9a96-4e32-b0a9-0641ce21fd48` |
| Quote version | `9610b096-5f02-43fa-8982-0379ddb6a1e7` |
| Activity event | `24d677e9-f176-4f21-8a5f-d9a676f69f17` |
| Outbox event | `33c3c5a5-2c27-4d47-b251-5463cea503a8` |

The outbox `related_record_ids` links the contact, Builder submission, lead, event, quote version, and activity event. `quote_id` is omitted because the Production quote-version schema does not provide a genuine quote ID column.

## Contract And Payload Verification

Builder submission fields verified:

- `source`: `eventsible_event_builder`
- `submitted_from`: `eventsible-event-builder`
- `intake_version`: `2`
- `contract_version`: `builder_submission_v1`
- `timezone`: `America/Indiana/Indianapolis`

Outbox fields verified:

- `event_type`: `builder.submission_received`
- `payload_version`: `builder_submission_received_v1`
- `source_application`: `eventsible-event-builder`
- `idempotency_key`: `builder.submission_received:1e12071d-1a5b-48a1-a445-8eb8c78d1863`
- `status`: `pending`
- `attempt_count`: `0`
- `failure_history`: `[]`

Outbox payload verified as privacy-minimized:

- No email address
- No phone number
- No raw Builder submission payload
- No full contact record
- No auth token, service-role value, password, or private notes

Payload operational fields verified:

- `contract_version`: `builder_submission_v1`
- `selected_package_tier`: `premium`
- `service_codes`: `dj_mc`, `selfie_booth_prints`, `live_performer`, `event_staff`
- `custom_quote_service_codes`: `live_performer`
- `total_cents`: `63500`
- `travel_cents`: `0`
- `package_savings_cents`: `5500`
- `planning_stage`: `Ready for a quote`
- `date_confidence`: `exact`

## Quote And Service Mapping

Quote version values:

| Field | Value |
| --- | ---: |
| `subtotal` | 635 |
| `total_amount` | 635 |
| `travel_amount` | 0 |
| `deposit_amount` | 159 |
| `discount_amount` | 0 |

Quote items:

| Service code | Service name | Quantity | Unit price | Line total |
| --- | --- | ---: | ---: | ---: |
| `dj_mc` | DJ & MC | 3 | 95 | 285 |
| `selfie_booth_prints` | Selfie Booth + Prints | 3 | 100 | 300 |
| `live_performer` | Live Performer / Singer | 1 | 0 | 0 |
| `event_staff` | event_staff | 3 | 35 | 105 |

Live Singer remained Custom Quote and contributed `0` to numeric totals. Travel was `0`. The Builder submitted UI-equivalent final estimate was `$635`, and the OS quote total was `$635`.

Known limitation discovered during this verification: the Event Staff quote item maps to the stable service code `event_staff`, but the stored display label is `event_staff` instead of a polished human-readable label such as `Event Assistant` or `Event Staff`. This should be corrected with a narrow mapping fix before final `PRODUCTION VERIFIED` classification.

## RLS And Grants

Verified after submission:

| Object | anon | authenticated | public | service_role |
| --- | --- | --- | --- | --- |
| `os_enqueue_builder_submission_received_from_activity()` execute | denied | denied | not granted | allowed |
| `os_enqueue_integration_event(...)` execute | denied | denied | not granted | allowed |
| `os_integration_outbox` select/insert | denied | denied | not granted | service-only |

RLS is enabled on `public.os_integration_outbox`.

## Application Health

- OS health: `https://eventsible-os.vercel.app/api/health` returned HTTP 200 with `ok: true` and service `EVENTSible OS Admin`.
- Builder home: `https://build.eventsible.info` returned HTTP 200 and rendered expected public assets and theme-player markup.
- Builder public route status checks returned HTTP 200 for `/build`, `/services`, `/packages`, `/quote`, `/contact`, and `/media`.
- `/admin` did not expose raw CRM, normalized payload, outbox payload, or `builder.submission_received` content to unauthenticated fetches.
- Vercel runtime error summaries for OS and Builder reported no runtime errors in the checked window.

## Remaining Verification Gaps

The Integration Foundation is not marked `PRODUCTION VERIFIED` in this report because two gates remain open:

1. Authenticated Admin Leads visual QA still requires a signed-in staff/admin browser session on `https://build.eventsible.info/admin`.
2. Event Staff quote item display should be corrected from `event_staff` to a human-readable label while preserving the stable `event_staff` service code.

## Classification

Final classification for this activation pass: PARTIAL / NEEDS VERIFICATION.

The Builder intake-to-outbox emission is active and produced exactly one outbox event for one synthetic QA submission, and idempotency replay created no duplicates. Final `PRODUCTION VERIFIED` status should wait for the narrow Event Staff label fix plus authenticated Admin visual QA.

## Recovery Checkpoint

If emission must be stopped, disable only:

```sql
alter table public.os_activity_events
  disable trigger os_activity_events_builder_submission_outbox_trg;
```

Do not delete legitimate outbox rows or CRM records. Preserve Builder intake and use a narrow forward-fix for any mapping/display defect.

## Recommended Next Phase

Prepare a narrow OS service-label mapping fix for `event_staff`, verify it through CI-local Supabase and a safe Production migration review, then complete authenticated Admin Leads visual QA for the synthetic lead. Mark the Ecosystem Integration Foundation `PRODUCTION VERIFIED` only after those gates pass.
