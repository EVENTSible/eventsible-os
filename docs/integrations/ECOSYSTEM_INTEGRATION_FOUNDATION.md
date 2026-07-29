# EVENTSible Ecosystem Integration Foundation

- Status: IMPLEMENTED / PREVIEW CANDIDATE
- Owner: EVENTSible OS
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: EVENTSible OS, Event Builder, Client Portal, ECC/VINCE, Booth Console, Content Factory, Custom Creations

## Repository Baseline

| Repository | Folder | Package | Remote | Branch at work start | Start HEAD | Working tree |
| --- | --- | --- | --- | --- | --- | --- |
| EVENTSible OS | `C:\Users\itsTr\Documents\Codex\2026-07-29\eventsible-os` | `eventsible-os-admin` | `https://github.com/EVENTSible/eventsible-os.git` | `main` | `ab4389723a3c55b4dca0c82f84fe94764930595d` | Clean |
| Event Builder | `C:\Users\itsTr\Documents\Codex\2026-07-26\eventsible-event-builder` | `eventsible-event-builder` | `https://github.com/EVENTSible/eventsible.git` | `main` | `fabfec42bc0115dc01f13ff1c2245ae74de4bdc2` | Clean |
| ECC/VINCE | `C:\Users\itsTr\Documents\Codex\2026-05-11\eventsible-interactive-event-platform-project-summary` | `eventsible-interactive-event-platform` | `https://github.com/EVENTSible/ecc-vince.git` | `master` | `7c7c825aef6b3e51420c451dd8aae7db5285373c` | Clean |

The older repository index listed previous run commits for these repositories. This pass verified the user-provided baseline commits above and treats those as the controlling baseline.

## Universal ID Map

| Identifier | Owner | Current status | Compatibility rule |
| --- | --- | --- | --- |
| `contact_id` | EVENTSible OS | IMPLEMENTED | Reuse OS contact UUIDs; dedupe by email, then phone. |
| `lead_id` | EVENTSible OS | IMPLEMENTED | Preserve leads created by `public.os_ingest_builder_submission`. |
| `builder_submission_id` | EVENTSible OS | IMPLEMENTED | Preserve submission idempotency and payload audit trail. |
| `event_id` | EVENTSible OS | IMPLEMENTED | Universal business event ID across Builder, GigTracker, quote, booking, portal, content, activation, and event-linked shop orders. |
| `quote_id` | EVENTSible OS | IMPLEMENTED | Reuse current draft quote chain. |
| `quote_version_id` | EVENTSible OS | PLANNED | Add later without changing `quote_id`. |
| `quote_item_id` | EVENTSible OS | IMPLEMENTED | Known services map to stable service codes; unknown labels stay custom. |
| `booking_id` | EVENTSible OS | PARTIAL | Created during convert-to-gig; no Builder booking system. |
| `task_id` | EVENTSible OS | PARTIAL | Reuse OS task/workspace records after workflow verification. |
| `staff_id` | EVENTSible OS / Supabase Auth app metadata | PARTIAL | Keep private role checks behind staff/admin auth. |
| `equipment_id` | EVENTSible OS | PLANNED | Public catalog may reference requirements, not private inventory data. |
| `client_membership_id` | EVENTSible OS | PARTIAL | Membership-scoped to `event_id` and client identity. |
| `room_id` | ECC/VINCE | IMPLEMENTED | Live room ID links to OS but does not replace `event_id`. |
| `media_asset_id` | OS / Content Factory / ECC by lane | PARTIAL | Keep public media, client files, live effects, and shop assets separate. |
| `content_job_id` | OS / Content Factory | PLANNED | Use OS `event_id`; review-before-publish required. |
| `order_id` | Custom Creations / shop lane | PLANNED | Reference OS contact/event IDs when event-related. |

## Versioned Contracts

Canonical contract definitions live in `src/contracts/ecosystem-contracts.mjs`.

Created contracts:

- `builder_submission_v1`
- `public_service_catalog_v1`
- `quote_draft_v1`
- `booking_v1`
- `event_activation_v1`
- `client_portal_summary_v1`
- `media_asset_v1`
- `content_factory_job_v1`

Policy:

- New fields are additive and optional unless a new contract version is introduced.
- Contract payloads use ISO dates, ISO datetimes, IANA timezones, and integer cents for currency.
- Public contracts exclude private cost, margin, supplier, internal-note, service-role, Host PIN, and private customer fields.
- Event Builder may mirror safe TypeScript/Zod contracts; it must not import OS runtime files.

## Builder Intake Compatibility

The live path remains:

Visitor -> Event Builder -> server-only submit path -> `public.os_ingest_builder_submission` -> OS contact -> builder submission -> lead -> event -> quote draft -> quote items.

Preserved behavior:

- Server-only privileged Supabase access.
- Existing `submissionId` idempotency.
- Contact, Builder submission, lead, event, quote, and quote-item chain.
- Custom Quote preservation.
- Safe failure surface without SQL or internal table names in public errors.

Builder now records `contract_version: builder_submission_v1` and `contract_payload` inside the normalized payload for audit/compatibility.

## Public Service Catalog Foundation

The future OS-owned service catalog contract is `public_service_catalog_v1`. It includes stable service ID, public name, internal name, category, public description, pricing type, public starting price in cents, weekday rules, minimum hours, package eligibility, Custom Quote status, public media, required staff, required equipment, active status, effective date, and catalog version.

Private cost, margin, partner pricing, supplier notes, and internal notes are excluded from the public contract. The current Builder catalog remains the production fallback during this phase. No production cutover is part of this foundation pass.

Known service mapping is corrected additively in the Builder mirror for documented OS service codes. Unknown services remain preserved by label/code for OS review.

## Integration Event / Outbox Decision

Existing docs and public OS assets already reference `os_automation_outbox`. The selected strategy is:

1. Reuse the existing automation/outbox pattern where the deployed OS database already has it.
2. Add `os_integration_outbox` only as an additive foundation for cross-app event delivery when a dedicated integration queue is needed.
3. Use idempotency keys to prevent duplicate event records.
4. Keep access server-only by default.

SQL foundation: `integrations/sql/ecosystem-integration-foundation.sql`.

Versioned integration event names:

- `builder.submission_received`
- `lead.status_changed`
- `quote.ready`
- `quote.sent`
- `quote.accepted`
- `booking.confirmed`
- `event.updated`
- `event.room_requested`
- `event.completed`
- `client.portal_ready`
- `media.asset_added`
- `content.review_ready`

Each event records payload version, event ID, source, timestamp, related OS record IDs, idempotency key, status, retry count, next attempt time, and failure history.

## Auth And Domain Boundaries

Preserved boundaries:

- `eventsible.info`: public website.
- `build.eventsible.info`: public Event Builder with protected staff routes.
- `eventsible.biz`: private staff/admin OS.
- `client.eventsible.biz`: membership-scoped client portal.
- `eventsible.app`: public ECC/VINCE Join/Player/Audience and PIN-protected Host.

No unsafe cross-domain cookie sharing is planned. Each app establishes its own Supabase session for its own domain. Browser apps may use publishable Supabase variables. Service-role keys, Host PIN values, Host session secrets, database passwords, access tokens, and customer-private data remain server-only and must not use public prefixes such as `VITE_`.

## Environment Hygiene

Tracked environment files were inspected without printing values.

Finding:

- Event Builder tracks `.env`.
- It contains Supabase project/publishable URL-style variables, including `VITE_` browser-safe variables and non-`VITE_` project/publishable names used by server functions.
- No tracked variable names indicated service-role keys, secrets, tokens, passwords, Host PINs, database passwords, or private keys.

No sensitive tracked env value was printed.

## QA Requirements

Required local validation:

- OS: `npm install`, `npm run test`, `npm run lint`, `npm run build`, `npm audit`.
- Event Builder: `npm install`, `npm run test`, `npm run lint`, `npm run build`, `npm audit`.
- ECC/VINCE: no code changes expected; run validation only if a documentation/reference branch becomes necessary.

Required Preview QA before any production readiness claim:

- Builder routes load.
- Builder creates exactly one OS chain.
- Contract version is recorded.
- Known services map correctly.
- Unknown custom services are preserved.
- Admin access remains protected.
- Public catalog contains no private fields.
- No secret appears in public assets.
- No ECC/VINCE behavior changes.

No production promotion is allowed in this phase.

## Preview QA Results

Preview deployments were created on 2026-07-29. Exact ephemeral Preview URLs and deployment IDs are reported in the completion report for the run.

| App | Result |
| --- | --- |
| EVENTSible OS | READY; `/`, `/login`, and `/api/health` returned 200 after correcting the existing Vercel project framework setting from Other/static output to Next.js auto detection. |
| Event Builder | READY; `/` and `/build` returned 200; unauthenticated `/admin` returned a 302 protection redirect. |

Local validation:

- OS `npm install`: passed; inherited 12 high audit advisories reported.
- OS `npm run test`: passed, 4 contract tests.
- OS `npm run lint`: blocked by inherited `public/gigtracker-v1.js` parse error plus inherited warnings.
- OS `npm run build`: passed.
- OS `npm audit`: 12 inherited high advisories; no forced major upgrades applied.
- Event Builder `npm install`: passed; inherited 9 audit advisories reported.
- Event Builder `npm run test`: passed, 27 tests.
- Event Builder `npm run lint`: passed with 10 inherited Fast Refresh warnings.
- Event Builder `npm run build`: passed with inherited large chunk warning.
- Event Builder `npm audit`: 9 inherited advisories; no forced major upgrades applied.

Security checks:

- Tracked Event Builder `.env` was inspected without printing values; no service-role, token, password, Host PIN, database password, or private-key variable names were found.
- Event Builder public output scan found no service-role variable names, Host PIN names, or privileged OS table names.
- OS public/static assets include existing private OS/GigTracker table references because OS is a private staff/admin app, not a public website bundle.
- No production promotion occurred.

Manual QA not completed in this pass:

- No controlled live Builder submission was sent, so the exact deployed database one-chain result still requires authorized Preview QA.
- No authenticated staff session was used, so production Admin Leads visual QA remains pending.
- No ECC/VINCE behavior was changed or redeployed.

### Preview Verification Attempt - 2026-07-29

Requested scenario: synthetic `EVENTSible Contract QA Test`, Private Party, ready for quote, future Tuesday `2026-08-04`, `18:00` to `21:00`, South Bend, Indiana, with goals `Packed Dance Floor`, `Photos & Video`, and `Guest Interaction`. Requested service mapping set: `DJ / MC`, `Selfie Booth with Prints`, `Event Assistant`, `Live Singer / Vocalist`, plus one safe unknown Custom Quote line for preservation testing.

Current Preview references:

| App | Preview URL | Deployment |
| --- | --- | --- |
| EVENTSible OS | `https://eventsible-91me1mfqh-firstfamdjs-5913s-projects.vercel.app` | `dpl_3wLpiAz3ovePfKPJs153GBCcCP56` |
| Event Builder | `https://eventsible-event-builder-3e8hs2dyp-firstfamdjs-5913s-projects.vercel.app` | `dpl_2BV8WDZfdTSpGnvcs2sCXXB5oLjL` |

Baseline verification:

- EVENTSible OS branch `feat/ecosystem-integration-foundation` remained at `9c7c69b068bcf56c46c44dc9900a1a08a1a12304` with a clean working tree before documentation updates.
- Event Builder branch `feat/ecosystem-integration-foundation` remained at `2214d7171f9d158b63d6773648e55d98ac500231` with a clean working tree before documentation updates.
- ECC/VINCE branch `master` remained read-only at `7c7c825aef6b3e51420c451dd8aae7db5285373c`.
- Both Vercel Preview deployments were READY.
- Event Builder Preview Vercel env names existed for `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`; values were not printed.
- EVENTSible OS Vercel Preview reported no environment variables. The deployed OS app currently uses publishable Supabase configuration from source rather than Vercel runtime env.

Blocking finding:

- The local Vercel env pull for Event Builder Preview produced encrypted placeholder values instead of usable local values, so service-role database reads could not be performed from this QA session without another authorized Supabase access path.
- Because Preview and Production environment scopes currently point at the same Builder Vercel variable names, no synthetic successful submission was sent in this attempt. Creating a chain without database readback would not satisfy the exact one-chain, idempotency, totals, mapping, and outbox acceptance criteria.

Verified without creating records:

- The deployed Builder Preview server function rejected invalid contact data, missing service selections, oversized notes, and the honeypot field with safe public failures.
- The rejection messages did not expose Supabase secrets, service-role wording, OS table names, SQL text, passwords, tokens, or stack traces.
- `builder_submission_v1` remains the Builder submission contract version.
- The public catalog mirror exposes `public_service_catalog_v1` fields through the Builder compatibility layer and excludes private cost, margin, partner-rate, supplier, and internal-note fields by design.
- The requested known Builder service IDs are `dj-mc-foundation`, `selfie-booth-prints`, `event-asst`, and `live-singer`. The shared mapping layer maps DJ/MC, Selfie Booth with Prints, Event Assistant, and Live Singer to stable service codes; Live Singer remains Custom Quote under current pricing rules.
- South Bend, Indiana travel remains local/included in Builder logic.

Not verified in this attempt:

- Exact Contact, Builder submission, Lead, Event, Quote draft/version, Quote item, Builder facts/metadata, and integration outbox row counts.
- Idempotent retry with the same submission key.
- Second distinct successful submission.
- UI total versus OS quote total.
- Authenticated staff/admin display of the synthetic lead.
- RLS verification against live `os_integration_outbox`.

Outbox status:

- Source control includes additive SQL for `public.os_integration_outbox` at `integrations/sql/ecosystem-integration-foundation.sql`.
- Live Preview database application was not confirmed because database metadata access was unavailable in this QA session.
- If the table is absent in the authorized Preview/test Supabase environment, apply only the additive migration in `integrations/sql/ecosystem-integration-foundation.sql` after confirming the target is not Production.

Production readiness recommendation:

- Not production ready for ecosystem integration cutover. The next required phase is an authorized Preview Supabase verification pass that can read exact OS rows, then one controlled synthetic submission, idempotent replay, second distinct submission, outbox/RLS verification, authenticated Admin visual QA, and final security scan before any production-readiness claim.

## Known Limitations

- The outbox SQL is additive source control foundation; live database application and advisor output must be verified through the normal Supabase migration process before production use.
- `quote_version_id`, `equipment_id`, `content_job_id`, and event-related `order_id` remain planned/partial because the corresponding workflows are not implemented in this phase.
- Production Builder intake must still be manually QA-tested with an authorized controlled submission before marking production ready.

## Recommended Next Phase

Run a Preview-only end-to-end Builder submission against the OS database, verify the exact one-chain result and service mapping, then prepare the convert-to-gig quote/booking workflow using the same `event_id` and contract policy.
