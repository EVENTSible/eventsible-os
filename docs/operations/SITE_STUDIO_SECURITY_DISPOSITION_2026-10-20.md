# Site Studio security and release disposition (2026-10-20)

Status: **PREVIEW-ONLY / NEEDS VERIFICATION / NOT PRODUCTION READY**

## Repository + advisory-specific changes

OS `EVENTSible/eventsible-os`, Production branch `main`, review branch `codex/site-studio-owner-draft-preview-20261020`.

- `next` and `eslint-config-next` pinned to 16.4.2 in `package.json` and lockfile to address affected Next 16.3.x advisories including critical `GHSA-vcvr-r3jv-pc5j`. This changes minor versions, so full Next app/route/browser regression tests are required.
- `sharp` resolves 0.35.5, patched for `GHSA-wq5f-xc86-pv6w`.
- `source-map-js` resolves 1.2.2, patched for `GHSA-68fv-2mgg-jv7q`.
- `brace-expansion` resolves patched 1.1.21.

## Unfixed upstream advisory

`braces@3.0.3` is reached by `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. GitHub advisory `GHSA-vfj7-8cjw-p6xm` currently lists **no patched release** as of 2026-10-20. It is a **development-tooling dependency** in this application; risk boundaries need verification before any policy exception. Do **not** force a breaking downgrade, substitute unrelated packages, run `npm audit fix`, or suppress the existing full audit.

Reference: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

**Release gate:** The standard `npm audit --audit-level=high` must still be performed and its result reported. If that sole dependency remains, seek an upstream fix or separate explicit owner approval for a narrowly scoped, expiring, development-only exception with mitigation and residual risk documented. No general waiver is preapproved.

## Preview and Production safety

The Site Studio schema remains in `supabase/proposals/`; it was validated in disposable local Supabase only. Do not apply Production migrations, modify Production data, merge, change DNS/domains, or publish real media without explicit action-time approval.

Regression evidence required: tests, lint, type check, Next build, authenticated Owner and Staff browser QA, media privacy/approval tests, image and asset URL allowlisting, no secret exposure, rollback and Production readiness report.
