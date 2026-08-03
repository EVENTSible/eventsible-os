# EVENTSible Master Roadmap

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-08-03
- Applies to: cross-ecosystem roadmap
- Supersedes: stale app-specific build-order notes
- Related documents: `EVENTSIBLE_NEXT_BUILD_ORDER.md`

| Order | Workstream | Purpose | Current status | Dependencies | Risks | Acceptance criteria | What should wait | Target repository | Target domain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Documentation cleanup | Consolidate source of truth | IN PROGRESS | Verified repos | Stale docs | Branches pushed, docs linked, no behavior changes | Feature work | OS + app docs | N/A |
| 2 | Shared contracts | Define IDs, payloads, security boundaries | PLANNED | Docs accepted | Premature schema work | Contracts documented before code | Homepage/GigTracker build | OS | `.biz`, `.info`, `.app` |
| 3 | Public website | Build modern `eventsible.info` | PLANNED | Domain/content decisions | Mixing Builder with OS admin | Public site routes verified | Private OS dashboard | Event Builder/public site | `eventsible.info` |
| 4 | Business HQ | Secure OS landing/dashboard | PARTIAL | OS auth and Vercel routing | Exposing private data | `eventsible.biz` login/dashboard verified | Client portal | OS | `eventsible.biz` |
| 5 | Builder review and Convert to Gig | Turn leads into approved quote/booked gig | PARTIAL | OS data contracts | Duplicate quote/event data | Staff can review, approve, convert | Full automation | OS + Builder | `.biz`, `build.eventsible.info` |
| 6 | Operations core | Calendar, staff, equipment, tasks, contracts, invoices | PARTIAL / PLANNED | Gig conversion | Scope creep | Core operational records and status flows work | Content Factory/shop | OS | `eventsible.biz` |
| 7 | Event Closeout, Staff Debrief & Profitability | Capture post-event actuals, staff feedback, expenses, draft payouts, equipment issues, profitability, and follow-up | PLANNED | Booked gigs, staff assignments, equipment, invoices/payments, tasks | Exposing executive financial data to staff; treating reusable assets as one-event expenses; unapproved payouts; missing receipts | Executive closeout and mobile staff debrief use the same `event_id`; actual revenue/expenses and estimated profit are calculated; purchases are classified as consumable, rental, client-specific, reusable asset, or partial allocation; worker payouts remain draft until management approval; receipts, damage, improvements, and follow-up tasks are captured | Automated payroll/tax filing, automatic payouts, and client-facing post-event survey | OS | `eventsible.biz` |
| 8 | Client Portal / Hero | Booked-client planning workspace | PARTIAL / PLANNED | Auth, membership, OS event model | Privacy leaks | Client sees only scoped event data | Public AI planner | OS | `client.eventsible.biz` |
| 9 | Content Factory | Event-linked content workflow | PLANNED | OS event IDs and review policy | Auto-publishing without review | Draft/review/publish workflow defined | Social automation | OS | `eventsible.biz` |
| 10 | Custom Creations | Shop and production workflows | PLANNED | Product/order model | Duplicate contacts/events | Orders reference OS IDs when relevant | Deep integrations | Future shop | `eventsible.shop` |
| 11 | OS to ECC/VINCE activation | Create live room from booked event | PLANNED | OS booking maturity | Exposing private records to public rooms | Live room receives only safe event-day data | Assistant automation | OS + ECC/VINCE | `eventsible.app` |
| 12 | ECC/VINCE roadmap | Continue live games/show tools | IMPLEMENTED / PARTIAL | Current phase QA | Breaking locked Player View | Main/Tools/Info preserved, host controls protected | Smart assistant | ECC/VINCE | `eventsible.app` |
| 13 | VINCE assistant | Smart host layer and automation | PLANNED | Stable data contracts | AI actions without review | Assistant suggestions reviewed/controlled | Autonomous production actions | ECC/VINCE + OS | `.app`, `.biz` |

