# EVENTSible HQ Phase 1.5: Gig Readiness and Operations

- Status: IMPLEMENTED / PREVIEW VERIFIED
- Scope: canonical Gig Workspace composition and rule-based readiness
- Data authority: existing EVENTSible OS records
- Schema or data changes: NONE
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
