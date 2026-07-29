# EVENTSible Documentation Inventory

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: documentation across ECC/VINCE, Event Builder, EVENTSible OS
- Supersedes: none; this is the inventory for this cleanup
- Related documents: `../EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md`

| Repository | File path | Purpose | Last meaningful update | Current status | Canonical | App-specific | Superseded | Outdated | Duplicate | Archive candidate | Conflicting information | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EVENTSible OS | `docs/README.md` | Cross-system documentation index | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | No | Keep current |
| EVENTSible OS | `docs/ecosystem/*` | Ecosystem plan, current state, domains, ownership, repository index | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | Resolves older conflicts | Keep current |
| EVENTSible OS | `docs/architecture/*` | Shared architecture, data flow, security boundaries | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | No | Keep current |
| EVENTSible OS | `docs/integrations/*` | Cross-app integration boundaries | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | No | Keep current |
| EVENTSible OS | `docs/roadmap/*` | Master roadmap and next build order | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | No | Keep current |
| EVENTSible OS | `docs/decisions/EVENTSIBLE_DECISION_LOG.md` | Locked ecosystem decisions | 2026-07-29 | CANONICAL | Yes | No | No | No | No | No | No | Keep current |
| EVENTSible OS | `README.md`, `SETUP.md` | OS app setup/status | Pre-existing | APP-SPECIFIC | No | Yes | No | Partial | No | No | Domain wording may use transitional `portal.eventsible.biz` | Update later after domain/auth verification |
| EVENTSible OS | `docs/DOMAIN_SYSTEM_ARCHITECTURE.md`, `docs/DOMAIN_ROUTING_SHEET.md`, `docs/DOMAIN_DNS_ROUTING_RUNBOOK.md` | Earlier domain planning | Pre-existing | PARTIALLY CURRENT | No | No | Partial | Partial | Partial | No | Some statuses predate this cleanup | Keep as historical planning; link canonical docs above |
| EVENTSible OS | `docs/LOVABLE_EVENT_BUILDER_INTEGRATION.md` | Original Builder-to-OS integration notes | Pre-existing | PARTIALLY CURRENT | No | Yes | No | Partial | No | No | Lovable wording can sound current | Keep as historical source; canonical integration is `integrations/EVENT_BUILDER_TO_OS.md` |
| Event Builder | `README.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/EVENTSIBLE_OS_INTEGRATION.md`, `docs/VERCEL_DEPLOYMENT.md`, `CHANGELOG.md`, `src/routes/README.md` | Builder app documentation | Pre-existing plus app alignment doc | APP-SPECIFIC CURRENT | No | Yes | No | Some details need periodic verification | Some overlap | No | Some production QA remains manual | Keep and cross-link to OS hub |
| ECC/VINCE | `docs/ECC_VINCE_STATUS.md`, `docs/ECC_VINCE_CHANGELOG.md`, `docs/ECC_VINCE_MASTER_BUILD_PLAN_V2.md`, `docs/VINCE_*`, `README.md` | Current and historical ECC/VINCE docs | Pre-existing plus app alignment doc | APP-SPECIFIC CURRENT / HISTORICAL MIX | No | Yes | Some | Some | Some | No | Old phase numbers conflict with current docs | Keep; mark older plans historical/partially current |
| ECC/VINCE | `ECC_VINCE_MASTER_BUILD_PLAN.md`, `PROJECT_HANDOFF_OVERVIEW.md`, `PROJECT_UPDATE.md` | Older master/handoff/status records | Pre-existing | HISTORICAL / PARTIALLY CURRENT | No | Yes | Partial | Partial | Partial | Mark later, do not delete | Older phase and Host PIN status wording conflicts | Preserve history; add prominent notices in a later narrow doc pass if moving links is safe |
| ECC/VINCE | `apps/booth-console/README.md`, `docs/VINCE_BOOTH_CONSOLE_*` | Booth Console local foundation docs | Pre-existing | APP-SPECIFIC CURRENT | No | Yes | No | No | Some overlap | No | No | Keep; use app-lane summary here as canonical cross-link |

