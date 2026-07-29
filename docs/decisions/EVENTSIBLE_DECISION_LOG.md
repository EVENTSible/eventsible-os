# EVENTSible Decision Log

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: locked ecosystem decisions
- Supersedes: conflicting older plans
- Related documents: `../ecosystem/EVENTSIBLE_ECOSYSTEM_MASTER_PLAN.md`

| Date recorded | Decision | Reason | Affected apps | Status | Superseded decision |
| --- | --- | --- | --- | --- | --- |
| 2026-07-29 | `eventsible.info` is the public website family | Keeps public education and planning separate from private business tools | Public site, Builder | LOCKED | None |
| 2026-07-29 | `build.eventsible.info` is the direct Builder | Production Builder is verified there | Builder | LOCKED | Lovable-only current domain |
| 2026-07-29 | `eventsible.biz` is private Business HQ | Business records require private access | OS | LOCKED | Public/legacy domain as OS home |
| 2026-07-29 | `client.eventsible.biz` is the planned client portal | Separates booked-client workspace from staff OS | OS, Client Portal | LOCKED | `portal.eventsible.biz` as canonical future name |
| 2026-07-29 | `eventsible.app` is ECC/VINCE | Live-event interactions need a distinct app lane | ECC/VINCE | LOCKED | `.biz` or legacy domain for live rooms |
| 2026-07-29 | `eventsible.shop` is planned Custom Creations | Shop/order operations deserve a separate lane | Shop, OS | LOCKED | Public Builder as shop system |
| 2026-07-29 | `eventsible574.com` is legacy/bridge only | Avoids anchoring new architecture to legacy brand/domain | All | LOCKED | Legacy domain as new app home |
| 2026-07-29 | EVENTSible OS is the business source of truth | Prevents duplicate lead/event/quote databases | OS, Builder, Client Portal | LOCKED | Parallel CRM tables |
| 2026-07-29 | Event Builder submits into OS | Keeps public capture separate from business records | Builder, OS | LOCKED | Standalone Builder lead store |
| 2026-07-29 | ECC/VINCE remains separate live-event app | Live state is not CRM/business data | ECC/VINCE, OS | LOCKED | Merged OS/live-room app |
| 2026-07-29 | Player View stays Main / Tools / Info | Preserves simple guest control structure | ECC/VINCE | LOCKED | Extra top-level Player tabs |
| 2026-07-29 | Quick Start presets remain non-destructive | Presets must not delete event data | ECC/VINCE | LOCKED | Destructive preset setup |
| 2026-07-29 | Host routes remain PIN-protected | Protects live controls | ECC/VINCE | LOCKED | Public host controls |
| 2026-07-29 | Production apps use dedicated Vercel projects | Avoids deployment/domain confusion | All | LOCKED | Shared ambiguous project |
| 2026-07-29 | Supabase service-role credentials remain server-only | Prevents privilege exposure | All Supabase apps | LOCKED | Public service-role usage |
| 2026-07-29 | Documentation cleanup precedes more GigTracker work | Reduces drift before new development | OS | LOCKED | Build features before docs |
| 2026-07-29 | Public and private landing pages are separate | Keeps marketing and operations distinct | Public site, OS | LOCKED | Single mixed landing page |
| 2026-07-29 | No feature is live without current verification | Prevents stale launch claims | All | LOCKED | Treating old docs as live proof |

