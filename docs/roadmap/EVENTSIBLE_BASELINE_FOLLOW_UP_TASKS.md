# EVENTSible Baseline Follow-Up Tasks

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: EVENTSible OS, Event Builder, ECC/VINCE, domain operations
- Supersedes: scattered post-cleanup task notes that conflict with this list
- Related documents: `EVENTSIBLE_NEXT_BUILD_ORDER.md`, `../ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md`, `../EVENTSIBLE_DOCUMENTATION_DISCREPANCIES.md`

These tasks are documented follow-ups from the 2026-07-29 documentation merge baseline. They are not feature work and were not fixed during the documentation merge.

| Priority | Follow-up | Owner repo | Status | Acceptance criteria |
| --- | --- | --- | --- | --- |
| 1 | EVENTSible OS root route / `eventsible.biz` routing verification | `EVENTSible/eventsible-os` | NEEDS VERIFICATION | Root route behavior, `eventsible.biz`, auth redirects, and production target are verified without changing schemas or data. |
| 2 | Existing `public/gigtracker-v1.js` lint parse error | `EVENTSible/eventsible-os` | DEFERRED | Parse error is reviewed in a dedicated fix phase; documentation merge remains unchanged. |
| 3 | EVENTSible OS dependency and audit review | `EVENTSible/eventsible-os` | DEFERRED | 12 inherited high audit advisories are reviewed in a dependency-maintenance pass without risky unplanned upgrades. |
| 4 | Event Builder authenticated Admin visual recheck | `EVENTSible/eventsible` | NEEDS VERIFICATION | Admin Leads view is checked in an authenticated staff session when access is explicitly authorized. |
| 5 | Browser-level ECC/VINCE Host/Player/Audience QA | `EVENTSible/ecc-vince` | NEEDS VERIFICATION | Hydrated Host, Player, Audience, and Join flows are checked with public/protected route boundaries preserved. |
| 6 | `eventsible.com` ownership and intended-use verification | Cross-system/domain ops | NEEDS VERIFICATION | Current ownership and intended use are verified before any documentation calls `eventsible.com` active. |

The recommended next phase remains ecosystem integration foundation and shared contracts.
