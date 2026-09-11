# HQ bounded cleanup and Records & Intake

`/admin/data-readiness` is the Owner-only **Records & Intake** workspace. It keeps routine record maintenance, reviewed intake, archived history, and the approved cleanup boundary in one compact, search-first surface.

## Cleanup boundary

The executor never embeds customer identifiers in source. `os_preview_cleanup_manifest(text)` hashes the exact uploaded file bytes and accepts only a server-controlled reviewed hash in `os_cleanup_manifest_scopes`. It validates counts, record existence, unresolved exclusions, and protected contact-user relationships before storing target IDs in private audit tables.

Customer archival and outbox quarantine are separate Owner-confirmed transactions. Both are idempotent and preserve prior status for exact restoration. Customer records are archived, never deleted. Outbox rows use the explicit `quarantined` state; worker-eligible queries select only dispatchable states.

The approved manifest remains private operational evidence. It must never be committed, copied into a migration, attached to CI, or pasted into a Production-backed Preview.

## Normal and archived views

Normal Mission Control, Calendar, Gig Workspace, client planning lookups, and notification enrichment exclude archived parent records. The Records & Intake Archived tab is the explicit Owner-only history surface. Child bookings, quotes, submissions, planning answers, activities, notes, and notification history remain intact.

## Rollout and rollback

Apply `20260910185316_hq_bounded_cleanup_and_records_intake.sql` before deploying the matching application. Verify tables, RLS, grants, functions, constraints, the dashboard view, and empty cleanup audit tables before merge. Application rollback is a normal merge revert; the additive cleanup schema can remain dormant. If database authorization is too permissive, use a reviewed forward migration to revoke affected execution before any cleanup is authorized.

Applying the migration does not authorize cleanup execution. Production execution requires separate approval naming the exact manifest SHA-256 and the separately selected customer/outbox actions.
