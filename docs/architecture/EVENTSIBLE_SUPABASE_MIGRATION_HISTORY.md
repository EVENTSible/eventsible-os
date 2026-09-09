# EVENTSible Supabase Migration History

## Canonical source

The active files in `supabase/migrations` mirror the 44 versions recorded in the EVENTSible OS Production migration ledger through `20260908133323`. Their expected filenames and SHA-256 hashes are recorded in `supabase/migration-history.json` and enforced by `npm run test:migration-history`.

Applied migrations are immutable. Never rename, edit, duplicate, consolidate, or replace a migration after it has been recorded remotely. Create a new ordered migration for every future schema change and verify it from an empty local Supabase database before deployment.

Production's migration ledger was not repaired or altered during this reconstruction. The SQL was recovered from the ledger's recorded `statements` values with Supabase CLI 2.117.0. `supabase migration fetch` appends a delimiter to each fetched file; that delimiter was removed and every resulting file was verified against the SHA-256 of its recorded statement.

## Why Git and Production diverged

The first 28 Production migrations were applied before their SQL was committed to the repository migration directory. Later repository migrations were applied through the Supabase migration interface, which recorded several of them under their execution timestamps rather than their existing local filenames. Eleven files therefore had equivalent SQL but different versions.

Five versions already matched. Four also matched after comment and whitespace normalization. The fifth, `20260803173541`, had the same effective grants, but the later repository copy included a prerequisite check that was not part of the SQL recorded in Production. The canonical active file now preserves the recorded Production SQL; the former guard remains available in Git history.

Former local version | Canonical Production version
--- | ---
`20260731000000` | `20260803173435`
`20260803223000` | `20260803235147`
`20260804003000` | `20260804010800`
`20260804013000` | `20260804014458`
`20260804153000` | `20260804023227`
`20260804181000` | `20260804033918`
`20260805170000` | `20260805171228`
`20260902004322` | `20260902005304`
`20260902050555` | `20260902051415`
`20260902172423` | `20260902173917`
`20260908045800` | `20260908124113`

## Local verification fixture

`supabase/local-verification/20260731000000_ecosystem_integration_local_foundation.sql` is a historical synthetic test fixture, not a canonical schema source. It previously supplied minimal stand-ins for foundational tables and was copied over an active migration during CI. CI no longer performs that substitution: resets apply the genuine 44-file chain directly.

The fixture remains outside `supabase/migrations` for historical evidence and specialized-test review. It must never be copied into the active migration directory, applied to a linked project, or treated as a Production baseline.

The local Supabase configuration keeps the managed Storage service enabled because the canonical history creates bucket records and Storage RLS policies. This is isolated local infrastructure, not a Production configuration change.

## Future workflow

1. Create a new migration with `supabase migration new <name>`.
2. Review SQL, RLS, grants, function security, data effects, and rollback strategy.
3. Run `npm run test:migration-history` and a complete local Supabase reset.
4. Run database integration, authorization, contracts, lint, build, audit, and advisor checks.
5. Use linked read-only migration comparison and `supabase db push --dry-run` before requesting Production approval.
6. Apply only the explicitly approved new migration through normal migration accounting.

If a historical integrity check fails, restore the file from the reviewed commit or the Production-ledger recovery evidence. Do not repair the Production ledger merely to accommodate a repository edit. If a new migration fails, stop before application deployment and use transactional rollback or a reviewed forward correction; never edit an already-applied historical file.

The pending HQ Data Readiness migration `20260909042244_hq_data_readiness_foundation.sql` remains isolated in PR #39 and is intentionally absent from this reconciliation.
