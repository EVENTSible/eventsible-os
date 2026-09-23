# EVENTSible HQ Owner Quick Add

## Boundary

Owner Quick Add records ordinary Owner-attested contacts, leads, events, bookings, and notes directly in canonical OS tables. It does not stage imports, promote candidates, calculate forensic fingerprints, or create a second record system.

Each browser form carries an operation UUID to `public.os_owner_quick_add`. The database scopes its idempotency key to the authenticated Owner and records the request fingerprint and committed result in the existing `os_activity_events` audit ledger. An identical retry returns the original result. Reusing an operation UUID for different facts is rejected. Duplicate warnings remain a separate business check and must still be reviewed.

## Required release order

1. Approve the exact application commit and `20260917210520_hq_owner_quick_add.sql`; confirm the database recovery checkpoint appropriate to the active Supabase plan.
2. Apply only the approved database migration.
3. Verify that `public.os_owner_quick_add(uuid,text,jsonb,boolean)` exists with the reviewed grants, that `os_bookings_payment_status_check` permits `unknown`, and that the migration ledger contains `20260917210520`.
4. Deploy the application commit that calls the four-argument RPC.
5. Run authenticated Owner browser smoke coverage for contact, lead, date-only event, zero-service booking with unknown payment status, and note; verify bounded roles remain denied.
6. Monitor sanitized application/database errors. Promotion or rollback requires a separate decision.

Do not deploy the application before steps 2 and 3. The application intentionally fails closed if the canonical choices or RPC are unavailable.

## Rollback

Rollback the application to the pre-Quick-Add commit first so no client expects the four-argument RPC. Then execute `supabase/rollbacks/20260917210520_hq_owner_quick_add.sql` as one transaction.

The rollback is fail-safe. It refuses to restore the old strict payment-status constraint while any booking has `payment_status='unknown'`. Every such row must first be resolved from actual payment evidence to one of the prior allowed statuses. Do not mass-convert unknown rows to unpaid or another invented state.

After that precondition is satisfied, the rollback drops the Quick Add RPC and restores the prior constraint. Quick Add added no table or alternate business schema: idempotency uses the shared activity audit ledger, whose rows and unique index are intentionally preserved. Capture the affected booking IDs, function definition/grants, constraint definition, and Quick Add activity count before any Production rollback.

The disposable local verification script proves both paths: unresolved unknown rows leave the RPC and constraint intact, while an explicitly compensated fixture permits rollback without deleting audit history.
