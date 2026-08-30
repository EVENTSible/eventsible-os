# EVENTSible Supabase Ecosystem Inventory — 2026-08-30

- Status: PARTIAL
- Scope: read-only repository, Build Hub, Vercel, Supabase, and current-task inventory
- Canonical owner: EVENTSible documentation hub
- No credentials, database writes, environment changes, Production deployments, or non-OS repository edits were made.

## Hosted Supabase projects discovered

| Owning system / dependents | Repository | Deployment / environment | Supabase project | Plan and health | Current keep-alive / monitoring | Pause prevention needed | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EVENTSible OS; Wedding Hero; future OS-owned Client Portal and Content Factory data | `EVENTSible/eventsible-os` | OS and Wedding Hero Production verified at `eventsible.biz`; Preview branch work separate | `cplpbzudjprzbnzocirc` (`EVENTSible OS`) | Free; `ACTIVE_HEALTHY` on 2026-08-30; database time plus limited counts from `os_events`, `os_bookings`, `os_contacts`, and `os_event_dashboard_v` passed | Existing ChatGPT Production smoke test performs genuine read-only checks roughly twice weekly; no deployed app-native cron in current `main` | Yes. Daily secure route is implemented on the focused branch but remains NOT ACTIVE pending secret, merge, Production deploy, and scheduled-run proof | `PROTECTION REQUIRED` |
| ECC/VINCE; Booth Console when connected to cloud room state | `EVENTSible/ecc-vince` | Production verified at `eventsible.app`; Booth Console remains local/offline-first | `evhhhpitdjsqjufuvgcf` (`EVENTSgame`) | Free; `ACTIVE_HEALTHY` on 2026-08-30; database time and limited counts from `rooms`, `players`, and `karaoke_queue` passed | `vercel.json` schedules public `/api/health` daily at `0 14 * * *`; it makes one read and can return raw backend errors. ChatGPT smoke oversight also checks it | Yes. Existing cron is partial and does not meet the secure multi-read standard | `PROTECTION REQUIRED` |
| Public Website and Event Builder | `EVENTSible/eventsible` | Production verified at `eventsible.info` and `build.eventsible.info` | `dmozbjubduklfnaqnnjg` derived from owning repo configuration; Builder submission also targets the OS-owned project separately | Plan and health inaccessible; Supabase connector returned permission denied | No cron in current `vercel.json`; no independent monitoring found | Unknown until owner, plan, active use, and health are verified | `NEEDS VERIFICATION` |
| `MrKnowItAll` (no EVENTSible application/repository mapping discovered) | Unknown | Unknown / currently inactive | `dotystxpbfehsqexasxk` | Shared EVENTSible organization is Free; project status `INACTIVE` | None discovered | No activation without explicit approval; determine whether this is dormant, historical, or unrelated | `NEEDS VERIFICATION` |

The connected Supabase organization listed only `cplpbzudjprzbnzocirc`, `evhhhpitdjsqjufuvgcf`, and `dotystxpbfehsqexasxk`. The public/Builder project reference was discoverable in its owning repository but is not accessible through the connected Supabase account, so its plan and health cannot be asserted.

## Application and repository coverage

| Application or record | Repository / source status | Supabase ownership finding | Monitoring / keep-alive finding | Classification |
| --- | --- | --- | --- | --- |
| EVENTSible OS | Canonical active repository | Owns `cplpbzudjprzbnzocirc` | Focused daily Vercel Cron implementation pending activation | `PROTECTION REQUIRED` |
| Wedding Hero | Production module in OS | Uses OS-owned project; no separate credentials or project | Inherits OS protection and OS monitoring | `PROTECTION REQUIRED` |
| Public Website | Current `EVENTSible/eventsible` source | Repo config identifies `dmozbjubduklfnaqnnjg`; ownership/plan inaccessible | No cron discovered | `NEEDS VERIFICATION` |
| Event Builder | Same repository, separate Vercel project/mode | Same inaccessible configured project; OS intake separately calls the OS-owned Edge Function | No cron discovered | `NEEDS VERIFICATION` |
| ECC/VINCE | Canonical active repository | Owns `evhhhpitdjsqjufuvgcf` | Existing public one-read cron is inadequate | `PROTECTION REQUIRED` |
| Booth Console | Module of ECC/VINCE; local static pilot | No separate project; cloud features inherit ECC ownership | Local pilot requires no independent keep-alive | `LOCAL ONLY` |
| Client Portal | Planned OS lane; legacy `eventsible-client` Vercel project/source ownership not reconciled | No separate current project verified; planned records belong in OS | None verified | `NEEDS VERIFICATION` |
| Content Factory | Planned OS module | No separate project; future data belongs in OS | Not applicable until implemented | `NEEDS VERIFICATION` |
| Custom Creations | Planned; repository/source not verified | No project discovered | None | `NEEDS VERIFICATION` |
| Wedding Companion source review | Prior OneDrive location exposes no valid current source | Project ID unknown; do not infer it from Wedding Hero | None verified | `NEEDS VERIFICATION` |
| Pinata Party | Standalone local pilot, no remote | Explicitly no Supabase dependency | Local-only | `LOCAL ONLY` |
| EVENTSible Gig Tracker CRM v1 review | Non-Git localStorage/JSON prototype superseded by OS ownership | No hosted project | Local-only | `DUPLICATE OR HISTORICAL` |
| EVENTSible Build Hub | Canonical local build infrastructure | No hosted project | Local scheduled backup is unrelated to Supabase | `LOCAL ONLY` |
| OS alternate checkout and merged documentation worktree | Same OS repository lineage | Same OS project; never an independent project | Inherit canonical OS mechanism | `DUPLICATE OR HISTORICAL` |
| ECC documentation worktree | Same ECC repository lineage | Same ECC project; never an independent project | Inherit canonical ECC mechanism | `DUPLICATE OR HISTORICAL` |
| Pinata precursor and screenshot/session artifacts | Preserved superseded/non-project artifacts | No hosted project discovered | None | `DUPLICATE OR HISTORICAL` |
| `eventsible-admin` / `eventsible-client` legacy Vercel projects | Vercel projects exist, but current canonical source and Supabase ownership are unverified | Unknown | Unknown | `DUPLICATE OR HISTORICAL` |

## Environment-variable names observed

Values were not recorded.

- OS server/notification path: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EVENTSIBLE_LEAD_NOTIFICATION_TO`, `EVENTSIBLE_LEAD_NOTIFICATION_RECIPIENT`, `EVENTSIBLE_LEAD_NOTIFICATION_FROM`, and the missing `CRON_SECRET`.
- ECC/VINCE: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, plus Host-role server secrets unrelated to keep-alive.
- Public/Builder: `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and their `VITE_` client equivalents.

No variable value was moved between applications. A project-specific implementation must use only the credentials already owned by its repository and deployment.

## Follow-ups

1. Activate the OS implementation only after approval for `CRON_SECRET`, merge, and Production deployment; then verify the first scheduled Production run.
2. Use a separate ECC/VINCE branch and approval process to replace the public one-read cron with a secure, multi-read dedicated route.
3. Verify ownership, plan, active data use, health, and deployment mapping for `dmozbjubduklfnaqnnjg` before deciding whether protection is required.
4. Identify `dotystxpbfehsqexasxk` before any resume or keep-alive action.
5. Reconcile or retire legacy Vercel project records separately; do not keep them active solely because they exist.
