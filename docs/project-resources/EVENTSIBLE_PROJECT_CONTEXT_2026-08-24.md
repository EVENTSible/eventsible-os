# EVENTSible Project Context — 2026-08-24

## Status and purpose

- Status: **CURRENT EXPORT-READY PROJECT RESOURCE**
- Scope status: **PARTIAL**, because not every historical ChatGPT Project conversation was directly accessible
- Canonical repository: `EVENTSible/eventsible-os`
- Canonical documentation hub: `docs/README.md`
- Current evidence report: `docs/ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md`
- ECC detail report: `EVENTSible/ecc-vince`, `docs/ECC_VINCE_CURRENT_STATE_RECONCILIATION_2026-08-24.md`
- Replaces active use of: `EVENTSIBLE_PROJECT_CONTEXT(1).md`

Use this file as a concise orientation layer. It does not override current source, Production evidence, or canonical repository documentation.

## Evidence precedence

When claims conflict, use this order:

1. Current source code and direct Production evidence
2. Current repository history and deployment evidence
3. EVENTSible OS canonical documentation
4. Current app-specific documentation
5. Recent accessible conversation checkpoints and verified report-backs
6. Historical chat summaries and phase plans

Record material conflicts. Never merge incompatible claims silently.

Use these labels exactly: `PRODUCTION VERIFIED`, `LIVE`, `IMPLEMENTED`, `PARTIAL`, `PLANNED`, `DEFERRED`, `HISTORICAL`, `SUPERSEDED`, `NEEDS VERIFICATION`, and `SOURCE NOT ACCESSIBLE`.

## Ecosystem lanes

| Lane | Domain | Repository / owner | Current evidence-backed status |
|---|---|---|---|
| Public website | `eventsible.info` | `EVENTSible/eventsible` | Foundation **PRODUCTION VERIFIED** |
| Event Builder | `build.eventsible.info` | `EVENTSible/eventsible` | Public Builder **PRODUCTION VERIFIED**; OS submission flow **LIVE** |
| EVENTSible OS / Business HQ | `eventsible.biz` | `EVENTSible/eventsible-os` | Secure/auth foundation **PRODUCTION VERIFIED** |
| Mission Control | `eventsible.biz` | OS | Lead-to-Gig source **LIVE / PARTIAL**; authenticated workflow **NEEDS VERIFICATION** |
| Wedding Hero | `eventsible.biz/weddinghero` | OS | **PRODUCTION VERIFIED** |
| Client Portal | `client.eventsible.biz` | OS membership-scoped future lane | **PLANNED** |
| ECC / VINCE | `eventsible.app` | `EVENTSible/ecc-vince` | Public shell **PRODUCTION VERIFIED**; feature workflows vary |
| Booth Console / KJ Genie | Local desktop | ECC repository, `booth-console` | Phase B0 **IMPLEMENTED locally**; native/live adapters unverified |
| Content Factory | OS module | OS | **PLANNED** |
| Drive asset system | Connected Drive + future OS metadata | Drive files, OS business-media metadata | Organization/catalog **PARTIAL** |
| Custom Creations | `eventsible.shop` | Repository **NEEDS VERIFICATION** | **PLANNED** |
| Legacy public bridge | `www.eventsible574.com` | Legacy site | Trust/SEO bridge only |
| Unverified domain | `eventsible.com` | Unknown | Do not treat as active |

## Verified repository identities

### EVENTSible OS

- Folder: `C:\Users\itsTr\Documents\Codex\2026-07-29\eventsible-os`
- Package: `eventsible-os-admin`
- Repository: `EVENTSible/eventsible-os`
- Production branch: `main`
- Production commit verified during the refresh: `e79deb6b03d296b367fc8b92f7f413a0c5b2dea0`

### Public website and Event Builder

- Folder: `C:\Users\itsTr\Documents\Codex\2026-07-26\eventsible-event-builder`
- Package: `eventsible-event-builder`
- Repository: `EVENTSible/eventsible`
- Production branch: `main`
- Production commit verified during the refresh: `26a49f80bd47b68920d9c78cd4345545bafc2d9e`

### ECC / VINCE

- Folder: `C:\Users\itsTr\Documents\Codex\2026-05-11\eventsible-interactive-event-platform-project-summary`
- Package: `eventsible-interactive-event-platform`
- Repository: `EVENTSible/ecc-vince`
- Production branch: `master`
- Production commit verified during the refresh: `1d31fb1168df08bb0a775ba54b699953f0f84cad`

Always revalidate branches, HEADs, remotes, deployments, and worktree state before acting. Never create replacement apps in ChatGPT/Codex wrapper folders.

## Current Production evidence

| Lane | Deployment | Domain |
|---|---|---|
| Wedding Hero / OS | `dpl_6p9EDgGL5bozMtqmACeNoyt3CGTV` | `eventsible.biz` |
| Public website | `dpl_6hrXt2ouaYp3iaDy6m5oVdS9FUQb` | `eventsible.info` |
| Event Builder | `dpl_GdQPEB2geX2h7ur2Muvpdfy87Q7Q` | `build.eventsible.info` |
| ECC / VINCE | `dpl_EdWFPwdYRPDBHgew3dRypCQX6Y6L` | `eventsible.app` |

Production evidence is time-sensitive. Recheck it before future implementation or promotion claims.

## System-of-record rules

### EVENTSible OS owns

Contacts, leads, Builder submissions, events, quotes, bookings, tasks, staff, equipment, contracts, invoices, payments, client memberships, business-media metadata, and Content Factory jobs.

### Event Builder owns

Public planning intake, estimates, recommendations, package configuration, and submission into OS. It is not a CRM.

### ECC / VINCE owns

Live rooms, Host controls, Player participation, Audience displays, requests, queues, teams, scores, games, and live-event flow.

### Other lanes

- Client Portal reads and updates membership-scoped OS records.
- Content Factory is an OS module using the same OS `event_id`.
- Custom Creations owns products, inventory, customization, orders, and production; event-linked orders reference OS `contact_id` and `event_id`.
- Google Drive stores files; OS owns future searchable business-media metadata.

Do not create duplicate business systems. Historical OS-like tables in the ECC Supabase project are not an alternate system of record.

## Current milestone summary

### Wedding Hero — PRODUCTION VERIFIED

- PR `#18`
- Fix commit `937691dc80366ea9b38eaf22536b93feb7708e28`
- Merge `e79deb6b03d296b367fc8b92f7f413a0c5b2dea0`
- Production deployment `dpl_6p9EDgGL5bozMtqmACeNoyt3CGTV`
- Guided Companion, Traditional Full Form, Printable Planner, persistence, callback/notification delivery, and Day-of Sheet data are current capabilities.

### Website and Builder — PRODUCTION VERIFIED foundation

Power Mode, Classic View, Discover, Fast Track, Full Inquiry entry, service discovery, theme-song experience, and the separated Builder are live. Real approved media, verified reviews, conversion QA, owner editability, TypeScript cleanup, dependency advisories, and bundle weight remain open.

### Mission Control — LIVE / PARTIAL

Lead status, quote approval, and Convert to Gig reuse canonical OS tables. Commit `892c5e13cd1e88b689519725e896133542f205e0` is in current Production source. Historical Preview `dpl_DNgcM5CX7HFHBCckybHr76AgKgqw` was READY. Authenticated end-to-end conversion and idempotency remain unverified.

### ECC / VINCE — advanced beyond the historical plan

The old statement that Phase 25 is next is **SUPERSEDED**. Current source/schema include later game, content, Vibe Check, Squad Goals, challenge, card, dice, media, and PlayZone work. Public routes are verified; Host-only workflows still require action-time authorization and an isolated QA room.

### Drive assets — PARTIAL

The recorded organization checkpoint contains 233 cataloged assets, 228 preserved originals, five JPEG conversions, broad classification, and an editorial-review queue. OS metadata and Content Factory contracts remain planned.

## Locked ECC / VINCE rules

- Player View remains exactly Main, Tools, and Info.
- Host routes remain PIN-protected; Player, Audience, and Join remain public.
- Host credentials and Supabase service-role values remain server-only and never use `VITE_`.
- Quick Start is non-destructive.
- Emergency Clear returns Audience to a safe lobby/QR state without deleting event data.
- Never alter an active paid-event room.
- Never enter a Host PIN without explicit action-time authorization from Travis.

## Preserved product concepts

- Original EVENTSible Boggle Party-style word-grid game
- Physical/hybrid games using dice, cards, balls, cones, cups, plates, obstacles, and other props
- Lyric Lock using DJ-owned local media and metadata/game state in VINCE
- Provider-neutral Song Generator/Soundtrack Finder shared by Hero, Builder, ECC, music games, and DJ requests
- OS-owned structured public-site editing for text, media, approved sections, layouts, templates, and promotions
- Drive-to-OS media metadata and Content Factory review-before-publish flow

These are requirements or concepts, not current implementations unless separately evidenced.

## Evidence-based roadmap

1. Close Mission Control Lead Review → Approved Quote → Convert to Gig in one controlled Preview phase.
2. Verify the smallest downstream paid-event operations gap across calendar, staff, equipment, tasks, contracts, and invoices.
3. Define OS→ECC activation and Drive→OS media contracts before coding integrations.
4. Build a minimal membership-scoped Client Portal after core operations stabilize.
5. Sequence Content Factory and Site Studio around the accepted media/content contracts.
6. Keep Custom Creations, advanced ECC/VINCE concepts, Booth connectivity, remote participation, and VINCE AI parked until prerequisites are complete.

Safe parallel work: read-only Drive editorial taxonomy and ECC public-route/encoding/accessibility reliability work.

## Production safety

- Inspect current evidence before changes.
- Preserve dirty worktrees and unrelated user edits.
- Use focused branches and Preview verification.
- Do not merge or promote without explicit authorization.
- Never expose secrets or private customer/QA information.
- Do not run broad upgrades or `npm audit fix` without a separate approved task.

## Known gaps

- Some Project conversations remain inaccessible or only partially reviewed.
- Mission Control authenticated conversion is not closed.
- Host-side ECC cards/dice/media, judging, Quick Start, and Emergency Clear need authorized QA.
- Custom Creations repository, Client Portal deployment, `eventsible.com`, native Booth runtime, and music/lyric licensing remain unverified.
- Public/Builder TypeScript and audit debt, bundle weight, Booth audit debt, and ECC mojibake remain maintenance items.
