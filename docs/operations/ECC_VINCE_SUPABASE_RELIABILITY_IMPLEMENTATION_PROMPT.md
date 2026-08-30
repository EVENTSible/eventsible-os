# ECC/VINCE Supabase Reliability Implementation Prompt

Use this prompt in a separate ECC/VINCE implementation task. It is repository-specific and intentionally does not authorize any EVENTSible OS change.

## Goal

Implement the smallest secure, app-owned daily Supabase keep-alive for ECC/VINCE.

- Repository: `EVENTSible/ecc-vince`
- Canonical local checkout: `C:\Users\itsTr\Documents\Codex\2026-05-11\eventsible-interactive-event-platform-project-summary`
- Production branch: `master`
- Supabase project: `evhhhpitdjsqjufuvgcf` (`EVENTSgame`)
- Current classification: `PROTECTION REQUIRED`

Do not copy EVENTSible OS credentials, create a shared keep-alive service, alter locked Host/Player behavior, or modify another repository.

## Required audit before editing

1. Read every applicable `AGENTS.md` and the current ECC/VINCE status, deployment, Supabase, Booth Console, and locked-behavior documentation.
2. Confirm the checkout root, remote, branch, local HEAD, remote `master` HEAD, Vercel linkage, worktree status, and current Production evidence. Fetch without resetting, stashing, or overwriting unrelated work.
3. Confirm `evhhhpitdjsqjufuvgcf` is healthy and perform only safe, sanitized read-only checks. Stop before editing if it is not healthy.
4. Inspect environment-variable names and scopes without displaying values. Confirm whether `CRON_SECRET` exists; do not add or change it without Travis's explicit approval.
5. Inspect the existing `vercel.json`, `/api/health`, server-side Supabase access pattern, tests, and notification helpers. Preserve all rewrites and unrelated configuration.

Current inspection found one daily Vercel cron targeting public `/api/health` at `0 14 * * *`. That is partial protection, not the EVENTSible standard: it is not a dedicated authenticated endpoint and performs only one database request. Revalidate this evidence before relying on it.

## Smallest implementation

1. Create a focused branch from the current remote Production head.
2. Add a dedicated server-only `GET /api/cron/supabase-keepalive` function using ECC/VINCE's compatible Vercel API-route pattern.
3. Require an exact `Authorization: Bearer <CRON_SECRET>` header. Return `401` for missing or invalid authorization and fail closed when `CRON_SECRET` is absent.
4. Use only ECC/VINCE-owned Supabase environment variables and the existing approved server-side client pattern. Do not introduce or expose an OS credential. Prefer the least-privileged current server credential that can perform the required reads; introduce a service-role credential only if the audited architecture requires it and Travis separately approves the environment change.
5. Make multiple lightweight, genuine read-only requests on each authorized invocation—for example safe counts or minimal-column reads against established `rooms`, `players`, and `karaoke_queue` resources. Do not return rows, names, room codes, song requests, customer data, raw backend errors, or environment details.
6. Perform no inserts, updates, deletes, mutating RPCs, schema changes, migrations, RLS changes, or `SECURITY DEFINER` functions.
7. Return only sanitized operational fields such as `ok`, timestamp, checks attempted, checks passed, and duration. Use `no-store` behavior and a non-200 response for failed database activity.
8. Log only a concise sanitized failure. Reuse an existing safe owner-notification helper if one exists; otherwise retain Vercel runtime logs as the documented immediate fallback and record notification work as a follow-up. The alert path must not depend on writing to Supabase.
9. Replace the existing `/api/health` cron target with the secured keep-alive route while preserving the current daily schedule unless the current Vercel plan or a verified conflict requires another daily UTC time. Do not add a duplicate job. Keep `/api/health` available for its existing health-check purpose.
10. Document the UTC schedule and Indiana-local equivalent, variable names without values, manual verification, logs, rollback, Free-plan limitation, and Production activation evidence.

## Verification

Add focused tests proving missing and invalid authorization return `401`; correct authorization reaches read-only checks; success and failure responses are sanitized; no write methods are called; `vercel.json` remains valid with its existing rewrites and one compatible daily cron; and locked Host, Player, room-sync, Ask the DJ, karaoke, and Booth Console behavior remains unaffected.

Run all relevant ECC/VINCE tests, type checks, lint checks if configured, Production build, Booth Console verification scripts, and `npm audit` without `npm audit fix`. Inspect the final diff for secrets, raw errors, customer data, writes, schema/RLS/Auth/domain changes, duplicate cron entries, and unrelated edits.

## Release gates

- Deploy to Preview only after local verification and only when existing Preview configuration permits it.
- Preview may verify endpoint behavior but cannot prove Vercel's Production scheduler.
- Obtain Travis's explicit approval before adding or changing `CRON_SECRET`, merging to `master`, deploying to Production, or changing Supabase/Vercel/DNS/Auth configuration.
- Use a separate focused commit, Preview review, approval, merge, and Production deployment.
- Keep status `IMPLEMENTED / NOT ACTIVE` until a scheduled Production invocation is verified in Vercel logs with corresponding genuine ECC/VINCE Supabase activity.
- Record the activation and last successful scheduled execution in `EVENTSIBLE_SUPABASE_RELIABILITY_STANDARD` inventory fields.
