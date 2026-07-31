# EVENTSible Ecosystem Integration Merge Review - 2026-07-31

- Status: AUTHORIZATION GATE BLOCKED BY PRODUCTION MIGRATION REVIEW
- Owner: EVENTSible OS
- Canonical source: EVENTSible OS repository
- Reviewed branch: `feat/ecosystem-integration-foundation`
- Reviewed OS head before this report: `93690822e408fe68811d5c5d312bc23f2125204a`
- Last implementation commit verified by CI: `c6c32de31bcc2a874a2c8c861707d04e16d47082`
- Exact-head CI run reviewed: `30672248228`
- Exact-head CI job reviewed: `91292225017`

## Repository Baseline

| Repository | Branch | Expected/observed status |
| --- | --- | --- |
| EVENTSible OS | `feat/ecosystem-integration-foundation` | Remote feature branch had exact-head CI passing at `93690822e408fe68811d5c5d312bc23f2125204a`; local checkout remained clean at implementation commit `c6c32de31bcc2a874a2c8c861707d04e16d47082` because local `git fetch` is blocked in the Codex worker. |
| Event Builder | `feat/ecosystem-integration-foundation` | Local branch clean at `7abadbefbeeeb2737d65953efa065d27c6b97feb`. |
| ECC/VINCE | `master` | Read-only and clean at `7c7c825aef6b3e51420c451dd8aae7db5285373c`. |

Canonical documentation hub reviewed: `docs/README.md`. EVENTSible OS remains the business system of record.

## Exact-Head CI Result

| Field | Result |
| --- | --- |
| Workflow | `Ecosystem Integration Local Supabase` |
| Run ID | `30672248228` |
| Job ID | `91292225017` |
| Commit | `93690822e408fe68811d5c5d312bc23f2125204a` |
| Branch | `feat/ecosystem-integration-foundation` |
| Result | Success |
| Duration shown | 2m 20s |

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

## Migration Review

Migration under review: `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql`.

Finding: do not apply this migration to Production as-is.

Reasons:

- The file header identifies it as a CI-local, synthetic-test-focused foundation.
- It creates a full local verification schema for `os_contacts`, `os_events`, `os_builder_submissions`, `os_leads`, `os_quote_versions`, `os_quote_items`, `os_builder_activity`, and `os_integration_outbox`.
- It uses `CREATE OR REPLACE FUNCTION public.os_ingest_builder_submission(payload jsonb)`, which would replace the live Builder intake function if applied to the Production project.
- It revokes and grants privileges on core CRM/intake tables and drops/recreates service-role policies. These are not data-destructive, but they are Production access-control behavior changes.
- It has no `DROP TABLE`, `TRUNCATE`, or `DELETE FROM` data-destruction statements, but replacing the live intake function is too high-risk without a production-schema-specific migration.

Potential Production objects affected if applied unchanged:

- Tables: `public.os_contacts`, `public.os_events`, `public.os_builder_submissions`, `public.os_leads`, `public.os_quote_versions`, `public.os_quote_items`, `public.os_builder_activity`, `public.os_integration_outbox`.
- Functions: `public.os_known_builder_service_code(jsonb)`, `public.os_public_catalog_from_builder(jsonb)`, `public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)`, `public.os_ingest_builder_submission(jsonb)`.
- RLS/grants/policies on the tables above.
- Indexes and constraints listed in the migration.

Safer Production migration candidate:

- Treat `integrations/sql/ecosystem-integration-foundation.sql` as the production-oriented additive outbox foundation candidate, pending fresh review against the actual Production schema.
- Keep the 691-line `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql` as CI-local verification evidence only unless it is split or rewritten into a Production-safe migration.

## Risk Level

- Code merge risk: moderate, assuming branch protection is satisfied and database migrations are not applied automatically on merge.
- Production database migration risk for `20260731000000_ecosystem_integration_local_foundation.sql` as-is: high.
- Production promotion risk before cloud readback QA: high.

## Rollback And Recovery Plan

Before any authorized Production database change:

1. Confirm current Supabase backup/PITR/recovery options for project `cplpbzudjprzbnzocirc` under the active plan.
2. Capture existing definitions for affected functions, especially `public.os_ingest_builder_submission(jsonb)`.
3. Capture current RLS policies and grants for affected tables.
4. Apply only an additive, production-specific migration after review.
5. Verify objects and run controlled synthetic QA with authorized readback.
6. If a migration fails or behavior regresses, restore function/policy definitions from the captured pre-change SQL and use Supabase restore support/backups as the database-level recovery checkpoint.

## Authorization Decision

No merge, cloud database migration, Vercel Production deployment, Preview promotion, or synthetic Production submission was performed.

Authorization should not be requested for applying `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql` to Production as-is. The next requested approval should be for either:

1. A small corrective branch update that separates CI-local schema verification from the Production migration path, or
2. A reviewed production-specific additive migration based on `integrations/sql/ecosystem-integration-foundation.sql` after confirming the live Production schema.

## Recommended Next Step

Prepare a production-safe migration package that does not replace the live intake function blindly, then rerun exact-head CI and repeat merge review before requesting merge/database/deployment authorization.
