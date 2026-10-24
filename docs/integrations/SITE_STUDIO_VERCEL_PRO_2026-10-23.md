# Site Studio: selected Vercel Pro release target

Status: PARTIAL, Preview only. Production authorization is NOT GRANTED.

This checkpoint supersedes the selected Cloudflare Free/Netlify hosting target, not their historical security and functional evidence. No architecture migration is required. Historical 10 ms Cloudflare CPU measurements are not Vercel acceptance criteria.

## Verified ownership and cancellations

Authenticated CLI, explicitly scoped to team `team_n1QSM4NPq03IdnxCbwD0r7Kr` (`firstfamdjs-5913s-projects`), confirms active Pro and these existing projects:

| Lane | Existing project | Project ID | Production domain |
|---|---|---|---|
| HQ | eventsible-os | prj_1J9OmkeiAhiL9muVjnb6ytqDmY6l | eventsible.biz |
| Public | eventsible-info | prj_mtQVoR7bGzArpZh5rXwhYVSPjjPu | eventsible.info |
| Builder | eventsible-event-builder | prj_8iqwclYB9ww9Km3wG0kpgGXOzjlw | build.eventsible.info |

The connector lists zero projects and returns 404 for an existing project; the same-team CLI verifies ownership. This is a connector visibility mismatch, not missing projects. Public has no Git link; HQ and Builder link to their canonical repositories and `main`.

Current HQ and Builder Git Previews are CANCELED because `scripts/skip-isolated-preview.cjs` deliberately exits zero for the isolated PR branches. Provider records confirm ignored builds. The guard remains: raw Git builds must not upload business media or use inherited live Preview backend defaults. Deploy prepared media-free source to the existing projects, explicitly target Preview, and override all backend settings with disposable values at deployment scope. Do not modify shared Production or Preview settings.

## Release gates and ordered proposal

1. Verify exact PR heads, clean tracked inputs, full CI, strict audits, prepared manifest source identity and media exclusion. Validate Vercel runtime output, desktop/mobile Auth, Owner edit/preview/publish/freshness/restore, denied roles, Builder replay, static fallback and dependency recovery. Historical tests do not satisfy this gate.
2. Obtain evidence of an accessible, recoverable Production database backup with timestamp and recovery point. Rehearse restoration using synthetic data only. Deployment rollback, content restoration and database recovery are independent operations.
3. Separately approve the reviewed `supabase/proposals/20261020_site_studio_v1.sql` (hash and exact contents at approved head). Read-only Production checks show PostgreSQL 17.6, migration ledger through `20260917210520`, and neither Site Studio table present. The proposal has NOT been applied to Production.
4. Separately approve HQ merge, HQ Production environment changes, and a prepared media-free Production build/deployment. Never promote a synthetic-backend QA deployment to Production. Confirm existing Owner Auth and private `no-store` behavior; retain the previous deployment.
5. Separately approve Public/Builder merge and deployment to both existing projects with their explicit lane modes. Public consumes only the allowlisted published projection; Builder remains canonical OS intake. Test public fallback before enabling publishing. No automatic replacement project or DNS change.
6. Separately approve real content/media publication if desired. Media-free deployment approval does not authorize it.

## Rollback proposal

- HQ baseline: `dpl_GBWt9twCj87MmMQh4JAqzdygvYXY`, source `c9aed02eeb96c71f84dd336400cfbfc50d0496b4`.
- Public baseline: `dpl_6hrXt2ouaYp3iaDy6m5oVdS9FUQb`, source `26a49f80bd47b68920d9c78cd4345545bafc2d9e`.
- Builder baseline: `dpl_GdQPEB2geX2h7ur2Muvpdfy87Q7Q`, same source as Public.
- Failed app deployment: separately authorize rollback to the retained exact deployment per lane. Do not drop additive Site Studio tables during an app rollback. Old applications do not depend on them; verify this compatibility in isolation.
- Bad publish: Owner restores the exact previous revision through the audited Site Studio action; this does not change app deployment or restore the database.
- Reader/API outage: reviewed static public fallback. Private editor responses stay uncached and authorization stays live.
- Database loss: owner-approved backup recovery, after recoverability verification; do not use a content revision or deployment rollback as a database backup.

Evidence for this run is retained outside source under `deliverables/site-studio-vercel-pro-2026-10-23/` in the task workspace. The final report must state exact tested deployments, measurements and unresolved gates. Both PRs remain drafts. Production, DNS, billing, real data and real media remain untouched.
