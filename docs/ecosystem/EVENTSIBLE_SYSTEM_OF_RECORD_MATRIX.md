# EVENTSible System of Record Matrix

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: data ownership across app lanes
- Supersedes: plans that create parallel lead, event, or quote databases
- Related documents: `../architecture/EVENTSIBLE_DATA_FLOW_OVERVIEW.md`, `../integrations/EVENT_BUILDER_TO_OS.md`

| Data type | System of record | Accessing systems | Status | Notes |
| --- | --- | --- | --- | --- |
| Contacts | EVENTSible OS | Event Builder, Client Portal, Content Factory, Custom Creations | IMPLEMENTED / PARTIAL | Builder intake creates or reuses contacts through OS. |
| Leads | EVENTSible OS | Event Builder, OS admin | IMPLEMENTED | No parallel public lead table should be introduced. |
| Builder submissions | EVENTSible OS | Event Builder, OS admin | IMPLEMENTED | `public.os_ingest_builder_submission` is the canonical intake function. |
| Events | EVENTSible OS for business records; ECC/VINCE for live room sessions | Builder, OS, Client Portal, ECC/VINCE | PARTIAL | Business event and live room state must remain separate. |
| Quotes | EVENTSible OS | Event Builder, OS admin, Client Portal later | PARTIAL | Draft quote and quote-item chain exists; approved quote workflow remains next. |
| Bookings | EVENTSible OS | OS, Client Portal, ECC/VINCE activation later | PARTIAL / PLANNED | Convert-to-Gig is next-build work, not completed in this cleanup. |
| Tasks | EVENTSible OS | OS, Content Factory | PARTIAL | Event workspace/task records exist in OS history; full operational workflow needs verification. |
| Staff | EVENTSible OS / Supabase Auth app metadata | OS, Event Builder admin, ECC host roles | PARTIAL | Keep role decisions behind private auth. |
| Equipment | EVENTSible OS | OS, Event Builder quoting | PLANNED / PARTIAL | Do not create parallel inventory tables in public Builder. |
| Payments | EVENTSible OS | OS, Client Portal | PLANNED | No verified payment production workflow in this pass. |
| Contracts | EVENTSible OS | OS, Client Portal | PLANNED | No verified contract production workflow in this pass. |
| Client memberships | EVENTSible OS | Client Portal | PARTIAL | OS repo includes client portal assets; production route is not yet domain-verified. |
| Live VINCE rooms | ECC/VINCE | Player, Audience, Host, Join | IMPLEMENTED | Current production health verified through ECC Vercel domain. |
| Player participation | ECC/VINCE | Player, Host, Audience | IMPLEMENTED | Public Player remains separate from OS business data. |
| Requests / queues | ECC/VINCE | Player, Host, Audience, Booth Console later | IMPLEMENTED | Karaoke and request queues stay in live-event lane. |
| Scores | ECC/VINCE | Player, Host, Audience | IMPLEMENTED | Scoreboard/leaderboard lives in ECC/VINCE. |
| Media assets | ECC/VINCE for live effects; OS/Content Factory for business media; Shop for products | ECC, OS, Shop | PARTIAL | Do not mix private client files with public/live assets. |
| Content jobs | EVENTSible OS / Content Factory module | OS, Content Factory | PLANNED | Use same OS `event_id`; no separate event database. |
| Custom Creation orders | Custom Creations / shop lane | OS when related to events | PLANNED | Reference OS contact/event IDs where relevant. |
| Public service catalog | Event Builder / public website | Builder, eventsible.info, OS | IMPLEMENTED / PARTIAL | Public pricing/catalog should not expose private cost data. |
| Private pricing/cost data | EVENTSible OS | OS only | PLANNED | Keep internal cost/margin data out of public apps. |

