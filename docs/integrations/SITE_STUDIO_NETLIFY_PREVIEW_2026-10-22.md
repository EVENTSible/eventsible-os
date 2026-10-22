# Site Studio: Netlify Free Preview integration

Status: IMPLEMENTED, Preview-only. Both release PRs remain drafts. Production and DNS changes require separate approval.

Netlify Free hosted rehearsal passed using synthetic content, an isolated local Supabase backend exposed through a restricted temporary gateway, and three disposable projects. Owner save/publish/restore, Staff denial, public Power/Classic reads and Builder submission were verified. Frozen media-free baseline artifacts were replayed in new drafts and database fingerprints stayed unchanged. This is a draft package replay, not a Production atomic rollback rehearsal.

The repository now carries `netlify.toml`, pins `@netlify/plugin-nextjs` 5.16.4, and excludes generated `.netlify` artifacts from source lint. Node is pinned to 24.14.1. Preserve Next middleware and Owner authorization. Windows adapter bundling is not supported by the rehearsal harness; build and bundle the HQ adapter in Linux.

The public repository selects its existing Nitro integration's Netlify preset only when `NETLIFY=true`. It accepts an exact configured synthetic HQ origin using `VITE_EVENTSIBLE_SITE_STUDIO_QA_ORIGIN`; live public-domain rules remain independent. The current accepted QA pattern is restricted to the disposable `eventsible-qa-hq-*` projects, not general Netlify domains.

## Safe Preview procedure

1. Verify both PR heads, remotes, package identities, ancestry and clean tracked worktrees. Preserve unrelated untracked logs and original development checkouts.
2. Run full tests, lint, types, builds and strict full dependency audits. Registry unavailability must fail after bounded retries. Do not waive findings or use `npm audit fix`.
3. Build from isolated source copies at those heads. Apply the disclosed synthetic-media overlay only to these copies; preserve original assets. Verify static and function upload contents contain no real raster/audio/video and no server credential values.
4. Use only the existing three disposable Netlify QA projects. Verify Free/no overages, `deploy-preview`, no published deployment and no domain aliases before each upload. Send disposable service-role credentials only as functions-scoped secret variables, never Vite variables or build inputs. Disable email sending.
5. Temporarily enable the approved public QA access. Test Owner draft, publish, restore; Staff denial; both public view modes; Builder intake, idempotency and no booking conversion; desktop/mobile routes and console/runtime errors.
6. Replay frozen rollback packages into new drafts; compare data fingerprints. Restore project privacy, stop the disposable tunnel/backend and revoke the temporary deployment grant.

Automatic Vercel builds on the two named release branches are skipped by a branch-and-Preview-specific `ignoreCommand`, preventing a PR push from publishing source media. Other branches and Production retain normal build behavior. Do not manually deploy an unsanitized source copy. No Netlify Git connection or live publication is authorized.

## Remaining approval gates

- Merge both exact reviewed heads, and separately approve any Production deployment.
- Approve the Production Site Studio schema proposal after backup, grants/RLS review and migration-ledger preflight. No Production schema or data has been changed.
- Approve Production host choice, Free credit-limit/pause behavior, target projects and server-only environment transfer. Synthetic QA packages contain disposable endpoints and must never be promoted.
- Fresh-build Production-configured candidate and rollback artifacts, then approve the live publish/rollback rehearsal and canary. Existing Vercel Production deployments remain rollback references.
- Separately approve DNS/domain changes and publication of reviewed real media with rights/consent. Neither is authorized by Preview testing.

Earlier release-readiness documents are historical checkpoints: their original audit/type/lint and hosted-verification blockers were subsequently resolved in the feature branches and isolated rehearsal. Use current exact-head CI and the latest exported evidence, not those old counts, to decide readiness.

Provider references: [Next adapter pinning](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Vercel skipped builds](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel).
