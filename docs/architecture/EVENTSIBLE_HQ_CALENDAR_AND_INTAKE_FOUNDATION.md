# EVENTSible HQ Calendar and Existing Gig Intake Foundation

- Status: CALENDAR PRODUCTION VERIFIED / EXISTING GIG INTAKE IMPLEMENTED PENDING PREVIEW QA
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

## Existing Gig Intake transactional foundation

The legacy Builder lead/quote conversion and GigTracker import paths remain excluded. They do not provide the atomic, idempotent direct-booking contract required here.

The approved foundation introduces staff-private `os_event_import_candidates` records with version `existing_gig_candidate_v1`. Each candidate has a bounded 64 KiB proposal, a unique `(source, external_reference)` identity, human review status, and optional links to the matched or imported canonical records. Authenticated staff may read and create candidates and change only bounded review-decision columns. Staff cannot delete candidates or directly claim an imported result.

`os_import_existing_gig(uuid)` is the only import path. It is a fixed-signature authenticated staff `SECURITY DEFINER` function with an empty search path and schema-qualified relations. It locks one pending candidate, validates the bounded proposal, deliberately reuses a selected active contact or creates a reviewed new contact, creates one booked event, inserts a pending booking plus validated active catalog services, and then confirms the booking so existing canonical triggers own planning, membership, fact, message, activity, and outbox bootstrap effects. The candidate imported state and a focused staff activity commit in the same transaction. A replay returns the already-recorded contact, event, and booking IDs without creating duplicates.

Manual Add Existing Gig creates a candidate, not a business record. Staff can then Import as New Gig, Match Existing Gig, Review Later, or Ignore. Match only links the candidate to an existing event and does not mutate that event. Potential matches and date conflicts are deterministic warnings; there is no fuzzy merge or automatic import.

## Shared Import Review proposal

Every future adapter should emit a proposed record with the same review shape before any canonical write:

- source and external reference;
- title, event type, date, start/end, timezone, and venue;
- proposed client/contact details;
- proposed services and price when the source actually supplies them;
- proposed notes, missing fields, provenance/confidence, likely matches, and date conflicts.

Staff then chooses Import as New Gig, Match Existing Gig, Ignore / Skip, or Review Later. Matching should rely on exact provider UID/reference first and then surface non-destructive warnings from date/time, contact/email, venue, and title evidence. V1 must not automatically fuzzy-merge or overwrite canonical records.

The candidate contract is the reusable adapter boundary for future GigSalad iCal, Google Calendar, and Gmail-assisted proposals. Those adapters remain separate future slices. Provider secrets, feed URLs, full feeds, email threads, and raw provider payloads do not belong in candidate records.

## Existing Gig Intake rollback

Schema rollback revokes authenticated execution of `public.os_import_existing_gig(uuid)`, drops that function, and drops `public.os_event_import_candidates` (including its table-owned policies, constraints, indexes, and timestamp trigger). Rollback does not delete or alter canonical contacts, events, bookings, services, or bootstrap records already created by a reviewed import.

## Source adapter boundaries

### GigSalad iCal

GigSalad's official iCal booking feed is the approved first GigSalad ingestion path. Scraping, crawler/browser-plugin extraction, and reverse engineering undocumented private APIs are excluded. The feed URL is sensitive configuration and must never appear in logs or reports.

A sensitive representative three-event sample verified GigSalad's current calendar shape without entering source control. The calendar declares `PRODID:gigsalad.com`, iCalendar 2.0, Gregorian scale, and an `America/New_York` VTIMEZONE with daylight/standard definitions. Each observed `VEVENT` has a unique `BA-<booking-number>@gigsalad.com` UID, UTC `DTSTAMP`, summary, folded/escaped description, IANA-TZID start and end, and escaped-comma full-address location. One event crosses local midnight, and the parser preserves the independently dated start and end. The sample did not contain status, last-modified, created, sequence, organizer, attendee, category, recurrence, alarm, calendar-name, or calendar-timezone extension fields.

The demonstrated description contract has exactly bounded `GigSalad Booking #<number>` and `Client name: <name>` labels plus a folded source-link line. The adapter maps the full UID to `external_reference`, the number to provenance, the summary to proposed event title, the client label to an unresolved proposed contact name, the IANA schedule to canonical proposal timestamps, and the unsplit location to address evidence. It stores only whether a source link exists; it does not retain the link. Event type, canonical contact decision, email, phone, services, amount, payment state, and other absent facts remain unresolved. Unknown description lines may remain bounded review notes but never become authoritative structured fields.

Candidate planning creates new `gigsalad_ical` UID proposals and treats exact replay as unchanged. The current candidate grants do not allow staff clients to rewrite `proposed_data`; therefore changed pending/review-later proposals are preserved with a refresh-contract warning, while imported, matched, and ignored candidates are never reopened or overwritten. Cancellation and recurrence support remain generic warnings only because neither convention appeared in the real sample.

The bounded adapter adds a staff-authenticated manual Sync action on `/admin/imports`. It reads `GIGSALAD_ICAL_FEED_URL` only inside the server action, accepts HTTPS (or normalized `webcal`) configuration, enforces a 12-second request timeout, a 1 MiB response limit, and the parser's 500-VEVENT limit, then uses the existing staff RLS session to insert pending candidates. It never uses a service-role credential and never writes contacts, events, bookings, services, leads, quotes, activity, or Calendar data. The UI receives only configured/not-configured state and aggregate counts; the feed URL, raw feed, raw VEVENT, and source link are never serialized or persisted. Exact replays create no duplicates through the existing `(source, external_reference)` uniqueness boundary. Because no safe proposal-refresh write contract exists, `refreshed` remains zero and changed existing candidates are truthfully counted as preserved.

### Google Calendar and Gmail

Google Calendar should map into the same Import Review proposal and remain a source/sync reference. Gmail may later propose enrichment for a selected event/contact; staff must review it before canonical values change. Neither source gets its own CRM/event model, and email must never silently overwrite OS data.

## Unavailability gap

No canonical OS table or function currently represents vacation, personal blocks, maintenance, or other non-customer unavailability. These must not be faked as customer events. A future approved availability model is required before the Date Book can include business blocks or claim partial-day availability.
