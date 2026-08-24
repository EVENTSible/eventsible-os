# EVENTSible Project Custom Instructions — 2026-08-24

Use these instructions for the EVENTSiBuilds ChatGPT Project.

## Authority and evidence

Use `EVENTSible/eventsible-os`, `docs/README.md` as the canonical cross-ecosystem hub. Use `docs/ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md` as the current scope/coverage reconciliation and `EVENTSible/ecc-vince`, `docs/ECC_VINCE_CURRENT_STATE_RECONCILIATION_2026-08-24.md` for ECC detail. Historical baseline `ab4389723a3c55b4dca0c82f84fe94764930595d` is provenance, not current OS HEAD.

Conflict order: current source/Production evidence; repository/deployment history; OS canonical docs; current app docs; recent accessible checkpoints/report-backs; historical summaries/plans. Record conflicts; never silently combine incompatible claims.

Use: `PRODUCTION VERIFIED`, `LIVE`, `IMPLEMENTED`, `PARTIAL`, `PLANNED`, `DEFERRED`, `HISTORICAL`, `SUPERSEDED`, `NEEDS VERIFICATION`, `SOURCE NOT ACCESSIBLE`.

Never claim complete Project-chat coverage unless every named chat was read. Distinguish full review, direct checkpoint, summary-only, repository/deployment evidence and inaccessible sources.

## Lanes

- `eventsible.info`: public website/services/reviews/portfolio/planning and Builder entry.
- `build.eventsible.info`: public Event Builder.
- `eventsible.biz`: private OS/HQ, Mission Control and business operations.
- `client.eventsible.biz`: planned booked-client portal.
- `eventsible.app`: ECC/VINCE live interactive platform.
- `eventsible.shop`: planned Custom Creations.
- `www.eventsible574.com`: legacy trust/SEO bridge only.
- `eventsible.com`: inactive until ownership/purpose are verified.

Do not create applications on `eventsible574.com`.

## Repositories

Before work verify folder, `package.json`, `AGENTS.md`, remote, Production branch, local/remote HEAD, baseline ancestry, Vercel linkage and worktree state. Preserve dirty/unrelated work. Never build replacement apps in wrapper folders.

- OS: `C:\Users\itsTr\Documents\Codex\2026-07-29\eventsible-os`; `eventsible-os-admin`; `EVENTSible/eventsible-os`; Production `main`.
- Public/Builder: `C:\Users\itsTr\Documents\Codex\2026-07-26\eventsible-event-builder`; `eventsible-event-builder`; `EVENTSible/eventsible`; Production `main`.
- ECC: `C:\Users\itsTr\Documents\Codex\2026-05-11\eventsible-interactive-event-platform-project-summary`; `eventsible-interactive-event-platform`; `EVENTSible/ecc-vince`; Production `master`.

## Ownership

OS owns contacts, leads, Builder submissions, events, quotes, bookings, tasks, staff, equipment, contracts, invoices, payments, memberships, business-media metadata and Content Factory jobs.

Builder owns public planning, estimates/recommendations and package configuration, then submits to OS; it is not a CRM. ECC owns rooms, Host controls, Players, Audience displays, requests, queues, teams, scores, games and live flow. Client Portal operates on membership-scoped OS records. Content Factory is an OS module using OS `event_id`. Custom Creations owns product/inventory/customizer/order/production and references OS `contact_id`/`event_id`. Drive stores files; OS owns business-media metadata.

Do not create parallel business systems or use historical OS-like tables in ECC Supabase as a second system of record.

## Durable status corrections

- Wedding Hero is **PRODUCTION VERIFIED**, not planned; PR #18 merged at `e79deb6b03d296b367fc8b92f7f413a0c5b2dea0`.
- Public/Builder foundations are **PRODUCTION VERIFIED** at `26a49f80bd47b68920d9c78cd4345545bafc2d9e`.
- `eventsible.biz` domain/Auth is **PRODUCTION VERIFIED**.
- Mission Control Lead-to-Gig is **LIVE/PARTIAL**; authenticated conversion/idempotency needs verification.
- ECC public routes are **PRODUCTION VERIFIED** at `eventsible.app`; “Phase 25 next” is **SUPERSEDED**.
- Drive organization is **PARTIAL**; Content Factory/media integration is planned.
- Custom Creations repository is **NEEDS VERIFICATION**.

Revalidate time-sensitive status before future claims.

## Locked ECC rules

- Player top-level tabs remain exactly Main, Tools and Info.
- Host stays PIN-protected; Player, Audience and Join stay public.
- Quick Start remains non-destructive.
- Emergency Clear returns Audience to a safe lobby/QR state without deleting event data.
- Host PIN/session secrets and service-role values remain server-only; never expose values or use `VITE_` for server credentials.
- Never alter an active room or enter a Host PIN without action-time authorization from Travis.
- Do not rebuild Game Show Core from the old Phase 25 plan; verify the smallest current operational gap.

## Roadmap

1. Close Mission Control Lead Review → Approved Quote → Convert to Gig in Preview.
2. Close the smallest paid-event operations gap across calendar/staff/equipment/tasks/contracts/invoices.
3. Define OS→ECC activation and Drive→OS media contracts before integration code.
4. Build a minimal membership-scoped Client Portal.
5. Build Content Factory/Site Studio after media/content contracts.
6. Define Custom Creations before creating its app.
7. Continue ECC/Booth through small operational slices.
8. Defer VINCE AI, remote participation and deeper automation until prerequisites exist.

Safe parallel work: read-only Drive taxonomy and ECC public-route/encoding/accessibility reliability. Preserve the original word-grid game, Lyric Lock, physical-game toolkit and shared Song Generator as visible planned concepts, not implementations.

## Work rules

- Separate live, implemented, Preview-only, planned, deferred, superseded and unverified work.
- Keep guest/client experiences simple and staff/Host controls organized.
- Prefer shared contracts/reusable systems.
- Use focused branches and Preview; never imply Preview/discussion is Production.
- Never expose private customer/QA data, passwords, tokens, keys, PINs or secrets.
- Never delete/replace Project resources or chats without explicit approval.

Every implementation prompt must include repository/baseline/worktree verification; canonical/current-scope review; scope/exclusions/ownership; steps and measurable acceptance criteria; tests, lint, type check, build and `npm audit`; environment presence without values; no-secret checks; Preview/browser/console/runtime QA; rollback/Production readiness; focused commit; structured report-back; and explicit approval gates for merge, Production, schema/data, Host PIN, DNS/domain or destructive resource changes.

Do not run `npm audit fix`, broad upgrades, Production migrations or Production data repair unless separately approved.
