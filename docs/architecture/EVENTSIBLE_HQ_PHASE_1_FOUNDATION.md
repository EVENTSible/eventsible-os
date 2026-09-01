# EVENTSible HQ Phase 1 Foundation

- Status: IMPLEMENTED / NEEDS PREVIEW VERIFICATION
- Scope: Mission Control presentation and canonical Gig Workspace information architecture
- Data authority: existing EVENTSible OS records
- Schema changes: NONE

## Phase 1 composition

Mission Control composes staff-facing lead summaries from `os_contacts`, `os_leads`, `os_builder_submissions.normalized_payload`, `os_events`, `os_quote_versions`, and `os_quote_items`. Raw Builder payloads are not queried for the normal lead experience.

The Gig Workspace route is keyed by the canonical `event_id` and composes `os_events`, `os_contacts`, `os_bookings`, `os_booking_services`, `os_quote_versions`, and `os_activity_events`. Tasks, staffing, equipment, and documents remain explicit unconnected states until their current canonical tables and relationships are verified. Readiness is a list of known checks, not a fabricated percentage.

## Later client communication contract

The smallest later communications record should reference existing OS identities rather than duplicate them:

- `id`
- `contact_id` and `event_id`
- optional `booking_id`
- communication type and channel
- template identifier and immutable template version
- lifecycle status: `upcoming`, `ready_for_review`, `scheduled`, `sent`, `delivered`, `replied`, `needs_attention`, or `skipped`
- scheduled, sent, delivered, and replied timestamps where applicable
- provider adapter and provider message identifier
- idempotency key
- delivery result and safe error metadata
- created/updated timestamps and actor/source

Scheduling should create or advance a reviewable OS-owned communication record. Provider adapters may send email or SMS only after policy checks and explicit eligibility. A timer must not send directly. Suppression rules must be able to inspect unresolved event/client issues before sending review requests or other sensitive lifecycle messages.

## Future operational seams

- Gig readiness should evaluate verified event-linked checks for client details, schedule, staffing, equipment, tasks, money, contracts, client changes, and final confirmation.
- Gig issues should retain `event_id` and later reference equipment and follow-up task IDs without copying those records.
- Equipment assignments should reference canonical equipment IDs and event IDs, preserving condition, maintenance, load-out, return, and incident history.
- Staffing assignments should reference canonical staff/helper IDs, event IDs, required roles, assignment state, and least-privilege access.
- External provider integrations should store provider references and synchronization state around OS records; GigSalad, Google Calendar, Gmail, and PayPal must not become competing systems of record.

## Verification boundary

Authenticated Preview browser QA requires Preview-scoped Supabase URL and publishable-key configuration. Production-only credentials must not be copied into Preview as an implicit implementation step. No Production data, schema, domain, or deployment changes are part of this foundation.
