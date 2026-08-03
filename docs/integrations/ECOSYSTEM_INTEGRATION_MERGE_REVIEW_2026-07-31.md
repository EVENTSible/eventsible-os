# EVENTSible Ecosystem Integration Merge Review - 2026-07-31

- Status: PRODUCTION-SAFE MIGRATION CORRECTION PREPARED / NEEDS EXACT-HEAD CI
- Owner: EVENTSible OS
- Canonical source: EVENTSible OS repository
- Reviewed branch: `feat/ecosystem-integration-foundation`
- Reviewed OS head before first report: `93690822e408fe68811d5c5d312bc23f2125204a`
- Last implementation commit verified by CI: `c6c32de31bcc2a874a2c8c861707d04e16d47082`
- Last known exact-head CI before correction: `30673643610`, job `91296336053`, commit `045e6989195fc1f51a05ee7a10c0f127d5f0129b`

## Repository Baseline

| Repository | Branch | Expected/observed status |
| --- | --- | --- |
| EVENTSible OS | `feat/ecosystem-integration-foundation` | Remote feature branch had exact-head CI passing at `045e6989195fc1f51a05ee7a10c0f127d5f0129b` before the production-safe migration correction. Local checkout remained clean at implementation commit `c6c32de31bcc2a874a2c8c861707d04e16d47082` because local `git fetch` is blocked in the Codex worker. |
| Event Builder | `feat/ecosystem-integration-foundation` | Local branch clean at `7abadbefbeeeb2737d65953efa065d27c6b97feb`. |
| ECC/VINCE | `master` | Read-only and clean at `7c7c825aef6b3e51420c451dd8aae7db5285373c`. |

Canonical documentation hub reviewed: `docs/README.md`. EVENTSible OS remains the business system of record.

## Exact-Head CI Result Before Correction

| Field | Result |
| --- | --- |
| Workflow | `Ecosystem Integration Local Supabase` |
| Run ID | `30673643610` |
| Job ID | `91296336053` |
| Commit | `045e6989195fc1f51a05ee7a10c0f127d5f0129b` |
| Branch | `feat/ecosystem-integration-foundation` |
| Result | Success |

The job completed successfully across checkout, Node setup, dependency install, Docker confirmation, Supabase CLI confirmation, local-only guard, local Supabase start, local target confirmation, local migration reset, ecosystem verification, contract tests, lint wrapper, build, audit, and Supabase cleanup.

## Final Diff Review

OS feature branch versus `main` is scoped to shared contracts, integration outbox foundation, local Supabase configuration, CI workflow, verification scripts, tests, and canonical documentation. The branch is ahead of `main` and not behind it.

Event Builder feature branch versus `main` is scoped to shared contract mirror, intake compatibility logic, service mapping, tests, and app-specific documentation. The branch is ahead of `main` and not behind it.

No ECC/VINCE changes were made. No Production customer data or secret values were found in reviewed diffs. Builder still has a tracked `.env`, but inspected variable names were limited to project, URL, and publishable key names; no service-role, token, password, Host PIN, or private-key variable names were found.

## Local Pre-Merge Checks

OS local checks, run on the clean local feature checkout at `c6c32de31bcc2a874a2c8c861707d04e16d47082`:

- `npm install`: passed; audited 380 packages.
- `npm run test`: passed; 4/4 contract tests.
- `npm run lint:ci`: passed with only the documented inherited `public/gigtracker-v1.js` parse error and inherited warnings surfaced.
- `npm run build`: passed.
- `npm audit`: non-zero; current local result reported 3 high vulnerability entries inherited through Next.js/PostCSS/sharp.
- `npm run guard:local-supabase-ci`: passed; no Production ref or remote Supabase commands found in guarded CI command paths.

Event Builder local checks, run on `7abadbefbeeeb2737d65953efa065d27c6b97feb`:

- `npm install`: passed; audited 530 packages.
- `npm run test`: passed; 27/27 tests.
- `npm run lint`: passed with 10 inherited Fast Refresh warnings.
- `npm run build`: passed with the known large chunk warning.
- `npm audit`: non-zero; current local result reported 5 vulnerabilities: 1 low, 3 moderate, 1 high.

No dependency upgrades were applied.

## Migration Review Finding

Original migration reviewed: `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql`.

Original finding: do not apply the pre-correction migration to Production as-is.

Reasons:

- The file header identified it as a CI-local, synthetic-test-focused foundation.
- It created a full local verification schema for `os_contacts`, `os_events`, `os_builder_submissions`, `os_leads`, `os_quote_versions`, `os_quote_items`, `os_builder_activity`, and `os_integration_outbox`.
- It used `CREATE OR REPLACE FUNCTION public.os_ingest_builder_submission(payload jsonb)`, which would replace the live Builder intake function if applied to the Production project.
- It revoked and granted privileges on core CRM/intake tables and dropped/recreated service-role policies. These are not data-destructive, but they are Production access-control behavior changes.
- It had no `DROP TABLE`, `TRUNCATE`, or `DELETE FROM` data-destruction statements, but replacing the live intake function was too high-risk without a production-schema-specific migration.

## Production-Safe Migration Correction

Correction prepared after user approval for correction-only work:

- Moved the full synthetic local schema into `supabase/local-verification/20260731000000_ecosystem_integration_local_foundation.sql`.
- Replaced `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql` with a production-safe additive outbox-only migration candidate.
- Updated `.github/workflows/ecosystem-integration-local-supabase.yml` to copy the local-verification schema into `supabase/migrations` only inside the ephemeral GitHub-hosted runner before `supabase db reset --local`.
- Hardened `scripts/guard-local-supabase-ci.mjs` so CI fails if `supabase/migrations/**` again contains the CI-local schema marker, `public.os_contacts` synthetic schema creation, or a `CREATE OR REPLACE FUNCTION public.os_ingest_builder_submission` replacement.

Production migration candidate now in `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql`:

- Creates `public.os_integration_outbox` if it does not exist.
- Creates idempotency and retry/status indexes.
- Enables RLS on `public.os_integration_outbox`.
- Revokes anon/authenticated access and grants service-role access.
- Creates service-role-only RLS policy for outbox management.
- Creates or replaces `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)`.
- Revokes public function execute and grants execute only to `service_role`.

Production migration candidate intentionally does not:

- Create or rewrite contact, event, lead, quote, quote item, builder submission, or builder activity tables.
- Replace `public.os_ingest_builder_submission`.
- Mutate Production customer data.
- Drop, truncate, or delete data.
- Add duplicate CRM, event, quote, booking, or catalog systems.

## Risk Level After Correction

- Code merge risk: moderate, pending exact-head CI after the correction and branch protection review.
- Production database migration risk for the corrected outbox-only migration: lower than the original full local schema migration, but still requires live schema confirmation, backup/recovery confirmation, and explicit authorization before execution.
- Production promotion risk before cloud readback QA: high.

## Rollback And Recovery Plan

Before any authorized Production database change:

1. Confirm current Supabase backup/PITR/recovery options for project `cplpbzudjprzbnzocirc` under the active plan.
2. Capture current definition, if any, for `public.os_integration_outbox` and `public.os_enqueue_integration_event`.
3. Capture current RLS policies and grants for `public.os_integration_outbox`, if it exists.
4. Apply only the reviewed additive outbox migration after explicit approval.
5. Verify objects and run controlled synthetic QA with authorized readback.
6. If a migration fails or behavior regresses, restore prior function/policy definitions from the captured pre-change SQL and use Supabase restore support/backups as the database-level recovery checkpoint.

## Authorization Decision

No merge, cloud database migration, Vercel Production deployment, Preview promotion, or synthetic Production submission was performed.

After the correction, request authorization only after exact-head CI passes and the corrected migration is reviewed against the live Production schema.

## Recommended Next Step

Verify exact-head CI for the production-safe migration correction, then repeat the authorization-gate report. Do not apply the migration, merge, deploy, or submit synthetic Production data without explicit approval.
