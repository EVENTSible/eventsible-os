# Site Studio schema release package

Status: requires separate Production approval. No merge, deployment, promotion, content publication or database restore is authorized by this file.

Version: `20261028213219`. `MANIFEST.json` pins the exact migration, runner and postflight bytes. The unchanged schema proposal remains in `supabase/proposals/20261020_site_studio_v1.sql`.

The canonical migration contains object-absence, executor/dependency and security assertions. The controlled runner adds the exact reviewed Production ledger guard, a ledger write lock, one transaction and atomic history registration. Keeping the Production ledger guard outside the canonical file lets ordinary isolated CI replay its own migration history without weakening the Production runner. Neither file is safely rerunnable after a successful application; repeated execution must stop without changing the first result.

## Before execution

1. Obtain separate owner approval for the exact version and both hashes. Confirm the OS project identity through authoritative configuration and verified TLS, not a database name alone.
2. Verify the current source head, CI, environment bindings, retained deployment rollback candidates, and a fresh encrypted recoverable backup. Preserve the Home-PC key companions. A logical database backup excludes external files and provider configuration.
3. Confirm 53 ledger entries through `20260917210520` and the manifest's expected digest; all Site Studio objects must be absent. If anything differs, stop and refresh the packet. Do not repair history or overwrite objects.
4. Ensure no concurrent migration. Five-second lock and 60-second statement limits intentionally stop on contention.

## Separately approved execution

Use PostgreSQL 17 `psql -X --set=ON_ERROR_STOP=1 --file=<absolute path to APPLY_APPROVED_SITE_STUDIO.psql>`, `PGSSLMODE=verify-full`, the verified Supabase root CA, and the independently verified direct OS connection. Use masked password entry or the existing secure in-memory handoff. Never place credentials in command arguments, URLs, source or reports.

Run only the controlled `.psql` wrapper for this approval. It includes the canonical file relative to itself and registers that exact file as one `text[]` ledger entry inside the same transaction. Do not combine this runner with another migration-accounting tool or paste it into the SQL editor. Normal isolated Supabase migration replay uses only the canonical file and its own accounting.

After `COMMITTED`, run `POSTFLIGHT_READ_ONLY.sql` and check the manifest, two empty tables, three Owner-only policies, grants/sequence boundaries, function ownership and ledger version. Verify new-table API visibility before application release. Keep deployment safeguards active and stop before any application deployment or real-content publication.

## Stop and recovery

Any preflight, timeout, authorization, ownership, grant, schema or ledger failure stops execution. With `ON_ERROR_STOP` enabled and savepoint continuation disabled, closing the failed connection rolls back its uncommitted transaction. Never continue to deployment after a failed migration.

If commit success is uncertain, inspect ledger and objects read-only before doing anything else. Never blindly retry. After a committed additive migration, preserve all new data and use a separately reviewed forward correction; do not drop tables or delete revision history.

Application rollback uses the retained deployment for the affected lane and leaves additive schema/data intact. Content revision restoration is a separate explicit Owner publication action. Full database restoration is a distinct outage and recovery approval with an acknowledged data-loss window.
