# EVENTSible Outbox Production Schema Verification - 2026-08-03

- Status: PRODUCTION SCHEMA VERIFIED / LIVE INTAKE WIRING DEFERRED
- Repository: EVENTSible/eventsible-os
- Branch: main
- Starting main commit: 1f682a28fd8e5d642c6e4b4a5e84c9db52cbcfc2
- Supabase project: EVENTSible OS
- Supabase project ref: cplpbzudjprzbnzocirc
- Organization plan observed through Supabase metadata: free

## Authorization

The user explicitly authorized applying and verifying only the reviewed additive EVENTSible OS outbox migration. This phase did not authorize live Builder intake wiring, Production Builder submissions, Event Builder code changes, ECC/VINCE changes, EventsGame changes, CRM/contact/lead/event/quote/booking mutations, Vercel environment changes, or Production deployment promotion.

## Migration Inputs

Reviewed source file on GitHub main:

- `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql`
- GitHub blob SHA: `72c959929944b4b516b75245ec79afa9a393f905`
- Reviewed main context: `1f682a28fd8e5d642c6e4b4a5e84c9db52cbcfc2`

The reviewed migration was limited to:

- `public.os_integration_outbox`
- `os_integration_outbox_idempotency_key_idx`
- `os_integration_outbox_status_next_attempt_idx`
- RLS and service-role policy/grants for the outbox table
- `public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)`

It did not contain `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, destructive existing-table rewrites, CRM/event/quote table recreation, replacement of `public.os_ingest_builder_submission`, or live intake-to-outbox wiring.

## Preflight

Safe metadata checks confirmed:

- Target project name: EVENTSible OS
- Target project ref: `cplpbzudjprzbnzocirc`
- EventsGame project ref: `evhhhpitdjsqjufuvgcf` was not targeted
- Postgres version: 17.6
- `pgcrypto` existed before migration
- `public.os_ingest_builder_submission(payload jsonb)` existed before migration
- `public.os_integration_outbox` did not exist before migration
- `public.os_enqueue_integration_event` did not exist before migration

Existing intake function fingerprint before and after migration:

- `public.os_ingest_builder_submission(payload jsonb)` definition MD5: `329c0592aec62f78a182a7e3a741072a`

Existing core table metadata was checked by column/index/policy counts only. Customer rows and private payloads were not inspected.

## Recovery Plan

The Supabase organization metadata reported plan `free`. Supabase project metadata did not indicate PITR availability. The recovery plan for this additive migration is therefore forward-fix first:

1. Keep live intake-to-outbox wiring disabled.
2. Revoke helper execution if the helper needs to be disabled.
3. Preserve any legitimate outbox rows already created.
4. Forward-fix schema or grant defects with narrow additive SQL.
5. Avoid destructive rollback, table drops, truncation, or deletion of legitimate outbox records.

## Execution Result

Primary migration applied successfully through the Supabase migration interface:

- Migration name recorded by Supabase: `ecosystem_integration_local_foundation`
- Migration version recorded by Supabase: `20260803173435`
- Result: success

Verification then found direct function grants on `anon` and `authenticated` for the new `SECURITY DEFINER` helper. The table grants and RLS were correct, but helper execution was broader than the intended service-role-only boundary.

A narrow forward-fix migration was applied immediately:

- Migration name recorded by Supabase: `ecosystem_integration_outbox_helper_grants_fix`
- Migration version recorded by Supabase: `20260803173541`
- SQL scope: revoke helper execution from `anon` and `authenticated`; keep service-role execution
- Result: success

## Objects Verified

Table: `public.os_integration_outbox`

Columns verified:

- `id uuid primary key default gen_random_uuid()`
- `event_type text not null`
- `payload_version text not null`
- `source_application text not null`
- `occurred_at timestamptz not null default now()`
- `related_record_ids jsonb not null default '{}'::jsonb`
- `payload jsonb not null default '{}'::jsonb`
- `idempotency_key text not null`
- `status text not null default 'pending'`
- `attempt_count integer not null default 0`
- `next_attempt_at timestamptz`
- `failure_history jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes verified:

- `os_integration_outbox_pkey` on `id`
- `os_integration_outbox_idempotency_key_idx` unique on `idempotency_key`
- `os_integration_outbox_status_next_attempt_idx` on `status, next_attempt_at, created_at`

RLS and grants verified:

- RLS enabled: yes
- Table policy: `Service role manages integration outbox`, role `service_role`, command `ALL`
- `anon` table select: denied
- `anon` table insert: denied
- `authenticated` table select: denied
- `service_role` table insert/select/update/delete: permitted

Helper function verified:

- Function: `public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)`
- Security mode: `SECURITY DEFINER`
- Search path: `public, extensions`
- Definition MD5: `4ee441189c423010d627d4158f17385c`
- `anon` execute after fix: denied
- `authenticated` execute after fix: denied
- `service_role` execute after fix: permitted
- Idempotency behavior: same idempotency key returned the same UUID

## Isolated Schema QA Row

One outbox-only QA marker was created to verify helper idempotency. It did not reference or create any real client, contact, lead, event, quote, booking, or Builder submission record.

- QA outbox ID: `a37ce467-b1f5-439d-a9b1-a21ca4cbe825`
- Idempotency key: `schema-qa-2026-08-03-outbox-helper`
- Event type: `event.updated`
- Payload version: `schema_qa_v1`
- Source application: `codex_schema_qa`
- Final status: `dead_letter`
- Purpose: synthetic schema QA marker only; not live integration work

## Application Regression

Post-migration app checks:

- EVENTSible OS `/api/health`: 200 with `ok: true`
- Event Builder `/`: 200
- Event Builder `/build`: 200
- Event Builder `/auth`: 200
- Event Builder `/admin`: 200 app shell with auth markers; no raw Admin payload content in unauthenticated response

Vercel runtime checks for the last hour:

- EVENTSible OS project `prj_1J9OmkeiAhiL9muVjnb6ytqDmY6l`: no runtime errors and no error/fatal logs found
- Event Builder project `prj_8iqwclYB9ww9Km3wG0kpgGXOzjlw`: no runtime errors and no error/fatal logs found

No application redeployment was required for the database migration itself. No Vercel environment variables, domains, or aliases were changed.

## Advisors

Supabase security advisor after migration:

- One existing warning: leaked password protection disabled
- No outbox-specific security advisor failure was reported

Supabase performance advisor after migration:

- Existing informational/warning items remain for inherited unindexed foreign keys, RLS initplan patterns, and unused indexes
- The new outbox status index is currently reported as unused, which is expected immediately after creating the outbox foundation before live processors consume it

## Standard Checks

The local Codex checkout could not be refreshed to current GitHub `main` because `git fetch` failed with `.git/FETCH_HEAD` permission denied. The local OS clone was still on `feat/ecosystem-integration-foundation` at `c6c32de31bcc2a874a2c8c861707d04e16d47082`, while GitHub `main` was confirmed at `1f682a28fd8e5d642c6e4b4a5e84c9db52cbcfc2` before this documentation commit.

Current-source validation therefore used GitHub main metadata plus Supabase schema verification. Exact-head CI for the integration foundation had previously passed on the feature head, and the Stage 1 OS merge deployment was healthy. Local npm checks were not rerun against current `main` in this worker because the checkout could not be safely updated.

## Security Result

Confirmed in this phase:

- No Supabase service-role value was printed
- No database password was printed
- No Host PIN value was exposed
- No customer rows or private record payloads were printed
- No Event Builder code changed
- No Builder lead was submitted
- No EventsGame project was targeted
- No ECC/VINCE project was modified
- No Vercel environment settings were changed
- The new helper is not publicly executable after the grant fix
- The outbox table is not publicly readable or insertable

## Remaining Limitation

The outbox schema and helper now exist in Production, but live Builder intake is not wired to emit outbox events. `public.os_ingest_builder_submission` remains unchanged and does not call `public.os_enqueue_integration_event(...)` in this phase.

## Exact Next Phase

Request separate explicit authorization to review and implement live intake-to-outbox wiring. That next phase should update `public.os_ingest_builder_submission` additively, verify one controlled Builder cloud submission, confirm exactly one linked OS chain, verify one outbox event per idempotency key, and re-run Admin/security/runtime QA before marking live integration event emission production verified.
