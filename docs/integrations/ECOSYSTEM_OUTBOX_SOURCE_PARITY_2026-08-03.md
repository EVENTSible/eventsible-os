# EVENTSible Outbox Source Parity - 2026-08-03

- Status: SOURCE PARITY PREPARED / CI VERIFICATION REQUIRED
- Repository: EVENTSible/eventsible-os
- Branch: `fix/outbox-helper-grant-parity`
- Base commit: `d66e2e6b31ee30be4470fd8899ade161746a119e`
- Production Supabase project: EVENTSible OS
- Production project ref: `cplpbzudjprzbnzocirc`

## Scope

This is a migration-history parity and CI verification phase only. No Production database migration, Production data mutation, Builder submission, Event Builder behavior change, ECC/VINCE change, EventsGame change, Vercel environment change, or live intake-to-outbox wiring is included.

## Production State Being Mirrored

Production currently contains the additive outbox foundation:

- `public.os_integration_outbox`
- Outbox indexes
- RLS enabled
- Service-role-only table policy/access
- `public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)`

Production helper execution after the verified forward-fix:

- `service_role`: allowed
- `anon`: denied
- `authenticated`: denied

The existing live intake function remains unchanged:

- `public.os_ingest_builder_submission(payload jsonb)`

## Production Migration Execution IDs

Production verification recorded these Supabase migration-history entries:

1. `20260803173435 ecosystem_integration_local_foundation`
2. `20260803173541 ecosystem_integration_outbox_helper_grants_fix`

The first entry applied the additive outbox schema/helper foundation. Verification then found direct helper `EXECUTE` grants for `anon` and `authenticated`, so the second entry applied a narrow grant forward-fix.

## Source Parity Change

The already-merged base migration remains unchanged to preserve history:

- `supabase/migrations/20260731000000_ecosystem_integration_local_foundation.sql`

This branch adds the follow-up migration that future environments will apply after the foundation:

- `supabase/migrations/20260803173541_ecosystem_integration_outbox_helper_grants_fix.sql`

Exact helper signature:

```sql
public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text)
```

Represented grant changes:

```sql
revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from anon;
revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;
```

No helper execution is granted to `public`.

## Guard And CI Updates

The guard now fails future Production migration files that grant this helper to:

- `public`
- `anon`
- `authenticated`

The local Supabase workflow now runs an additional verifier:

- `npm run test:outbox-helper-grants`

The verifier checks a clean local database after migrations apply and confirms:

- The exact outbox helper signature exists
- The existing intake function signature still exists
- `public` cannot execute the helper
- `anon` cannot execute the helper
- `authenticated` cannot execute the helper
- `service_role` can execute the helper
- `anon` cannot read or insert into the outbox table
- `authenticated` cannot read the outbox table

The existing synthetic intake, idempotency, service mapping, outbox, RLS, catalog, failure-path, and migration-from-zero tests remain in place.

## Safety Scan

The source parity migration contains no:

- `DROP TABLE`
- `TRUNCATE`
- `DELETE FROM`
- CRM/contact/lead/event/quote/booking table creation or mutation
- Replacement of `public.os_ingest_builder_submission`
- Live outbox emission wiring
- Secrets or credential values

## Production Status

No additional Production action occurred in this phase. Production remains at the already verified outbox security state.

## Remaining Limitation

The outbox schema/helper exists and source history now represents the verified grant correction, but live intake is still not wired to emit outbox events. `public.os_ingest_builder_submission(payload jsonb)` remains unwired by design.

## Next Authorization Gate

Separate explicit authorization is required before any of the following:

1. Applying this source-parity migration to another cloud environment.
2. Wiring `public.os_ingest_builder_submission` to `public.os_enqueue_integration_event(...)`.
3. Running a controlled Production Builder submission.
4. Promoting or merging this branch into `main`.
