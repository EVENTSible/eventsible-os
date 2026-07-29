# EVENTSible Domain and App Index

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: all EVENTSible public, private, and live-event lanes
- Supersedes: older domain plans that make `eventsible574.com` the home for new apps
- Related documents: `EVENTSIBLE_SYSTEM_OF_RECORD_MATRIX.md`, `../architecture/EVENTSIBLE_AUTH_AND_SECURITY_BOUNDARIES.md`

| Domain | Status | Lane | Canonical role | Notes |
| --- | --- | --- | --- | --- |
| `eventsible.info` | PLANNED / PARTIAL | Public customer website family | Public service education, portfolio, reviews, Event Builder entry, and public planning tools | The current production Builder lives at `build.eventsible.info`; the full public homepage is a later workstream. |
| `build.eventsible.info` | PRODUCTION VERIFIED | Event Builder | Direct public Event Builder | Vercel production deployment `dpl_7C2n8eBUoWuDDM6N7kjwcd8cog84` is READY on commit `ab128cefb9bf97042dba0f3222ecbca858b0f863`. |
| `eventsible.biz` | PLANNED / NEEDS VERIFICATION | EVENTSible OS / Business HQ | Private OS, GigTracker, CRM, calendar, quotes, bookings, operations, staff, equipment, tasks, Content Factory, automation | OS project is deployed to Vercel, but `eventsible.biz` routing was not verified in this cleanup pass. |
| `client.eventsible.biz` | PLANNED | Client Portal | Booked-client portal and planning workspace | Use this as the planned client portal domain. Older `portal.eventsible.biz` references are historical or transitional until manually confirmed. |
| `eventsible.app` | PLANNED / ECC IMPLEMENTED ELSEWHERE | ECC / VINCE | Host, Player, Audience, Join, karaoke, games, scoring, and live event flow | Current ECC/VINCE production is on Vercel app domains, not a verified `eventsible.app` custom domain. |
| `eventsible.shop` | PLANNED | Custom Creations | Products, orders, production, and inventory | Future shop lane should reference OS event/contact IDs when orders connect to events. |
| `www.eventsible574.com` | LEGACY / BRIDGE | Legacy public trust website | Legacy/local trust website and bridge into the newer ecosystem | Do not use this as the architectural home for new apps. |
| `eventsible.com` | NEEDS VERIFICATION | Unknown | Do not document as active | Ownership and intended use were not verified in this cleanup pass. |

