# Site Studio — Free-plan two-app local rehearsal

**Status:** IMPLEMENTED IN DRAFT CODE / MANUAL LOCAL CROSS-APP REHEARSAL NEEDS VERIFICATION

This workflow uses **no hosted Supabase branch** and no Production credentials. Supabase branching was rejected on the Free plan after the user approved the quoted hourly branch cost; no paid branch was created. The objective is to prove the real published-content path across the HQ application and the public website on the operator's computer. Do not modify the existing EVENTSgame, EVENTSible OS Production Supabase, Vercel Production, DNS, or original Drive media.

## Prerequisites / exact repository checks

Use the verified actual worktrees, **not** generic folders or replacement app roots.

- OS repository `EVENTSible/eventsible-os`, review branch `codex/site-studio-owner-draft-preview-20261020`, package `eventsible-os-admin`.
- Public site repository `EVENTSible/eventsible`, review branch `codex/public-site-published-content-20261020`, package `eventsible-event-builder`, with **public** site mode.
- Inspect `AGENTS.md`, `package.json`, Git remotes, local/remote HEAD, baseline ancestry, dirty/unrelated changes, existing worktrees and the exact Vercel project link. Do not discard dirty work or modify Production branch.
- Install package dependencies from reviewed lockfiles. Never use `npm audit fix` or broad upgrades.
- Docker/Supabase CLI/PostgreSQL `psql` and Playwright browser dependencies must already be installed or installed in a reviewable local-only environment.

## Local-only run procedure

1. Start the existing disposable **local** Supabase stack for OS; inspect its local URL and use **only** loopback credentials in a local untracked environment file. Never print/store key values in Git commits or artifacts. Do **not** point this process to `cplpbzudjprzbnzocirc` or any remote URL.
2. Confirm isolated database and run the existing `node scripts/site-studio-local-supabase-verify.mjs` against local `SUPABASE_LOCAL_DB_URL`. It applies the proposal to disposable local Postgres and uses synthetic Owner/Staff/Media and published-copy records. **Do not** run it against an existing business database.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` using **local disposable** values, then start HQ on `http://127.0.0.1:3100`. Service-role remains server-only. The `/api/public-site/home` reader should return only a published revision and approved media public URLs.
4. In the separate public website worktree, set **local untracked development-only** values:
   `VITE_EVENTSIBLE_SITE_MODE=public`
   `VITE_EVENTSIBLE_SITE_CONTENT_URL=http://127.0.0.1:3100/api/public-site/home`
   Start Vite dev with `npm run dev -- --host 127.0.0.1 --port 5173`. This explicit HTTP loopback path is accepted only with Vite `DEV` mode; Production and Vercel Preview builds do not accept it.
5. From the HQ worktree run `npm run test:site-studio:two-app-local`. This script refuses any non-loopback or unexpected port. It tests Power Mode welcome + panel copy, Classic headline, four actual website photos, media rendering, and offline static fallback. It is a **read-only** consumer of the local published HQ revision.
6. Also run the existing full HQ `npm run test`, `npm run lint:ci`, `npm run build`, database migration/RLS/Owner/browser tests, `npm audit --audit-level=high`; and the public `npm run test`, focused lint, typecheck, build, `npm audit`, and secret scan. Report any inherited failures without suppressing the evidence.
7. Review smartphone viewport, desktop, browser console, page images, public projection and source-controlled Builder links. Confirm lost/aborted HQ response produces static content, and public files contain no private Drive originals or IDs.

## Important caveats

- The `test:site-studio:two-app-local` script is an **optional integration command**. It is syntax-checked in normal GitHub CI, but the two-app browser execution requires both checked-out repositories and a running disposable local Supabase stack, so do **not** represent the command as having passed merely because GitHub CI is green.
- Existing OS GitHub Actions already exercise disposable local database, RLS, Owner draft/publish/rollback, Staff denial, and local API. Public GitHub Actions separately exercise the safe published-content parser, locked routes, photo integrity, tests and security. These are evidence of components, **not** a hosted end-to-end release.
- Vercel refused environment-variable metadata access (403); never copy or guess any Production environment secrets. No Supabase Pro upgrade is needed for the local rehearsal.
- The strict HQ `npm audit` currently reports a high-severity advisory in the `braces` development/lint-toolchain dependency (no upstream patched version). Maintain that release blocker; no silent waiver.
- Manual page edit, Preview publishing, final media release, schema migration and any Production changes remain behind **separate explicit approval**.
