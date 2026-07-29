# Event Builder to EVENTSible OS

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: Event Builder public intake and OS lead/quote chain
- Supersedes: Lovable-only integration wording
- Related documents: `../ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md`

The current production Event Builder at `https://build.eventsible.info` submits public planning inputs into EVENTSible OS through the server-side intake path. The database function is `public.os_ingest_builder_submission`.

The confirmed chain is:

Contact -> Builder submission -> Lead -> Event -> Quote draft -> Quote items.

## Current Known Warnings

- Production Admin Leads visual QA still needs a fresh authenticated staff session.
- Quote-item catalog mapping cleanup remains a known follow-up item.
- Legacy `quote_submissions` code exists for inherited tooling/history; it should not become a new parallel system of record.

