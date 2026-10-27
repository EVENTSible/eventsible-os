# EVENTSible Site Studio v1: owner draft, review and published homepage

Status: IMPLEMENTED IN ISOLATED SOURCE BRANCH / NOT DEPLOYED / SCHEMA PROPOSAL NOT APPLIED

Current Preview field coverage and Owner feedback corrections: [Classic/Power field destinations, October 27](SITE_STUDIO_FIELD_MAPPING_2026-10-27.md). The Power editing limitations below describe the original October 20 slice; the linked matrix reconciles the later bounded welcome/subtitle controls without making the entire cover editable.

## Ownership and content path

1. Google Drive keeps original media; Drive sharing URLs are not public website image URLs.
2. EVENTSible OS owns content revisions and approved media metadata. The new tables are only a schema proposal.
3. Owner-only HQ Site Studio can save a private draft and deliberately publish a revision after the database contract is approved.
4. The server-owned public API returns only published, allowlisted homepage fields, never editorial data or private Drive paths.
5. eventsible.info reads this content when available and retains its checked-in homepage on any failure. The Builder is unaffected.

## Scope

Homepage headline, highlight, introduction, portfolio heading/description and one approved hero photo. This does not yet cover every section, the Power Mode cover, or live media browsing.

Approval is required for each marketing asset, especially identifiable guests and minors. A published image must be an optimized public rendition with verified usage and privacy permissions; the Drive original stays private.

## Release gates

- Verify correct folder, package.json, AGENTS.md, Git remote, branch, local/remote HEAD, historical baseline, clean worktrees, and Vercel linkage.
- Use isolated Preview and disposable local PostgreSQL to test migration, RLS, Owner-only permissions, publication/rollback, and revoked anonymous writes.
- Run focused and full tests, lint, type check, build, npm audit without audit fix, environment-name presence without values, and no-secret checks.
- Run mobile and desktop browser, accessibility, console, and runtime checks. Prove no extra Builder, OS business or VINCE data changed.
- Verify the published public API with an approved media rendition. Rollback uses an older revision and, if needed, the earlier application deployment.
- Never merge, promote, migrate, seed, publish media, change DNS or mutate Production records without separate explicit approval.

## Evidence and remaining gaps

Drive folders and asset catalog were read on 2026-10-20. The Approved Marketing folder had no direct files. The OS editor and public reader were coded on focused branches, not deployed. Drive ingestion, image optimization, review workflow, Power Mode editing, Production migration, integration tests and operator QA remain unverified.

These changes preserve original business data and do not create a second event/contact system.
