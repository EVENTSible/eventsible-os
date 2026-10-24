# Site Studio release readiness — 2026-10-22

## Preview-only continuation — source blockers repaired

This section supersedes the security, raw-lint and TypeScript blockers listed below. User explicitly approved Preview-only deployment; both PRs remain drafts and Production remains excluded.

- HQ full AND production-only dependency audits now PASS with zero vulnerabilities. A scoped, pinned root-glob adapter removes the vulnerable dev dependency chain without changing Next lint rules or thresholds. Compatibility tests verify root discovery and actual rule enforcement; clean npm ci succeeds. See `tools/next-lint-glob/README.md` for the deliberately narrow API and upgrade limitation. No waiver or suppression.
- Repaired the missing parenthesis in the inherited legacy CSV header mapper; raw HQ lint now PASS with ten warnings. Removed its old lint:ci parse-error exception. Added parser regression tests.
- Website's 13 TypeScript errors repaired through runtime narrowing, nullable-record checks, unknown error handling and absent-loader metadata handling. Three focused auth tests prove missing/invalid token denial and forwarding of server-verified claims only. TypeScript and full lint are now blocking in Preview CI.
- Targeted security patches remove the website's remaining moderate/low advisories. Full AND production-only audits now PASS with zero vulnerabilities. No application framework/major-version upgrade or audit fix used.
- Local checks: HQ 265 tests; website 96 tests; both raw lint, TypeScript and builds PASS (ten warnings per repo). The final head pair still requires fresh isolated CI, Preview browser/console checks and a new exact-current public-site Preview.
- Remaining scope gates: hosted authenticated Owner editing/publishing against an isolated backend, Builder submission persistence, commercial hosting plan confirmation; separate schema/data, merge, Production, media, DNS and billing approval. This approval authorizes Preview deployment only.

Status: PARTIAL / NO GO for Production. Supersedes audit and hosted-browser assumptions in the October 21 assessment.

## Verified source and isolation

Canonical docs reviewed: `docs/README.md`, `docs/ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md`, prior release assessment and repository AGENTS.md. OS owns content/media metadata; the website is a published-content consumer and Builder remains a separate build of the website repository.

Fresh isolated clones under this task's `work/os` and `work/public` preserve existing local checkouts. Source heads before this change: OS `ed6e2f04c7288ef28bbac1d5d54486335e67e7b9`, website `c044efb3857ce94690bb6c43d0dc0463efa0ded9`. Packages/remotes match `eventsible-os-admin` / `EVENTSible/eventsible-os` and `eventsible-event-builder` / `EVENTSible/eventsible`. Both main bases are ancestors; OS historical baseline `ab4389723a3c55b4dca0c82f84fe94764930595d` is an ancestor. Main remains OS `c9aed02eeb96c71f84dd336400cfbfc50d0496b4`, website `26a49f80bd47b68920d9c78cd4345545bafc2d9e`.

## Security findings and changes

- npm endpoint responded on this date. Full HQ audit FAIL: five high findings in `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces@3.0.3`. Production-only audit PASS: zero vulnerabilities. `npm explain` confirms the chain is dev-only, but that does not waive it.
- GitHub reviewed advisory https://github.com/advisories/GHSA-vfj7-8cjw-p6xm still lists no patched version; npm latest braces is 3.0.3. npm's offered downgrade of eslint-config-next to 14.2.35 is not an appropriate compatible patch for Next 16.4.2. No downgrade, fork, waiver, audit fix or broad upgrade performed.
- Exact HQ CI run https://github.com/EVENTSible/eventsible-os/actions/runs/39804181893 at `ed6e2f0` passes isolated Site Studio schema/RLS, Owner browser, build and production-only audit; full audit fails on braces, not HTTP 503. Earlier repeated 503 responses were service-unavailability evidence and could never count as clean audits; their historical root cause is not proven.
- New audit runner distinguishes actual findings from unavailable/malformed results. Only transient transport/service failures get up to three attempts; exhaustion always fails. Full high/critical threshold is preserved, and full scope still runs if production-only audit fails.
- Five runner tests PASS: recovery, repeated outage, immediate vulnerability failure, malformed response rejection, scope preservation. Workflow runs these tests.
- Website's old security job ignored audit exit status and could falsely pass an unavailable service. PR #5 now audits the reviewed npm lockfile including dev dependencies and fails closed. Narrow compatible updates patch brace-expansion 1.1.16 -> 1.1.21 and 5.0.8 -> 5.0.12, launch-editor 2.14.1 -> 2.14.2, shell-quote 1.10.0 -> 1.12.0. Website full audit now has zero high/critical; eight moderate and one low remain visible.

## Local and hosted checks

- Local OS: 261 contract tests PASS, TypeScript PASS, build PASS. Raw lint FAIL on inherited `public/gigtracker-v1.js:45`; existing lint:ci wrapper PASS with its documented exception. Changed audit scripts pass focused lint and five tests.
- Local website: 93 tests PASS; lint PASS with ten warnings; public-mode build PASS. Fixed Power navigation union narrowing without changing destinations. Full TypeScript still FAILS on 13 errors in auth-middleware, admin functions, root error component and services route; not suppressed.
- Vercel connector returned not-found despite valid scope; read-only CLI fallback verified all three Preview deployment source SHAs and project IDs.
- Website Preview `dpl_5i73QMaEJK9VfxFNSiTi7eM74DTC`, Builder `dpl_DWoLcgvE2KgyFSaFK3iN8C3u1YVU`: READY at website source `c044efb`. HQ `dpl_44q8fvPSc5r7PwtCy4z1qXvHghZn`: READY at `ed6e2f0`.
- Browser checks PASS at 1440x1000 and 390x844: six website routes, Classic homepage, four actual media images, Builder choose/basics/template routes, HQ unauthenticated editor redirects to sign-in. No page errors, console errors, broken images or horizontal overflow in the isolated run. Builder and VINCE hrefs remain source-owned. Short-lived OIDC header only went to each exact Preview origin. Fonts, Instagram and Vercel overlay were stubbed; third-party services are NOT verified. No submission, sign-in, publish or Production API call was made.
- Local website browser: same 14 route/mode checks PASS with external resources stubbed. Loopback placeholder settings prevent live database use. HQ authenticated editor components passed the exact-head disposable CI; the older two-app integration pins a different HQ commit. These hosted read-only checks do not verify authenticated cross-app editing.
- Docker engine initially unavailable; once started, it restored an existing `eventsible-os-local-ci` stack. Existing containers were left untouched; no local reset, migration or fixture write was run. A new on-device database rehearsal remains NEEDS VERIFICATION.

## Remaining gates

1. HQ strict full audit remains FAIL until a reviewed compatible remediation exists. No security exception has been requested or granted.
2. Resolve or explicitly assess the remaining website TypeScript errors and inherited HQ raw lint error; do not treat diagnostic CI steps as clean checks.
3. After these focused commits, inspect exact new CI and Preview heads again. This document's hosted browser evidence is tied to the source SHAs above, never automatically transferred to newer commits.
4. Hosted authenticated Owner save/publish/restore -> website content, CORS and credentials require an isolated approved backend; no Production database is authorized for rehearsal. Builder submission/quote persistence has not been re-exercised.
5. Separate action-time Owner approval required for schema/RPC/RLS application or data changes, each merge, each Production release, public media publication, and any DNS/hosting/billing change. Current commercial hosting plan compliance remains NEEDS VERIFICATION; no paid upgrade authorized.

Rollback: retain previous Production deployment IDs and prior published revision. Revert focused source commits before release if needed. Any Production rollback/alias or content publication requires separate approval. Never drop Site Studio tables, discard customer records, move Drive originals, or alter existing developer worktrees.
