# EVENTSible HQ Calendar and Existing Gig Intake Foundation

- Status: IMPLEMENTED / PREVIEW QA PARTIAL
- Owner: EVENTSible OS
- Scope: protected Calendar / Date Book, conservative date availability, and reusable import-review contracts
- Last reviewed: 2026-09-02

## Calendar ownership and data contract

EVENTSible OS remains the system of record. The first Calendar release reads `os_event_dashboard_v`, which composes canonical `os_events`, `os_bookings`, `os_booking_services`, and contact context. Events remain keyed by `os_events.id`, and every calendar item opens `/admin/gigs/[eventId]`; there is no second event-detail record or calendar database.

Calendar dates are derived from `os_events.starts_at` in each event's canonical `os_events.timezone`. The OS default timezone is `America/Indiana/Indianapolis`. Events without a start timestamp are excluded from dated views and reported as unscheduled rather than assigned a fabricated date or time.

## V1 booked-date rule

A dated event counts as booked when it is not cancelled/archived and either:

- `os_bookings.status` is `confirmed` or `completed`; or
- `os_events.status` is `booked`, `planning`, `ready`, `active`, or `completed`.

`cancelled` bookings and `cancelled`/`archived` events do not occupy a date. Booking states `pending`, `pending_contract`, and `pending_deposit`, plus event states `draft`, `inquiry`, `quoted`, and `pending`, are shown separately as Inquiry / Hold and never count as booked.

The date checker labels zero booked events as Open, one as Booked, and more than one as Multiple Events. Open means only that no canonical confirmed/booked event occupies the date. It is not a claim about partial-day, travel, staffing, service, or equipment availability. Completed events remain booked historical evidence on their dates.

## Existing Gig Intake discovery

Current source can create the canonical chain through Builder lead/quote conversion, but that action assumes a lead and accepted quote and performs several table writes. It is not a reusable atomic contract for an already-booked direct event. No canonical external-reference field or Import Review queue currently exists, and no live external-reference keys were found in event settings or booking metadata.

Manual Add Existing Gig therefore remains blocked pending a separately approved fixed-signature transactional database contract. The smallest safe manual contract must atomically select or create a canonical contact, create one event, create one confirmed booking, seed booking services, record source/provenance and one staff activity, and return stable IDs. It needs explicit idempotency behavior before external adapters can use it.

## Shared Import Review proposal

Every future adapter should emit a proposed record with the same review shape before any canonical write:

- source and external reference;
- title, event type, date, start/end, timezone, and venue;
- proposed client/contact details;
- proposed services and price when the source actually supplies them;
- proposed notes, missing fields, provenance/confidence, likely matches, and date conflicts.

Staff then chooses Import as New Gig, Match Existing Gig, Ignore / Skip, or Review Later. Matching should rely on exact provider UID/reference first and then surface non-destructive warnings from date/time, contact/email, venue, and title evidence. V1 must not automatically fuzzy-merge or overwrite canonical records.

A durable adapter queue/provenance contract will require separately approved OS schema, including a uniqueness boundary for source plus external reference. It must remain an OS intake/review mechanism, not a parallel CRM or imported-events database.

## Source adapter boundaries

### GigSalad iCal

GigSalad's official iCal booking feed is the approved first GigSalad ingestion path. Scraping, crawler/browser-plugin extraction, and reverse engineering undocumented private APIs are excluded. The feed URL is sensitive configuration and must never appear in logs or reports.

No sample feed was supplied for this slice, so actual `VEVENT` coverage is not yet verified. A future adapter should inspect `UID`, `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`, `DESCRIPTION`, `URL`, recurrence fields, and timezone declarations from a user-provided sample before mapping them. Client, phone, price, and service fields must remain Unknown unless that feed proves they exist. Store only the provider UID and necessary provenance, not the entire raw feed.

### Google Calendar and Gmail

Google Calendar should map into the same Import Review proposal and remain a source/sync reference. Gmail may later propose enrichment for a selected event/contact; staff must review it before canonical values change. Neither source gets its own CRM/event model, and email must never silently overwrite OS data.

## Unavailability gap

No canonical OS table or function currently represents vacation, personal blocks, maintenance, or other non-customer unavailability. These must not be faked as customer events. A future approved availability model is required before the Date Book can include business blocks or claim partial-day availability.
