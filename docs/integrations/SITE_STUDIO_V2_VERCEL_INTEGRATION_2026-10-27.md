# Owner-approved V2 integration — October 27, 2026

Owner-approved UX is frozen. Integrate HQ commits `0115533`, `1d68b40`, `01edd6b` into existing draft PR #50, and consumer commits `d2277ca`, `7fba665`, `a7c69fd` into existing draft PR #5. These retain contextual controls, revision integrity, intentional publishing, unsaved warnings and the tested scrolling layout. Do not reset the Home PC database, owner drafts or publication.

## Existing Vercel Preview scope

Use only the existing Pro team `team_n1QSM4NPq03IdnxCbwD0r7Kr` and its HQ, Public and Builder projects. Prepare media-free source with the checked-in release preparation script. Keep the existing raw-Git Preview skip guard: it prevents the PR push from deploying original binary media or inherited business-backend bindings. A reviewed prepared manual Preview may override that skip command in its deployment input only. Never change Production aliases or project settings.

Hosted HQ navigation previously always opened the live public website. The navigation-only correction accepts server variable `EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL` only when `VERCEL_ENV=preview`, with an HTTPS `*.vercel.app` root URL and no credentials, custom port, query or fragment. Production ignores this override. This does not configure a draft renderer, transmit a draft, alter Auth or change the public projection.

The approved private visual bridge remains local only. HQ enables it only for the guarded Home PC public URL; the consumer also requires development mode, the local demo flag, exact loopback origin and a parent frame. Both sides validate the message source/origin and allowlisted payload. A hosted build therefore displays its explicit local-only limitation instead of pretending to render private drafts. Supporting hosted private rendering needs a separately reviewed origin configuration and protection/session design; do not enable development mode or remove these checks to make it appear to work.

Disposable hosted QA, when separately authorized and reachable, must use fresh synthetic credentials and a new isolated backend. Never reuse retired fixtures or expose the Owner's existing local drafts through a tunnel. Privileged keys belong in deployment-only server runtime configuration; no privileged build or client values. Keep Public/Builder Vercel protection unchanged, and use project-scoped authentication for automated Preview tests.

## Release remains blocked pending separate approvals

The October 25 backup/release-safety findings remain dated evidence, not proof of current recoverability. A real Production OS backup and a safe isolated recovery rehearsal have not been verified. A synthetic restore cannot close that gate. No subscription purchase is authorized.

Before release: (1) approve and verify a recoverable Production backup; (2) approve and establish a Git deployment stop for HQ/Builder while preserving current traffic; (3) approve exact Production environment/Auth settings; (4) package the additive Site Studio proposal with its exact byte checksum, object-absence preflight, atomic transaction and migration-ledger registration; (5) separately approve schema application; (6) separately approve PR #50 merge, staged HQ Production build and promotion; (7) verify Auth/authorization and safe public projection; (8) separately approve PR #5 merge, Public/Builder staged builds and promotions; (9) verify freshness, fallback, Builder and Wedding Hero; (10) separately approve any real-content/media publication and operator handoff. No old synthetic Preview may be promoted.

Stop on migration failure, Auth regression, unauthorized data exposure, publishing/freshness failure or public/Builder regression. Retain the verified current Production deployment IDs immediately before rollout. Application rollback selects the previous retained application deployments while preserving additive content data. Content revision restoration uses the existing revision workflow. Database recovery is an independently approved procedure from a proven backup; do not drop new tables as routine rollback.

Detailed exact-head checks, deployments, safe environment-presence inventory and remaining limitations belong in the task's `deliverables/site-studio-v2-integration-2026-10-27/` packet. No Production authorization is implied by Preview readiness.
