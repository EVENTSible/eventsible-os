# EVENTSible Documentation Hub

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository, `docs/`
- Last verified: 2026-08-24
- Applies to: EVENTSible ecosystem repositories and app lanes
- Supersedes: scattered cross-system plans in individual app repositories when they conflict with this hub
- Related documents: `docs/ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md`, `docs/ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md`, `docs/ecosystem/EVENTSIBLE_PROJECT_AND_REPOSITORY_INDEX.md`, `docs/EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md`

This folder is the source of truth for cross-system EVENTSible documentation. App repositories may keep app-specific setup, status, and implementation docs, but ecosystem ownership, domain routing, roadmap order, and system-of-record decisions belong here.

## Current Production Release Evidence

- Status: LIVE / PRODUCTION VERIFIED
- Verified at: 2026-08-24
- `eventsible.biz/weddinghero`: LIVE / PRODUCTION VERIFIED
- Wedding Hero Production merge: `e79deb6b03d296b367fc8b92f7f413a0c5b2dea0`
- Wedding Hero Production deployment: `dpl_6p9EDgGL5bozMtqmACeNoyt3CGTV`
- `eventsible.app`: LIVE / PRODUCTION VERIFIED with healthy SSL
- ECC / VINCE comic experience: LIVE / PRODUCTION VERIFIED
- ECC final `master` SHA: `1d31fb1168df08bb0a775ba54b699953f0f84cad`
- ECC Production deployment: `dpl_EdWFPwdYRPDBHgew3dRypCQX6Y6L`
- `eventsible.info`: PRODUCTION VERIFIED
- Public Production deployment: `dpl_6hrXt2ouaYp3iaDy6m5oVdS9FUQb`
- Public final `main` SHA: `26a49f80bd47b68920d9c78cd4345545bafc2d9e`
- `build.eventsible.info`: PRODUCTION VERIFIED
- Builder Production deployment: `dpl_GdQPEB2geX2h7ur2Muvpdfy87Q7Q`
- Builder Git source: `main`
- Builder SHA: `26a49f80bd47b68920d9c78cd4345545bafc2d9e`
- `eventsible.info` Play / Connect: LIVE
- Play / Connect destination: `https://eventsible.app`
- Builder navigation escape/back improvements: LIVE in public `main`
- Public Build entry: `https://build.eventsible.info/build?start=choose`
- Builder navigation includes Back to EVENTSible, logo to `eventsible.info`, and quote success to `eventsible.info`.
- Host protection remains intact.
- ECC Player tabs remain exactly: Main, Tools, Info.

## Canonical Document Map

| Area | Canonical document |
| --- | --- |
| Full scope refresh (2026-08-24) | [EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md](ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md) |
| ChatGPT Project replacement map (2026-08-24) | [EVENTSIBLE_PROJECT_RESOURCE_REPLACEMENT_MAP_2026-08-24.md](project-resources/EVENTSIBLE_PROJECT_RESOURCE_REPLACEMENT_MAP_2026-08-24.md) |
| Export-ready Project context | [EVENTSIBLE_PROJECT_CONTEXT_2026-08-24.md](project-resources/EVENTSIBLE_PROJECT_CONTEXT_2026-08-24.md) |
| Export-ready Chat Index | [EVENTSIBLE_CHAT_INDEX_2026-08-24.md](project-resources/EVENTSIBLE_CHAT_INDEX_2026-08-24.md) |
| Export-ready bootstrap templates | [EVENTSIBLE_CHAT_BOOTSTRAP_TEMPLATES_2026-08-24.md](project-resources/EVENTSIBLE_CHAT_BOOTSTRAP_TEMPLATES_2026-08-24.md) |
| Export-ready Project custom instructions | [EVENTSIBLE_PROJECT_CUSTOM_INSTRUCTIONS_2026-08-24.md](project-resources/EVENTSIBLE_PROJECT_CUSTOM_INSTRUCTIONS_2026-08-24.md) |
| Ecosystem master plan | [EVENTSIBLE_ECOSYSTEM_MASTER_PLAN.md](ecosystem/EVENTSIBLE_ECOSYSTEM_MASTER_PLAN.md) |
| Current state | [EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md](ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md) |
| Domain and app index | [EVENTSIBLE_DOMAIN_AND_APP_INDEX.md](ecosystem/EVENTSIBLE_DOMAIN_AND_APP_INDEX.md) |
| System-of-record matrix | [EVENTSIBLE_SYSTEM_OF_RECORD_MATRIX.md](ecosystem/EVENTSIBLE_SYSTEM_OF_RECORD_MATRIX.md) |
| Repository index | [EVENTSIBLE_PROJECT_AND_REPOSITORY_INDEX.md](ecosystem/EVENTSIBLE_PROJECT_AND_REPOSITORY_INDEX.md) |
| Shared architecture | [EVENTSIBLE_SHARED_ARCHITECTURE.md](architecture/EVENTSIBLE_SHARED_ARCHITECTURE.md) |
| Data flow | [EVENTSIBLE_DATA_FLOW_OVERVIEW.md](architecture/EVENTSIBLE_DATA_FLOW_OVERVIEW.md) |
| Auth and security boundaries | [EVENTSIBLE_AUTH_AND_SECURITY_BOUNDARIES.md](architecture/EVENTSIBLE_AUTH_AND_SECURITY_BOUNDARIES.md) |
| Builder to OS integration | [EVENT_BUILDER_TO_OS.md](integrations/EVENT_BUILDER_TO_OS.md) |
| Wedding Hero resources | [WEDDING_HERO_RESOURCES_2026-08-19.md](integrations/WEDDING_HERO_RESOURCES_2026-08-19.md) |
| Ecosystem integration foundation | [ECOSYSTEM_INTEGRATION_FOUNDATION.md](integrations/ECOSYSTEM_INTEGRATION_FOUNDATION.md) |
| Outbox Production verification | [ECOSYSTEM_OUTBOX_PRODUCTION_VERIFICATION_2026-08-03.md](integrations/ECOSYSTEM_OUTBOX_PRODUCTION_VERIFICATION_2026-08-03.md) |
| Outbox source parity | [ECOSYSTEM_OUTBOX_SOURCE_PARITY_2026-08-03.md](integrations/ECOSYSTEM_OUTBOX_SOURCE_PARITY_2026-08-03.md) |
| Builder intake outbox wiring | [ECOSYSTEM_BUILDER_INTAKE_OUTBOX_WIRING_2026-08-03.md](integrations/ECOSYSTEM_BUILDER_INTAKE_OUTBOX_WIRING_2026-08-03.md) |
| Builder outbox Production containment | [ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_CONTAINMENT_2026-08-03.md](integrations/ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_CONTAINMENT_2026-08-03.md) |
| Builder outbox quote lookup forward-fix | [ECOSYSTEM_BUILDER_OUTBOX_QUOTE_LOOKUP_FIX_2026-08-03.md](integrations/ECOSYSTEM_BUILDER_OUTBOX_QUOTE_LOOKUP_FIX_2026-08-03.md) |
| Builder outbox payload parity forward-fix | [ECOSYSTEM_BUILDER_OUTBOX_PAYLOAD_PARITY_FIX_2026-08-04.md](integrations/ECOSYSTEM_BUILDER_OUTBOX_PAYLOAD_PARITY_FIX_2026-08-04.md) |
| Builder Event Staff quote label forward-fix | [ECOSYSTEM_BUILDER_EVENT_STAFF_LABEL_FIX_2026-08-04.md](integrations/ECOSYSTEM_BUILDER_EVENT_STAFF_LABEL_FIX_2026-08-04.md) |
| Builder outbox Production activation - PRODUCTION VERIFIED | [ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_ACTIVATION_2026-08-04.md](integrations/ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_ACTIVATION_2026-08-04.md) |
| Builder submission email notifications - PRODUCTION VERIFIED | [ECOSYSTEM_BUILDER_SUBMISSION_EMAIL_NOTIFICATIONS_2026-08-05.md](integrations/ECOSYSTEM_BUILDER_SUBMISSION_EMAIL_NOTIFICATIONS_2026-08-05.md) |
| OS to ECC/VINCE integration | [OS_TO_ECC_VINCE.md](integrations/OS_TO_ECC_VINCE.md) |
| OS to Client Portal integration | [OS_TO_CLIENT_PORTAL.md](integrations/OS_TO_CLIENT_PORTAL.md) |
| OS to Content Factory integration | [OS_TO_CONTENT_FACTORY.md](integrations/OS_TO_CONTENT_FACTORY.md) |
| OS to Custom Creations integration | [OS_TO_CUSTOM_CREATIONS.md](integrations/OS_TO_CUSTOM_CREATIONS.md) |
| Master roadmap | [EVENTSIBLE_MASTER_ROADMAP.md](roadmap/EVENTSIBLE_MASTER_ROADMAP.md) |
| Next build order | [EVENTSIBLE_NEXT_BUILD_ORDER.md](roadmap/EVENTSIBLE_NEXT_BUILD_ORDER.md) |
| Follow-up task baseline | [EVENTSIBLE_BASELINE_FOLLOW_UP_TASKS.md](roadmap/EVENTSIBLE_BASELINE_FOLLOW_UP_TASKS.md) |
| Decision log | [EVENTSIBLE_DECISION_LOG.md](decisions/EVENTSIBLE_DECISION_LOG.md) |
| Discrepancy report | [EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md](EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md) |
| Documentation inventory | [EVENTSIBLE_DOCUMENTATION_INVENTORY.md](ecosystem/EVENTSIBLE_DOCUMENTATION_INVENTORY.md) |
| App-lane summaries | [EVENTSIBLE_APP_LANE_SUMMARIES.md](apps/EVENTSIBLE_APP_LANE_SUMMARIES.md) |

## Where Future Updates Belong

| Need | Update |
| --- | --- |
| Current repository, domain, or deployment identity | `ecosystem/EVENTSIBLE_PROJECT_AND_REPOSITORY_INDEX.md` |
| Current app lane status | `ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md` |
| Domain and app routing choices | `ecosystem/EVENTSIBLE_DOMAIN_AND_APP_INDEX.md` |
| Data ownership | `ecosystem/EVENTSIBLE_SYSTEM_OF_RECORD_MATRIX.md` |
| Cross-app architecture | `architecture/` |
| Builder/OS/VINCE/client/shop/content handoffs | `integrations/` |
| Ecosystem integration contracts and ID foundation | `integrations/ECOSYSTEM_INTEGRATION_FOUNDATION.md` |
| Outbox Production verification, source parity, Builder intake wiring, containment, quote lookup fix, payload parity fix, Event Staff label fix, Production activation, and Builder lead email notifications | `integrations/ECOSYSTEM_OUTBOX_PRODUCTION_VERIFICATION_2026-08-03.md`, `integrations/ECOSYSTEM_OUTBOX_SOURCE_PARITY_2026-08-03.md`, `integrations/ECOSYSTEM_BUILDER_INTAKE_OUTBOX_WIRING_2026-08-03.md`, `integrations/ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_CONTAINMENT_2026-08-03.md`, `integrations/ECOSYSTEM_BUILDER_OUTBOX_QUOTE_LOOKUP_FIX_2026-08-03.md`, `integrations/ECOSYSTEM_BUILDER_OUTBOX_PAYLOAD_PARITY_FIX_2026-08-04.md`, `integrations/ECOSYSTEM_BUILDER_EVENT_STAFF_LABEL_FIX_2026-08-04.md`, `integrations/ECOSYSTEM_BUILDER_OUTBOX_PRODUCTION_ACTIVATION_2026-08-04.md`, and `integrations/ECOSYSTEM_BUILDER_SUBMISSION_EMAIL_NOTIFICATIONS_2026-08-05.md` |
| Build order and roadmap | `roadmap/` |
| Baseline follow-up tasks from this merge | `roadmap/EVENTSIBLE_BASELINE_FOLLOW_UP_TASKS.md` |
| Locked decisions | `decisions/EVENTSIBLE_DECISION_LOG.md` |
| Stale or conflicting claims | `EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md` |
| Historical documents that should not guide current work | `archive/` |

## Canonical Labels

Use these labels consistently: LIVE, PRODUCTION VERIFIED, IMPLEMENTED, PARTIAL, PLANNED, DEFERRED, HISTORICAL, SUPERSEDED, NEEDS VERIFICATION.

Only mark a feature PRODUCTION VERIFIED when current source, deployment metadata, and safe route or workflow evidence support it.
