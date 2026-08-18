# EVENTSible OS to Client Portal

- Status: IMPLEMENTED / PREVIEW VERIFICATION PENDING
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: booked-client workspace
- Supersedes: `portal.eventsible.biz` as the canonical future domain
- Related documents: `../ecosystem/EVENTSIBLE_DOMAIN_AND_APP_INDEX.md`

The canonical planned client portal domain is `client.eventsible.biz`. The portal should expose membership-scoped event data from OS: booking status, planning progress, services, balances, shared files, and messages.

The OS repository contains legacy client portal assets plus the current Next.js client workspace.

## Wedding Companion emergency MVP

Implemented on the `codex/wedding-companion-mvp` branch as a narrow booked-client planning slice:

- `/client/login`: passwordless booked-client sign-in using the canonical Supabase Auth project
- `/client`: membership-scoped client event list through `os_client_portal_v`
- `/client/wedding/[eventId]`: six-section Wedding Companion with save-and-return, autosave, conditional ceremony questions, required-answer progress, and final submission
- `/admin`: one-click wedding activation that reuses the canonical contact, event, membership, planning template, and assignment records
- `/admin/wedding/[eventId]`: staff-readable Wedding Companion answer summary and client preview

The emergency MVP stores answers in `os_planning_answers` under the existing Wedding Hero assignment. It does not create a parallel wedding, contact, event, booking, or client database.

Client access remains gated by `os_event_members.user_id`, existing RLS helpers, and security-invoker portal views. Client activation uses the server-only Supabase admin client only after staff authorization.

## Current release boundary

- Production remains unchanged until authenticated Preview QA passes and promotion is explicitly authorized.
- `client.eventsible.biz` remains the canonical booked-client domain, but initial sendable access may use the verified OS host with the `/client` route until domain routing is attached and verified.
- Files, messages, contracts, invoices, payments, AI planning, and a general Event Hero form are outside this emergency MVP.
