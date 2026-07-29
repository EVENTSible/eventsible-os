# EVENTSible Documentation Discrepancies

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: documentation conflicts across EVENTSible repositories
- Supersedes: unresolved stale claims in older status, domain, and phase documents
- Related documents: `ecosystem/EVENTSIBLE_DOCUMENTATION_INVENTORY.md`, `ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md`

| Discrepancy | Conflicting claims | Files involved | Evidence reviewed | Recommended canonical answer | Confidence | Manual confirmation |
| --- | --- | --- | --- | --- | --- | --- |
| OS repo identity | Older local prototype looks like GigTracker; prompt requires `eventsible-os-admin` | `C:\Users\itsTr\Documents\Codex\2026-06-10\codex-prompt-eventsible-gig-tracker-crm\package.json`; OS `package.json` | June folder package is `eventsible-gig-tracker` and not Git; cloned OS package is `eventsible-os-admin` with remote `EVENTSible/eventsible-os` | Use cloned `C:\Users\itsTr\Documents\Codex\2026-07-29\eventsible-os` as canonical OS | High | None |
| Builder production checkpoint | Older docs could treat Lovable/prototype as current | Event Builder README, STATUS, Vercel metadata | Vercel project latest production is `dpl_7C2n8eBUoWuDDM6N7kjwcd8cog84` on `ab128cef`; `build.eventsible.info` returns 200 | GitHub/Codex/Vercel now own current Builder development/deployment; Lovable is historical source | High | None |
| OS production route | Vercel project shows READY production; public `eventsible-os.vercel.app` returned 404 | OS Vercel metadata; route fetch | Project `eventsible-os` latest deployment READY on `b313477`, but root domain route returned 404 | Mark OS deployment READY but public route NEEDS VERIFICATION; do not claim `eventsible.biz` is live | Medium | Verify intended production alias and root route |
| ECC phase status | Older master plan says Phase 24 live/next phases pending; current code/docs include phases through 36 and Booth Console | ECC master plans, `docs/ECC_VINCE_STATUS.md`, `supabase/phase*.sql`, Vercel metadata | Current source includes migrations through Phase 36 and status docs mark Phase 32.2 production stable, Phase 33/36 local or pending QA | Treat older master plan as historical/partially current for rules; current phase table lives in app-specific docs | High | Hydrated browser QA can update manual status |
| Player View structure | Old handoff notes mention Player View as a route/control area; newer locked rule says only Main/Tools/Info | ECC docs and Player route source | Current prompt and ECC master plan lock Main/Tools/Info | Player top-level tabs remain exactly Main, Tools, Info | High | None |
| Client portal domain | Older OS docs mention `portal.eventsible.biz`; current request locks `client.eventsible.biz` | OS SETUP and domain docs | Current cleanup request and domain lane list specify `client.eventsible.biz` | Use `client.eventsible.biz` as planned canonical domain; mark `portal.eventsible.biz` transitional/historical | High | Confirm DNS/Auth redirects before launch |
| `eventsible574.com` role | Older plans route new apps through legacy domain | OS domain docs and current request | Current request says legacy/local trust bridge only | Do not use `eventsible574.com` as new app architecture home | High | Current legacy site content not audited |
| `eventsible.com` role | Some external assumptions may treat it as active | Prompt and no verified evidence | No ownership/use verification performed | Do not document `eventsible.com` as active | High | Manual domain ownership/use confirmation |

