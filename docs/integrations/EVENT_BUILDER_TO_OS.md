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
- Quote-item catalog mapping cleanup is now handled additively by the Builder shared-contract mirror for known service codes; Preview/live intake QA must still verify deployed OS records before marking production ready.
- Legacy `quote_submissions` code exists for inherited tooling/history; it should not become a new parallel system of record.

## Contract Foundation

The canonical Builder payload contract is `builder_submission_v1`, defined in `src/contracts/ecosystem-contracts.mjs` and documented in `ECOSYSTEM_INTEGRATION_FOUNDATION.md`.

Event Builder consumes a safe mirrored TypeScript/Zod contract in its own repository. It must not import private OS runtime files directly.

