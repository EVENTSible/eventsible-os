# EVENTSible Data Flow Overview

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: cross-app data movement
- Supersedes: duplicate lead/event database plans
- Related documents: `../ecosystem/EVENTSIBLE_SYSTEM_OF_RECORD_MATRIX.md`, `../integrations/EVENT_BUILDER_TO_OS.md`

## Verified Builder Flow

Visitor -> Event Builder -> server-only intake -> `public.os_ingest_builder_submission` -> OS contact -> OS builder submission -> OS lead -> OS event -> OS quote draft -> OS quote items.

The intake is idempotent for repeated submissions with the same submission identity and should not create duplicate contacts, leads, events, or quotes for the same Builder submission.

## Future Booking Flow

OS lead review -> approved quote -> Convert to Gig -> booking/event workspace -> client membership -> Client Portal -> contracts/payments/tasks/staff/equipment -> optional ECC/VINCE room activation.

## Future Live Activation Flow

OS booked event -> activation contract -> ECC/VINCE room -> Host controls -> Player/Audience/Join routes. ECC/VINCE must receive only the event-day data it needs and must not become the business CRM.

