# EVENTSible Ecosystem Current State

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: all current and planned app lanes
- Supersedes: older status docs when they conflict with verified 2026-07-29 evidence
- Related documents: `EVENTSIBLE_PROJECT_AND_REPOSITORY_INDEX.md`, `../apps/EVENTSIBLE_APP_LANE_SUMMARIES.md`

## Current State Summary

| Lane | Current status | Evidence | Manual confirmation needed |
| --- | --- | --- | --- |
| Event Builder | PRODUCTION VERIFIED | `build.eventsible.info` returns 200; Vercel production `dpl_7C2n8eBUoWuDDM6N7kjwcd8cog84` READY on commit `ab128cefb9bf97042dba0f3222ecbca858b0f863`; repo docs and source show Builder-to-OS intake | Staff Admin Leads visual QA on production still requires a fresh authenticated staff session. |
| EVENTSible OS / GigTracker | IMPLEMENTED / PARTIAL / NEEDS DOMAIN VERIFICATION | Repo `eventsible-os-admin` cloned from `EVENTSible/eventsible-os`; Vercel project `eventsible-os` latest deployment READY on commit `b31347708ecf09cdf6150400acfec49b4ac1d4c0`; source includes admin, client portal assets, event workspace, intake helper, docs | `eventsible.biz` and `client.eventsible.biz` routing/auth must be verified. `eventsible-os.vercel.app` returned 404 in a safe route check. |
| ECC / VINCE | IMPLEMENTED; production verified through current deployment metadata and health route | Repo `EVENTSible/ecc-vince`, production deployment `dpl_2JCcVhiLBDF53hEh9MbrstiuzSGi` READY on commit `7d0186875b8cb204f0047b28042f1cc170060a5c`; `/api/health` returned OK; public room routes serve the app shell | Deep hydrated browser QA for Player/Audience/Host was not repeated in this documentation-only pass. Do not enter Host PIN without explicit action-time authorization. |
| Booth Console / KJ Genie | IMPLEMENTED LOCAL FOUNDATION / PARTIAL | ECC repo has `apps/booth-console`, local media index/search, SQLite schema, playback adapters, docs | Native Tauri/Rust build remains blocked unless Rust/Cargo installed and tested. |
| Content Factory | PLANNED | Documented as future OS module using OS event IDs | Needs product definition before implementation. |
| Custom Creations | PLANNED / PROTOTYPE REFERENCES ONLY | Domain lane documented; no verified production shop app in this pass | Locate or restore any existing prototype before treating as current. |
| Client Portal / Hero | PARTIAL / PLANNED | OS repo includes client portal static assets and auth bridge; domain target is `client.eventsible.biz` per current decision | Verify production auth, redirects, and domain routing before live use. |
| AI Event/Wedding Planner | CONCEPT / PLANNED | Indexed as future relationship to Builder, Client Portal, and OS | Do not describe as live. |
| Legacy website | LEGACY / BRIDGE | `www.eventsible574.com` remains documented as bridge only | Current content/SEO state not verified in this pass. |

## 2026-07-29 Documentation Merge Baseline

| Item | Baseline |
| --- | --- |
| Documentation merge date | 2026-07-29 |
| Canonical documentation hub | `docs/README.md` in `EVENTSible/eventsible-os` |
| EVENTSible OS merged commit | `40b6834d19883c4f6033aad6609896f527720b63` |
| Event Builder merged commit | `fabfec42bc0115dc01f13ff1c2245ae74de4bdc2` |
| ECC/VINCE merged commit | `7c7c825aef6b3e51420c451dd8aae7db5285373c` |
| Recommended next phase | Ecosystem integration foundation and shared contracts |

### Inherited Warnings and Advisories

| Repository | Status |
| --- | --- |
| EVENTSible OS | `npm run lint` still fails on an inherited parse error in `public/gigtracker-v1.js`; inherited lint warnings remain in `public/event-workspace-files.js` and `public/gigtracker-v1-ops-ui.js`. `npm audit` reports 12 inherited high advisories. |
| Event Builder | Tests pass, lint passes with inherited Fast Refresh warnings, build passes with the inherited large chunk warning, and `npm audit` reports 9 inherited advisories. |
| ECC/VINCE | Search tests, main build, Booth Console tests, and Booth Console build pass. `npm audit` reports 0 vulnerabilities. The main build still reports the inherited large chunk warning. |

### Routing Verification Issue

EVENTSible OS root-route verification remains open: the current Vercel root route has previously returned 404 and should be tracked as a routing issue separate from this documentation merge. Do not treat `eventsible.biz` as production verified until routing, auth, and root behavior are confirmed.

## Event Builder Production Capability

The current Event Builder includes public homepage content focused around the Builder, guided Event Basics, name and email-or-phone validation, best time to contact, planning stage, multiple date and time-frame capture, service-length calculation, city/state travel estimation, event type, What Matters Most, Popular Picks, three package recommendations, Basic/Premium/All-Inclusive packages, package customization, service-specific durations, weekday pricing, bundle pricing, custom quote handling, media/examples, Quote Summary, public OS intake, staff sign-in, Admin Leads, password recovery, bundled logo/audio assets, theme song one-play behavior, and raw Admin payload block removal.

The confirmed Builder-to-OS chain is Contact -> Builder submission -> Lead -> Event -> Quote draft -> Quote items through `public.os_ingest_builder_submission`.

## ECC / VINCE Locked Rules

Player View remains exactly Main, Tools, Info. Host routes remain PIN-protected. Player, Audience, and Join remain public. Quick Start presets remain non-destructive. Emergency Clear remains accessible only after Host unlock and must not delete event data. Service-role keys, Host PIN secrets, and Host session secrets must never be exposed or placed in `VITE_` variables.

