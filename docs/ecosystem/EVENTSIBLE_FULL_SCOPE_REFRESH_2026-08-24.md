# EVENTSiBuilds Full Scope Refresh — 2026-08-24

## Executive status

**Overall status: PARTIAL.** The three active application repositories, their current branches, source, database migration ledgers, Vercel projects, Production deployments, canonical domains, public browser routes, and available recent conversation checkpoints were reviewed. The result is strong enough to select the next controlled build slice. It is not a claim that every historical ChatGPT Project conversation was fully reviewed: the conversation API exposed only the newest project window, several conversations were available only through the July 29 index, and several newer conversations exposed only their latest checkpoint.

Status vocabulary in this document is strict:

- **PRODUCTION VERIFIED** — current Production behavior was directly checked and supporting deployment/source evidence exists.
- **LIVE** — deployed in the current Production application, but the entire workflow was not re-exercised in this review.
- **IMPLEMENTED** — present in current source or schema.
- **PARTIAL** — some required layers or verification are missing.
- **PLANNED**, **DEFERRED**, **HISTORICAL**, **SUPERSEDED**, **NEEDS VERIFICATION**, and **SOURCE NOT ACCESSIBLE** retain their literal meanings.

No application feature, schema, migration, Production data, Production deployment, alias, DNS record, environment variable, or Production logo was changed during this review. No Host PIN or secret value was entered or printed.

## Authority and repository evidence

The canonical authority remains this repository and `docs/README.md`. Current source and Production evidence override old summaries.

| Repository | Verified identity | Production branch / current Production commit | Review checkout | Working tree at start | Historical baseline |
|---|---|---|---|---|---|
| EVENTSible OS | `C:\Users\itsTr\Documents\Codex\2026-07-29\eventsible-os`; package `eventsible-os-admin`; `EVENTSible/eventsible-os` | `main` / `e79deb6b03d296b367fc8b92f7f413a0c5b2dea0` | `codex/wedding-hero-homepage` / `d7aed83` | Four pre-existing modified Wedding Hero notification/action files; preserved | `ab4389723a3c55b4dca0c82f84fe94764930595d` is an ancestor |
| Public site and Builder | `C:\Users\itsTr\Documents\Codex\2026-07-26\eventsible-event-builder`; package `eventsible-event-builder`; `EVENTSible/eventsible` | `main` / `26a49f80` | `fix/builder-public-navigation` / `26a49f80` | Clean | `fabfec...` verified as an ancestor |
| ECC / VINCE | `C:\Users\itsTr\Documents\Codex\2026-05-11\eventsible-interactive-event-platform-project-summary`; package `eventsible-interactive-event-platform`; `EVENTSible/ecc-vince` | `master` / `1d31fb1` | `master` / `1d31fb1` | Clean | `7c7c825...` verified as an ancestor |

Each repository's `AGENTS.md`, package manifest, remote, remote default branch, local/remote HEAD, and worktree state were inspected. Remote references were fetched without rewriting history. This report was authored on isolated documentation branches; the existing dirty OS checkout was not switched or modified.

## Conversation and source coverage ledger

“Direct checkpoint” means the current project conversation was opened and its newest accessible messages were read. It does not mean the entire historical thread was paged from the beginning.

| Chat or source | Lane | Newest accessible checkpoint | Coverage | Reliable decisions / additions | Open work and conflicts | Currency |
|---|---|---:|---|---|---|---|
| Wedding Hero Deployment Plan | OS / Hero | Aug. 2026 | Direct newest checkpoint; earlier thread not fully paged | Production merge, deployment, fix, end-to-end persistence and email evidence | Local post-merge edits remain uncommitted in the owner's checkout | Current |
| Wedding Companion Deployment Approval | OS / Hero | Aug. 2026 | Direct newest checkpoint | Preview implementation preceded Production release | Superseded by later Wedding Hero Production checkpoint | Mixed |
| Improve Wedding Hero planner | Hero | Aug. 2026 | Direct newest checkpoint | Guided, full-form and printable experience direction | Older “planner planned” index status is superseded | Mixed |
| EVENTSibuilds Projeect Manager 2 | Cross-ecosystem | Aug. 2026 | Direct newest checkpoint | Canonical roadmap, website/editability handoff and prior integration closure | Full thread not paged | Current/mixed |
| Vercel Preview Verification | Website / Builder | Aug. 2026 | Direct newest checkpoint | Current Power Paths, public/Builder Production evidence and conversion-QA plan | Real proof, review and device QA remain open | Current |
| Eventsible HQ Site Work | OS | Aug. 2026 | Direct newest checkpoint | Secure OS landing and HQ direction | Some older design discussion predates current Production | Mixed |
| EVENTSible Team Hub | OS | Aug. 2026 | Direct newest checkpoint | Internal team workspace concepts | Product boundary needs definition | Planned/mixed |
| Website Editability Planning | Website / OS | Aug. 2026 | Full one-turn conversation reviewed | OS-owned Site Studio/Website Manager; public renderer stays separate; no duplicate CRM/content truth | Product and publishing contract not yet designed | Current/planned |
| EVENT BUILDER loveable | Website / Builder | Aug. 2026 | Direct newest checkpoint | Public/Builder navigation and experience evidence | Full thread not paged | Current/mixed |
| Gemini Feedback Review | Website | Aug. 2026 | Direct newest checkpoint | Website feedback and proof/content gaps | Requires owner-selected real assets/reviews | Current |
| Connect Google Drive Assets | Assets | Aug. 2026 | Direct newest checkpoint | Phase 1/2 organization and catalog counts; originals preserved | Editorial review and OS metadata contract remain | Current |
| contact factory idea | Content Factory | Aug. 2026 | Direct newest checkpoint | Content Factory stays an OS module | Detailed job contract still planned | Current/planned |
| Game show concept development | ECC | Aug. 2026 | Direct newest checkpoint | Physical game tools, original word-grid game, game-bank direction | Several ideas need product definition before code | Current/planned |
| Compare Music Trivia Systems | Music / ECC | Aug. 2026 | Direct newest checkpoint | Reusable song-discovery engine; do not depend exclusively on Spotify | Metadata/licensing/provider contract missing | Current/planned |
| ECC Production Smoke Test | ECC | Aug. 2026 | Direct newest checkpoint | Production availability and pause-prevention evidence | Action-time Host workflow remains intentionally untested | Current |
| VINCE/ECC work | ECC | historical | Direct newest checkpoint | Early live-event concepts | Firebase architecture is **SUPERSEDED** by current Supabase source/schema | Superseded/mixed |
| Verify local Supabase integration | Infrastructure | Aug. 2026 | Direct newest checkpoint | Supabase project/schema evidence | Not a substitute for current Production workflow QA | Current |
| Verify local Supabase stack | Infrastructure | Aug. 2026 | Direct newest checkpoint | Local stack/test planning | Full checkpoint not paged | Mixed |
| ECC/VINCE Master Build Plan attachment | ECC | July 2026 | Full attached file reviewed | Historical phases and locked UX/safety rules | “Phase 25 next” is **SUPERSEDED** | Historical |
| Project Custom Instructions attachment | Cross-ecosystem | July 2026 | Full attached file reviewed | Ownership, domains, repo identities, safety rules | Status claims updated by August evidence | Current rules / historical statuses |
| Chat Bootstrap Templates attachment | Cross-ecosystem | July 2026 | Full attached file reviewed | Prompt/checkpoint conventions | Not current implementation evidence | Historical support |
| Project Context attachment | Cross-ecosystem | July 2026 | Full attached file reviewed | July ecosystem snapshot | Multiple lane statuses superseded | Historical |
| Chat Index attachment | Cross-ecosystem | July 2026 | Full attached summary reviewed | 18-chat map and July roadmap | It is a summary, not full conversation content | Historical/mixed |
| Custom Creations App | Custom Creations | July index | Summary only | Product/customizer/order direction | Direct chat and repository **SOURCE NOT ACCESSIBLE** | Historical/planned |
| Event Soundboard Ideas | ECC / Booth | July index | Summary only | Soundboard/live utility ideas | Direct chat **SOURCE NOT ACCESSIBLE** | Historical/planned |
| Site Structure Ideas | Website | July index | Summary only | Domain/site hierarchy ideas | Direct chat **SOURCE NOT ACCESSIBLE**; current domain evidence overrides it | Historical/superseded |
| EVENTSible Ecosystem Integration | Cross-ecosystem | July index/current docs | Summary and repository evidence only | Shared contracts and system-of-record boundary | Full conversation **SOURCE NOT ACCESSIBLE** | Mixed |
| Project Context Refresh and Chat Organization | Cross-ecosystem | July index/current docs | Summary and repository evidence only | Canonical docs structure | Full conversation **SOURCE NOT ACCESSIBLE** | Mixed |
| Documentation Cleanup | Cross-ecosystem | July index/repository history | Summary and repository evidence only | Canonical OS docs hub established | Full conversation **SOURCE NOT ACCESSIBLE** | Mixed |
| Mission Control implementation checkpoint | OS | Aug. repository/history | Repository and report-back evidence only | Lead-to-Gig commit is in current Production source; Preview `dpl_DNgcM5CX7HFHBCckybHr76AgKgqw` was READY | Full conversation **SOURCE NOT ACCESSIBLE**; authenticated mutations remain unverified | Current/mixed |
| Booth Console / KJ Genie conversations | Booth | Current repo plus July summary | Repository evidence and summary only | Local-first Phase B0 boundary | Full recent conversation **SOURCE NOT ACCESSIBLE** | Mixed |

The project thread listing was capped at the newest 50 tasks and the archived-task listing returned no additional tasks. Therefore, “all chats reviewed” would be inaccurate. Missing full histories could still change feature intent, acceptance criteria, or priority, but cannot override current source/Production evidence without reconciliation.

## Current Production and platform evidence

| Lane | Vercel project | Current relevant Production deployment | Canonical domain(s) | Health during review |
|---|---|---|---|---|
| EVENTSible OS / Wedding Hero | EVENTSible OS (`prj_1J9...`) | Wedding Hero deployment `dpl_6p9EDgGL5bozMtqmACeNoyt3CGTV`, commit `e79deb6...` | `eventsible.biz` | READY; unauthenticated `/` and `/admin` safely redirect to login; `/weddinghero` and all three planner modes rendered |
| Public website | public project (`prj_mtQV...`) | `dpl_6hrXt2ouaYp3iaDy6m5oVdS9FUQb`, commit `26a49f80bd47b68920d9c78cd4345545bafc2d9e` | `eventsible.info`, `www.eventsible.info` | READY; home, services, Discover and Fast Track rendered |
| Event Builder | Builder project (`prj_8iq...`) | `dpl_GdQPEB2geX2h7ur2Muvpdfy87Q7Q`, commit `26a49f80bd47b68920d9c78cd4345545bafc2d9e` | `build.eventsible.info` | READY; `/build` and choose-start flow rendered |
| ECC / VINCE | ECC project (`prj_R7...`) | `dpl_EdWFPwdYRPDBHgew3dRypCQX6Y6L`, commit `1d31fb1168df08bb0a775ba54b699953f0f84cad` | `eventsible.app` | READY; landing, Join, Player, Audience and PIN-gated Host routes rendered |

Porkbun remains the registrar/nameserver context and the active domains are served by Vercel Edge. `eventsible.com` ownership/purpose was not verified and must not be treated as active. `client.eventsible.biz` and `eventsible.shop` remain planned. Seven-day error-log queries returned no current error entries for the four active Vercel projects. The Vercel connector returned a permissions error for runtime errors, so the read-only Vercel CLI was used as the documented fallback.

Two Supabase projects are ACTIVE_HEALTHY on PostgreSQL 17: the OS project and the EVENTSgame project. All inspected application tables have RLS enabled. A significant boundary risk was found: historical OS migrations/tables also exist in the EVENTSgame project with zero business rows. They must remain unused; OS is the only business system of record. This is technical debt/cleanup evidence, not authorization to drop anything.

## Updated ecosystem matrix

| Lane | Domain | Repository | Production status | Current capabilities | Preview / local work | New plans | Open QA / blockers | Next candidate |
|---|---|---|---|---|---|---|---|---|
| Public website | `eventsible.info` | `EVENTSible/eventsible` | **PRODUCTION VERIFIED** foundation | Power Mode paths, Classic navigation, services, Discover, Fast Track, Full Inquiry entry, reviews/portfolio surfaces and theme-song experience | Same source as Production; no unshipped branch evidence found | Owner-editable Site Studio, stronger real media/review proof | Real asset/review editorial selection; standalone TS errors and dependency audit | Content/proof closure after Mission Control |
| Event Builder | `build.eventsible.info` | `EVENTSible/eventsible` | **PRODUCTION VERIFIED** route/app shell; submission integration **LIVE** | Public package planning, recommendations/ranges, intake and OS submission contract | No newer Preview found | Shared song discovery, richer package guidance | Reconfirm a controlled Production submission only when authorized; TS/audit debt | Maintenance and conversion evidence |
| EVENTSible OS | `eventsible.biz` | `EVENTSible/eventsible-os` | **PRODUCTION VERIFIED** secure/auth foundation | Auth, contacts, leads, events, quotes, bookings schema, tasks/equipment/contracts/invoices foundations, notification/outbox infrastructure | Owner checkout has four post-merge Wedding Hero edits | Deeper operations, memberships, Content Factory | Full lint has one inherited legacy parse error; business workflow QA | **Primary lane** |
| Mission Control | `eventsible.biz` | OS | **LIVE / PARTIAL; not workflow-verified** | Lead status, quote approval and Convert-to-Gig against canonical OS tables | Commit `892c5e13cd1e88b689519725e896133542f205e0` is an ancestor of current Production `e79deb6...`; historical Preview `dpl_DNgcM5CX7HFHBCckybHr76AgKgqw` was READY | Operational queue/dashboard refinement | Authenticated end-to-end mutations were not completed; Production `os_bookings` count is 0 | **Lead-to-Gig operational closure** |
| Wedding Hero | `eventsible.biz/weddinghero` | OS | **PRODUCTION VERIFIED** | Public chooser, Guided Companion, Traditional Full Form, Printable Planner, persistence, callbacks, notification delivery and Day-of Sheet data | Four local post-merge action/email edits need owner disposition | Collaboration and portal integration | Avoid duplicate submission tests; local diff review | Maintain; do not reopen as “planned” |
| Client Portal | `client.eventsible.biz` (planned) | OS, location not yet separate | **PLANNED** | Membership model direction only | None verified | Membership-scoped records, Hero workspaces | Auth/membership contract and domain deployment not implemented | Park until core operations close |
| ECC / VINCE | `eventsible.app` | `EVENTSible/ecc-vince` | **PRODUCTION VERIFIED** public shell; many features **LIVE/PARTIAL** | Rooms, public Player/Audience/Join, PIN Host, requests/queues, player identity, ShoutOut, Host command center, Quick Start, games, scores, content library, Vibe Check and more | Current source includes phases through cards/dice/media; workflow QA varies | Original Boggle-style game, Lyric Lock, physical/hybrid games, song generator, VINCE assistance | Action-time Host QA; one visible mojibake separator; bundle size; exact phase 33/36 live workflow verification | Parallel operational QA, not next primary lane |
| Booth Console / KJ Genie | local desktop | ECC repo `booth-console` | **IMPLEMENTED local Phase B0; not Production web** | Local indexing, MP3+G pairing, recovery, SQLite state, adapter boundaries | Tests/build pass | VDJ/KaraFun adapters and VINCE room connection | Tauri/Rust native verification not completed; dependency audit high | Parked integration prototype |
| Content Factory | OS module | OS | **PLANNED** | Ownership and `event_id` rule are locked | No current implementation verified | Review-before-publish jobs and reusable media | Job/status/media contracts missing | Park until asset metadata contract |
| Google Drive asset system | connected Drive | Drive + future OS metadata | **PARTIAL** | Phase 1 folders and catalog: 233 cataloged assets; 228 originals preserved; 5 JPEG conversions; broad classification | Editorial review queue | OS business-media metadata and Content Factory bridge | Direct connector state was not re-mutated; labels/rights/use need owner review | Safe parallel editorial/data-contract task |
| Custom Creations | `eventsible.shop` (planned) | **NEEDS VERIFICATION** | **PLANNED** | Product/customizer/order/inventory/production ownership defined | No repository/Preview verified | T-Shirt & Gift Bar, Tie-Dye Bar, event-linked orders | Direct conversation and repo inaccessible | Parked for product definition |
| Infrastructure/auth/domains | all active domains | Cross-repo | **PRODUCTION VERIFIED / PARTIAL** | Vercel projects/domains, Supabase projects/RLS, OS magic-link behavior | None changed | Client/shop domains | Shadow OS schema in EVENTSgame; `eventsible.com` unverified; connector permission gap | Maintain boundaries and monitoring |
| Shared integrations | cross-app | Cross-repo | **PARTIAL** | Builder→OS and Wedding Hero→OS exist; public routes are connected | Mission Control closes the lead lifecycle in Preview | OS→ECC activation, shared song metadata, media/Content Factory, client portal | Several contracts remain conceptual | Close Mission Control first |

## System-of-record map

The current canonical ownership rules are confirmed and remain locked:

- **EVENTSible OS:** contacts, leads, Builder submissions, events, quotes, bookings, tasks, staff, equipment, contracts, invoices, payments, client memberships, business-media metadata, and Content Factory jobs.
- **Event Builder:** public planning intake, estimates/recommendations, package configuration, and submission into OS. It is not a CRM.
- **ECC / VINCE:** rooms, Host controls, Players, Audience displays, song/karaoke requests, live queues, teams, scores, games, and live flow.
- **Client Portal:** membership-scoped read/update of OS records, not parallel records.
- **Content Factory:** an OS module using the canonical OS `event_id`.
- **Custom Creations:** products, inventory, customization, orders, and production; event-linked work references OS `contact_id` and `event_id`.
- **Google Drive:** file storage/organization; OS will own searchable business metadata and Content Factory job relationships.

The duplicate-looking OS tables in the EVENTSgame Supabase project are not a second system of record. They are a documented duplication risk to quarantine and later clean up under a separate approved database plan.

## Cross-app integration map

| Flow | Owner and identifiers | Current contract / verification | Missing contract or risk | Next required step |
|---|---|---|---|---|
| Public site → Event Builder | Builder owns intake UI; campaign/referral context | **PRODUCTION VERIFIED** navigation/domain flow | Attribution detail needs verification | Preserve URLs and add evidence-based conversion telemetry later |
| Public inquiry → OS | OS owns contact/lead/event | **LIVE** via canonical intake/notification infrastructure | Controlled Production re-test not performed in this review | Monitor outbox/delivery; no duplicate intake store |
| Event Builder → OS | OS owns `contact_id`, `event_id`, lead/submission lineage | **LIVE**; OS tables contain contacts/leads/events/submissions | Maintain idempotency and data lineage | Exercise in a QA-safe Preview when Mission Control closes |
| Wedding Hero → OS | OS owns contact/event/lead/assignment and answer records | **PRODUCTION VERIFIED** by Aug. release report: exactly one canonical record set and 34 answers | Four local post-merge edits require disposition | Review/merge separately; do not duplicate planner DB |
| Client Portal → OS | OS membership + contact/event IDs | **PLANNED** | Membership authorization and UX contract missing | Define after operations workflow is stable |
| OS → ECC/VINCE | OS `event_id` to ECC activation/room reference | **PLANNED** | Activation payload, mapping, replay/idempotency, auth and lifecycle contract missing | Write shared contract before implementation |
| OS → Content Factory | OS `event_id`, media IDs, job IDs | **PLANNED** | Job lifecycle and review/publish states missing | Define after asset metadata taxonomy |
| OS → Custom Creations | OS `contact_id` / `event_id`; shop owns order/product IDs | **PLANNED** | Repository and order-link contract unverified | Product definition and repo decision first |
| Drive assets → OS media / Content Factory | Drive file ID plus OS media metadata ID and event/service tags | **PARTIAL** organization/catalog exists | Rights, canonical metadata, sync behavior and review state missing | Approve taxonomy and read-only import contract |
| Shared song metadata → Hero / Builder / ECC | Each app owns its workflow; reusable metadata/search contract | **PLANNED** | Provider/licensing, canonical IDs, caching and attribution absent; Spotify-only risk | Product/data design before code |
| Booth Console → ECC | Booth owns local media paths; ECC owns room/request/game state | **PLANNED/PARTIAL adapters** | Pairing/auth, request acknowledgements, offline replay and privacy | Prototype after OS/Mission Control closure |

## Completed or materially changed since July 29

1. **Wedding Hero — PRODUCTION VERIFIED.** The older “Wedding Planner planned” statement is superseded. PR #18 merged at `e79deb6...`; fix `937691dc...`; Production deployment `dpl_6p9...`; reported 76/76 tests, route/mobile/console QA, one controlled submission, exact canonical persistence, delivery and cleanup.
2. **Public website / Builder — PRODUCTION VERIFIED foundation.** Power Paths and separated canonical domains are live at current commit `26a49f80...`.
3. **OS secure domain/auth — PRODUCTION VERIFIED.** `eventsible.biz` is attached and unauthenticated protected routes redirect safely. The magic-link domain issue was reported resolved and confirmed by the owner.
4. **Mission Control — LIVE/PARTIAL, not workflow-verified.** Lead review, quote approval and Convert-to-Gig were built without a parallel CRM, and implementation commit `892c5e13...` is in the current Production source lineage. Authenticated end-to-end mutations remain the decisive gap.
5. **ECC/VINCE — old roadmap superseded.** Current source and database ledgers contain phases 25–36 capabilities; phase 25 is not the next greenfield phase.
6. **Google Drive assets — PARTIAL foundation.** A catalog and broad organization exist with originals preserved; editorial/metadata integration is still open.
7. **New product concepts captured.** Physical/hybrid game props, an actual original Boggle Party-style word-grid game, Lyric Lock, reusable Song Generator, and owner-editable public pages are preserved as requirements, not mislabelled as implementations.

## Conflicts and superseded claims

| Older claim | Current evidence | Resolution |
|---|---|---|
| Wedding planner is planned | Production merge/deployment and end-to-end release report | **SUPERSEDED**; Wedding Hero is **PRODUCTION VERIFIED** |
| `eventsible.biz` and auth routing remain parked | Current Vercel domain and live redirect/login behavior | **SUPERSEDED** |
| ECC Phase 25 Game Show Core is next | Current source, tests, migrations and tables through later phases | **SUPERSEDED** |
| ECC uses Firebase | Current source and active Supabase project | **SUPERSEDED** |
| ECC app domain was pending | `eventsible.app` serves current READY deployment | **SUPERSEDED** |
| Phase 33/36 migrations await remote application | Supabase migration ledger and tables show them applied | Migration claim **SUPERSEDED**; full user workflow remains **NEEDS VERIFICATION** |
| July canonical app-lane summaries are current | August source/deployment/conversation evidence | Historical snapshots; retain but link this refresh |
| Builder and OS may each own lead/business records | Canonical schema and integration source | Rejected; OS ownership remains locked |

## July roadmap reconciliation and revised roadmap

| Historical step | Current status | Evidence-based disposition |
|---|---|---|
| 1. Context/chat refresh | **PARTIAL** | This refresh is current, but some full chats remain inaccessible |
| 2. Integration foundation/shared contracts | **PARTIAL / reordered** | Builder/Hero contracts exist; OS→ECC/media/song contracts remain |
| 3. Public homepage/services | **PRODUCTION VERIFIED foundation** | Content proof/editability remain later work |
| 4. Secure OS landing/Mission Control | Auth **PRODUCTION VERIFIED**; Mission Control **LIVE / PARTIAL** | Operationally close Mission Control next |
| 5. Lead review/quote/Convert to Gig | **LIVE / PARTIAL; workflow NEEDS VERIFICATION** | Next primary slice |
| 6. Calendar/staff/equipment/tasks/contracts/invoices | **PARTIAL / NEEDS VERIFICATION** | Schema/UI foundations exist unevenly; do not broaden before lead-to-gig closes |
| 7. Client Portal/Hero | Hero **PRODUCTION VERIFIED**; portal **PLANNED** | Split the old combined step |
| 8. Content Factory | **PLANNED** | Depends on media contract/taxonomy |
| 9. Custom Creations | **PLANNED / NEEDS VERIFICATION** | Repository and product definition missing |
| 10. OS→ECC activation | **PLANNED** | Shared contract required first |
| 11. Continued ECC roadmap | **Reordered / far advanced** | Maintain and close small operational gaps; do not restart phase 25 |
| 12. VINCE automation | **DEFERRED** | Prerequisite contracts and operational workflows first |

### Revised execution order

1. **Next — EVENTSible OS Mission Control lead-to-gig operational closure.** Run authenticated Preview QA on a QA-safe fixture, verify state transitions and idempotency, fix only confirmed blocking defects, and prove the canonical booking lineage. No Production promotion without separate approval.
2. **Afterward — core operations continuity.** Confirm calendar/availability, staff, equipment, task, contract and invoice handoffs from the converted gig; prioritize the smallest paid-event blocker found.
3. **Then — shared contract tranche.** Define OS→ECC activation and Drive→OS media metadata contracts. These are documentation/data contracts before migrations or broad UI work.
4. **Then — Client Portal minimum membership workspace.** Reuse OS records and Wedding Hero data.
5. **Then — Content Factory and public Site Studio.** Both consume canonical OS media/content controls; sequence according to content operations need.
6. **Later — Custom Creations and deeper ECC/VINCE/Booth integrations.** Start only after repository/product contracts exist.

Safe parallel work during step 1:

- Read-only editorial classification of the existing Drive catalog plus a proposed OS media taxonomy; no file moves or publishing.
- ECC public-route/pause-prevention smoke automation and encoding/accessibility audit that does not require a Host PIN or Production mutation.

Keep parked: full Site Studio implementation, full Client Portal, Content Factory execution engine, Custom Creations, OS→ECC activation code, original Boggle game, Lyric Lock, remote participation, Booth-to-room pairing, advanced VINCE AI, and broad dependency/refactor work.

## Validation results

| Repository | Tests | Lint / type check | Build | Audit | Browser/runtime |
|---|---|---|---|---|---|
| OS | 76/76 pass | `lint:ci` pass; full lint has inherited `public/gigtracker-v1.js` parse error and two warnings; standalone TypeScript pass with incremental output disabled | Pass; route smoke pass after a first concurrency-race failure was rerun serially | 0 vulnerabilities | Login redirects and all Wedding Hero modes pass; no console errors/broken images/overflow |
| Public/Builder | 80/80 pass | Lint pass with 10 inherited Fast Refresh warnings; standalone TypeScript fails on existing Power Mode, auth-middleware/admin and nullable loader-data issues | Pass with large-chunk warning | 6 vulnerabilities: 1 low, 2 moderate, 3 high; no fix run | Public and Builder routes pass desktop/mobile; no console errors/broken images/overflow |
| ECC/VINCE | Search test pass | Build includes TypeScript; no standalone lint script | Pass with ~1.396 MB chunk warning | Root 0 vulnerabilities | Landing/Join/Player/Audience/Host-gate pass; no PIN entered; visible `Â·` separator defect on Player content |
| Booth Console | 12/12 pass | Included in build | Pass | 1 high `nanoid` advisory; no fix run | Native Tauri/Rust and live VDJ/KaraFun integrations not exercised |

No broad upgrades and no `npm audit fix` were run. Generated/build output was not staged. The first OS route smoke was accidentally started concurrently with the build and failed on a transient missing build artifact; its serial rerun passed and is the reliable result.

## Brand/logo review

| Asset | Evidence | Recommended role |
|---|---|---|
| `Untitled design (1).png` | 1408×769, transparent, strong compact mark, materially clearer at small sizes | Preferred future digital/header base for public site, Builder, OS, Wedding Hero, Host, Player, Audience lobby and mobile navigation after optimization and owner approval |
| `EVENTSible Logo 7.51 x 5.80.png` | 653×505, transparent, 216 KB; legacy wording and dense small details; identical to ECC classic asset | Heritage/reference, long-form documentation, archival brand story; not tiny UI |
| `EVENTSible Logo (AI Update) 7.50 x 5.86.png` | 1162×908, transparent, 1.6 MB; detailed 3D/promotional art; identical to ECC 3D asset | Promotional hero/social material at large sizes only; inspect small lettering before campaign use |
| `Untitled design (3).png` | 3245×2508, transparent, 7.8 MB; heavy white edge and visible lower-right sparkle/artifact | **Do not publish as-is**; quarantine for cleanup |

Keep the existing compact Super-E favicon concept and produce an approved optimized icon set (16, 32, 180, 192 and 512 px). Create a true monochrome/vector fallback. Use descriptive alt text such as “EVENTSible event entertainment” when the logo conveys brand identity; use empty alt only when it is redundant decoration beside a visible text label. Do not ship the detailed heritage/promotional marks into small mobile controls. No Production asset was replaced in this review.

## Preserved concepts requiring product definition

- **Physical/hybrid games:** dice, cards, ping-pong balls, colored cones, cups, plates, obstacles and challenge props with Host-controlled digital state.
- **Original word-grid game:** EVENTSible needs an actual original Boggle Party-style game, not merely unrelated “word-inspired” mechanics; naming, rules, IP distance and content generation need definition.
- **Lyric Lock:** DJ-owned local audio/video, audience-readable lyrics, 30–90 second clips, blanks/locking, buzzer integration; VINCE stores metadata/game state rather than duplicating the media library. Licensing and local-file boundaries must be resolved.
- **Song Generator / Soundtrack Finder:** reusable discovery by moment, emotion, mood, keywords, referenced lyric words, days, feelings, event type, ceremony moments, special dances and dance-floor situation. Reuse across Hero, Builder, ECC, music games and DJ requests. Spotify is optional, not canonical.
- **Website editability:** OS-owned safe editing for text, images, fonts, sections, layouts, templates, media and promotions with Preview/review/rollback controls.
- **Drive/media:** retain Phase 1 folders, broad sorting, owner/editor permissions, picture/video labeling, use categories, service/event tags, review-before-publish, and future OS metadata/Content Factory linkage.

## Selected next work

**Primary build lane:** EVENTSible OS / Mission Control.

**Exactly one next implementation slice:** close the existing Lead Review → Approved Quote → Convert to Gig workflow in one controlled Preview phase. Use a QA-safe authenticated fixture; verify role protection, canonical contact/lead/event/quote/booking lineage, idempotent repeat actions, activity/outbox effects, recoverable error messages, and the first downstream operations handoff. Fix only defects proven by that test. Do not add a new CRM, schema, dashboard redesign, or Production promotion.

Acceptance criteria:

1. Authorized staff can complete the workflow in Preview without direct database edits.
2. Exactly one canonical booking is produced from the approved quote; a repeat action is harmless and does not duplicate records.
3. The resulting event/booking exposes the identifiers required by calendar/tasks/contracts/invoices without copying business records.
4. Unauthorized and unauthenticated mutations fail safely.
5. Focused tests, full tests, `lint:ci`, build, route/browser smoke, no-secret checks and audit are reported.
6. A Preview deployment is verified; Production remains unchanged until Travis separately authorizes promotion.

**Safe parallel tasks (maximum two):**

1. Drive asset catalog editorial review plus a proposed OS media-metadata taxonomy, read-only and unpublished.
2. ECC public-route/pause-prevention automation plus the Player text-encoding/accessibility audit, with no Host PIN and no Production mutation.

**Parking lot:** Site Studio implementation; full Client Portal; Content Factory engine; Custom Creations repository/app; OS→ECC activation implementation; original word-grid game; Lyric Lock; broad physical-game library; Music Bingo expansion; remote participation; Booth adapters; VINCE AI/analytics; dependency upgrades; schema cleanup in EVENTSgame; logo replacement.

## Remaining gaps and required manual QA

- Full content was not accessible for every project conversation; specifically missing are the full ecosystem-integration, context-refresh, documentation-cleanup, Custom Creations, Event Soundboard, Site Structure and current Booth/KJ histories.
- Mission Control authenticated Preview mutation QA remains the highest operational gap.
- Host-side ECC phase 33/36 workflows were not exercised because no Host PIN was entered; action-time authorization is still required.
- The OS owner checkout contains four uncommitted post-merge files that need independent review.
- Public/Builder TypeScript and dependency advisories, ECC/Builder bundle size, Booth advisory and Player mojibake are maintenance risks.
- `eventsible.com`, the Custom Creations repository, the client portal deployment, native Booth runtime, and media/provider licensing remain unverified.

This document intentionally stops at scope, QA and recommendation. It does not authorize the selected implementation slice.
