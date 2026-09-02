# EVENTSible HQ Phase 1.5: Gig Readiness and Operations

- Status: IMPLEMENTED / PREVIEW VERIFIED
- Scope: canonical Gig Workspace composition and rule-based readiness
- Data authority: existing EVENTSible OS records
- Schema changes: narrow transactional RPCs only; no new tables or columns
- Production changes: NONE

## Implemented composition

The Gig Workspace remains keyed by canonical `os_events.id`. It composes event, contact, booking, booking-service, quote, task, file, planning-assignment, allow-listed event-fact, and activity records. It does not copy these records into a workspace table.

The event-day header prioritizes routeable venue information, client call/text/email actions, event start/end, operational times when explicitly stored, important notes, services, and readiness warnings. Raw JSON is not rendered. JSON-backed settings, metadata, configuration, and facts are read only through an explicit allow-list of known business fields.

## Current readiness rules

Readiness has five states: `ready`, `needs_attention`, `not_ready`, `not_applicable`, and `unknown`. Unknown never contributes to Ready, and there is no percentage.

- Client: canonical contact, usable phone/email, preferred channel, and day-of contact.
- Schedule and venue: event start/end, routeable venue/address, and independently recorded arrival/load-in/setup information.
- Services: canonical booking-service linkage. A booked gig without services is Not Ready.
- Tasks and planning: open/overdue event tasks and the current planning-assignment state. Zero recorded tasks is Unknown, not complete.
- Money: canonical booking balance, due date, and payment state. A future or event-day balance is Attention rather than automatically Not Ready; an overdue balance is Not Ready.
- Contract and documents: canonical contract status from the booking plus event-linked `os_files`. A status is not treated as a document.
- Staffing and equipment: Unknown because no verified event relationship currently exists in the schema.
- Query failures: affected areas are Unknown and explicitly warned; partial data is not treated as complete.

## Operational timing edit contract

Authenticated staff may edit five event-local clock-time facts from the canonical Gig Workspace. The existing `os_event_facts` record remains authoritative; no workspace or metadata copy is created.

| Workspace field | Canonical fact key | Value contract |
| --- | --- | --- |
| Arrival time | `event.arrival_time` | normalized `HH:MM` string |
| Load-in | `event.load_in_window` | `{ start: "HH:MM", end: "HH:MM" | null }` |
| Setup complete by | `event.setup_complete_by` | normalized `HH:MM` string |
| Breakdown | `event.breakdown_start` | normalized `HH:MM` string |
| Must be out by | `event.must_be_out` | normalized `HH:MM` string |

Clock times are intentionally stored without date or timezone conversion because they describe the event's local operating schedule. Event date and timezone remain canonical on `os_events`. Blank form values preserve existing facts; fact removal is not part of this slice. The authenticated staff action calls the fixed-parameter `os_update_event_operational_timing` RPC, which validates the five allow-listed facts and atomically commits their `(event_id, fact_key)` upserts with one staff activity entry only when values actually change. The RPC derives the actor from `auth.uid()` and does not grant general activity insertion.

## Event-day logistics edit contract

Four existing allow-listed `os_events.settings` paths are the canonical writable storage for the focused logistics editor. Legacy `os_bookings.metadata` values remain read-only fallbacks and are not migrated or rewritten.

| Workspace field | Canonical settings key | Value contract |
| --- | --- | --- |
| Staff call | `staff_call_time` | normalized event-local `HH:MM` string |
| Setup start | `setup_start` | normalized event-local `HH:MM` string |
| Room / area | `room_area` | trimmed plain text, maximum 160 characters |
| Load-in / access notes | `load_in_details` | trimmed plain text, maximum 1,500 characters |

Blank form values preserve existing settings; explicit clearing is deferred. The fixed-parameter `os_update_event_day_logistics` RPC locks and authorizes the canonical event, merges only supplied changed keys into the existing settings object, preserves every unrelated setting, and atomically inserts one staff activity. It derives the actor from `auth.uid()`, accepts no arbitrary JSON or activity input, and performs neither an event update nor an activity insert for a no-op. Current readiness continues to consume staff call and setup start only through its existing operational context; this slice adds no new readiness rule or percentage.

## Day-Of Contact relationship contract

`os_events.day_of_contact_id` is the nullable, event-scoped relationship to an existing canonical `os_contacts.id`. It does not duplicate a name, phone, or email. The Gig Workspace resolves those values from the linked contact and derives “Same as primary” only when `day_of_contact_id = primary_contact_id`.

Authenticated staff assign or change the relationship through the fixed-parameter `os_update_event_day_of_contact` RPC. The function verifies the staff session, event access, canonical event, and active target contact, then atomically updates the relationship and records one staff activity. Matching assignments are no-ops. Clearing, new-contact creation, and contact deduplication are outside this slice.

The earlier `os_contacts.metadata` and `os_bookings.metadata` name/phone fields remain read-only compatibility fallbacks only when no canonical relationship exists. They are never written or backfilled by the Day-Of Contact workflow. The existing readiness check recognizes a canonical relationship without adding a new score or percentage.

## Event-day notes contract

Active staff-private `event_day` records in `os_event_notes` are the canonical source for event-day instructions and reminders. `is_pinned` controls prominence; pinned notes sort before unpinned notes, with newest notes first within each group. This focused workspace does not expose shared/client notes, deletion, archiving, rich text, attachments, or threaded discussion.

Authenticated staff create or update one note through the fixed-parameter `os_upsert_event_day_note` RPC. The function verifies the staff session and event access, locks the canonical event and existing note when applicable, forces `note_type = 'event_day'`, `visibility = 'staff'`, and `status = 'active'`, derives the author/activity actor from `auth.uid()`, and atomically commits the note plus one focused activity event. Note bodies are trimmed plain text with a 1,500-character maximum and are not copied into activity payloads. A no-op creates neither a note update nor activity. Event-day notes do not affect readiness in this slice.

## Service readiness template contract

Future service templates for DJ, Karaoke, Photo Booth, 360 Booth, Kids DJ, Arts and Crafts, Games/Trivia, and Wedding DJ should define versioned requirement keys, applicability rules, responsible role, evidence source, severity, and completion criteria. Template results must reference canonical `event_id`, `booking_service_id`, and optional task/equipment/staff assignment IDs. They must not create a second service catalog or readiness database.

## Closeout and Gig Log contract

Lifecycle and readiness are separate. The future lifecycle may use Inquiry, Quoting, Booked, Planning, Prep, Event Day, Closeout, Follow-up, and Complete, with On Hold, Cancelled, and Archived exceptions, but Phase 1.5 adds no lifecycle schema.

Future closeout should reference the canonical event and track equipment return/inspection, payment completion, staff notes, Gig Log completion, deliverables/gallery, thank-you, and review-request eligibility.

A structured Gig Log or issue should retain `event_id`, category, severity, occurred time, summary, detail, resolution state, reporter, and follow-up IDs. Equipment incidents should support this chain without copying records:

`Gig issue -> canonical equipment flag -> repair/test task -> warning on a future assignment`

## Equipment and staffing contracts

Equipment remains OS-owned. The future lifecycle is Required, Assigned, Tested, Loaded, At Event, Returned, and Inspected. Canonical equipment needs category, location, status, condition, maintenance/issues, kit membership, gig assignment, load-out, return/check-in, and incident history.

Staffing remains OS-owned. Future records should relate event requirements to canonical team/helper identities, roles/capabilities, assignment and confirmation state, call/arrival times, and least-privilege helper access. Empty staffing or equipment UI must remain Unknown until these relationships exist.

## Contracts, invoices, payments, and PayPal adapter

OS owns the business meaning and relationships among event, contact, booking, contract, invoice, and payment. A provider-neutral future contract should support:

- canonical IDs and optional provider adapter/reference;
- document/version, issue/sent/due/paid/cancelled timestamps and status;
- subtotal, adjustments, tax, total, deposit, remaining balance, currency, and payment terms;
- external/manual payment reconciliation and immutable provider events;
- idempotency key, synchronization state, safe error metadata, and actor/source.

PayPal may generate or host invoices and collect payment, but its reference and state attach to OS records. The adapter must not make PayPal the event, contact, booking, or invoice system of record, and the core contract must allow another provider.

## Client communication timeline contract

Future stages include booking confirmation, planning checkpoint, missing-information reminder, final confirmation, last-minute change, thank-you, gallery delivery, review request, and future-event follow-up. States are Upcoming, Ready for Review, Scheduled, Sent, Delivered, Replied, Needs Attention, and Skipped.

Each record should reference `contact_id`, `event_id`, optional `booking_id`, channel, immutable template version, scheduled time, provider reference, delivery/reply activity, idempotency key, and suppression rules. Scheduling advances an OS-owned reviewable record; timers do not directly send. A serious unresolved gig/client issue must be able to suppress a review request.

## External integration seams

Gmail/email providers send and reconcile communication records. Google Calendar synchronizes canonical event schedule changes. GigSalad imports or links leads and activity. PayPal sends/reconciles invoices and payments. Drive stores files while `os_files` owns their searchable business association. SMS providers send/reconcile communication records. None becomes a competing OS system of record.

## Verification status

Authenticated Preview QA verified the canonical workflow, Gig Workspace, readiness behavior, responsive layouts, and clean browser/runtime behavior using a synthetic TEST ONLY fixture. Repeat conversion is classified as PASS WITH RUNTIME LIMITATION: the post-conversion UI correctly removed the action, while source tests and canonical post-conversion counts confirmed one event, one booking, one booking service, stable IDs, and no duplicate conversion activity. No Auth-limit change or new Preview alias was introduced solely to force a second live invocation.
