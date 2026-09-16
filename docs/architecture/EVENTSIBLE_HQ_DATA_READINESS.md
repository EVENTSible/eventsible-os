# EVENTSible HQ Data Readiness

## Purpose

Data Readiness is the Owner-only correction and reviewed-intake boundary for canonical EVENTSible records. It does not replace contacts, leads, events, bookings, staff assignments, notes, or Team Calendar. It stages a bounded `intake_manifest_v1`, shows duplicate evidence, requires approval of the exact manifest hash and item set, and then applies only those approved candidates through server-side RPCs.

AI may help prepare a manifest outside this boundary, but AI is never an authority and never writes canonical data. Source documents, screenshots, email bodies, PDFs, and attachments remain outside the database. The manifest retains only normalized candidate fields, a source hash, and a short safe provenance reference.

## Production outbox diagnosis (read-only, 2026-09-09)

- Integration outbox: 22 pending Builder submission events, all at zero attempts. The repository does not yet contain a general integration dispatcher. The existing Builder email worker uses a separate idempotent delivery ledger and intentionally leaves these integration events unchanged.
- Integration dead-letter: one redacted `event.updated` record matches the documented isolated schema-QA marker. It has no business relationship identifiers and is not evidence of a live processor failure.
- Automation outbox: 36 pending records, all at zero attempts. No automation consumer exists in the repository.

These queues should not be replayed or repaired as part of Data Readiness. Their current state does not block reviewed onboarding because the intake RPCs do not enqueue external dispatch. A general integration consumer and an automation processor are separate future work and must include explicit delivery semantics, retry limits, and idempotency tests before activation.

## Authorization and data flow

- `data.readiness.manage` is Owner-only in both the application capability registry and `os_has_hq_capability`.
- The browser uses the authenticated Supabase client. It never receives a service-role credential.
- Every mutation derives the actor from `auth.uid()` and rechecks the Owner capability inside a `SECURITY DEFINER` RPC with an empty search path.
- The staging table has RLS enabled and no direct `anon` or `authenticated` table privileges. Owners receive a bounded snapshot through `os_data_readiness_snapshot()`.
- Managers, Staff, Hosts, ordinary authenticated users, and signed-out users cannot inspect, approve, apply, or compensate intake batches.

## Manifest and retry contract

Each manifest has a deterministic database hash and 1–250 uniquely keyed candidates. Candidate types are `contact`, `inquiry`, `event`, `staff_assignment`, `payment_fact`, `operational_note`, and `calendar_fact`. Required values cannot be marked uncertain. Related candidates can refer to an earlier approved item key so a reviewed contact/event/inquiry chain can remain one batch.

Staging is a dry run: it validates the complete manifest, records duplicate warnings, and does not write canonical records. Approval binds the exact hash and item-key set. Apply records each item independently. Successfully applied items are not replayed; failed items retain an error code and can be explicitly reapproved for a safe retry. Duplicate warnings never merge records automatically.

Compensation preserves history. Imported contacts, inquiries, and events are archived; assignments are cancelled; notes are archived; calendar facts become private archived notes; payment facts restore their captured prior values. No intake RPC hard-deletes canonical or staging history.

## Complete 24-record importer

`intake_manifest_v2` is the narrowly bounded path for the accepted 24-gig preview-v3 source baseline. It retains the preview hash as provenance but requires a separate SHA-256 of the exact executable manifest file, exactly 24 event items, and an exact count for every supported item type. Stable manifest keys resolve contacts to events, inquiries to their contact/event pair, bookings to events, services and financial facts to bookings, and assignments/notes/provenance to their canonical parent. The private source documents and their client details are not stored in source control.

Two explicit dispositions support EVENTSible appearances that had no outside hiring client: `vendor_appearance` and `operational_event`. These event items are create-only, omit `primaryContactItemKey`, and store `contactRelationship: none_operational`. They may retain staff notes, organizer provenance, and assignments to existing team members, but they cannot create inquiries, bookings, booking services, or payment facts. The booking table also has a database trigger that rejects a later booking while this contactless classification remains in place. Ordinary gigs and every native Wedding Hero or Event Builder chain continue to require a verified contact or an exact fingerprinted native link.

The v2 candidate set adds `booking`, `booking_service`, and `source_provenance` to the canonical contact/inquiry/event/assignment/note chain. `os_bookings.total_amount` is exclusively the reviewed contracted or quoted value. `os_booking_payment_facts` separately stores that evidence value, gross client receipts, deposits, tips, overtime, platform fees, net payouts, method, payment status, payout status, and balance evidence. Null means unknown: deposits never become contract totals, tips never inflate contract values, and the importer does not derive missing amounts. The per-item audit row records the booking before-image so rollback restores the exact prior financial summary while retaining the archived evidence row.

Historical events with a known calendar date and unknown time use `os_events.historical_date`. They keep `starts_at` and `ends_at` null, so neither midnight nor a timezone conversion is fabricated. Timed native Wedding Hero and Event Builder events continue using their existing timestamp path. Duplicate detection compares title plus the corresponding canonical date precision.

Staging and exact Owner approval remain separate from apply. The v2 apply RPC re-runs duplicate detection and then applies the entire manifest in one database transaction. It has no per-item exception handler: any invalid relationship or constraint violation rolls back every canonical write and every in-transaction item-state change. A completed hash replays as a read-only idempotent result. Lower-confidence review entries must remain inquiries, and pending-unbooked entries cannot have booking items.

### Native-form compatibility and source precedence

Event Builder and Wedding Hero keep their existing native submission paths and idempotency keys. The importer never updates or deletes Builder submissions, Builder intake requests, planning assignments, or planning answers. A reviewed parent item may use `recordMode: "link_existing"` only for an active contact, event, inquiry, or booking and only with its exact database fingerprint plus `sourcePrecedence: "preserve_existing_native"`. Linking resolves later manifest keys to that existing parent without changing its native fields. Any other match remains a duplicate stop; archived matches require a new Owner review and are never restored automatically.

Source precedence is deliberately conservative: existing native form fields and questionnaire answers win. Imported evidence may create missing child facts, services, assignments, notes, and provenance after an exact reviewed link, but conflicting contact, date, venue, service, or status values do not overwrite the linked parent. A payment fact linked to an existing booking remains a separate audited fact and does not rewrite that booking's native financial summary. A separately reviewed Owner correction must use the existing record-maintenance boundary. Staging records a fingerprint of contacts, events, inquiries, bookings, Builder submissions/intake requests, and planning assignments/answers. Apply takes a transaction-level compatibility lock, locks those tables, and recomputes that fingerprint before its first canonical write. A native form transaction that reaches a protected write while apply owns the lock fails closed with a retry response; if the native write commits first, apply sees the changed fingerprint and aborts. Either ordering prevents a simultaneous submission and import from silently creating competing chains.

Imported confirmed bookings carry a transaction-only, Owner-validated batch marker that suppresses existing booking automation triggers during creation. The marker is removed before commit, so later lifecycle changes use the normal triggers. The complete-import verification asserts that neither outbox changes. Rollback archives or cancels imported records, restores booking financial before-images, and preserves batch, item, source-provenance, and activity history; it never hard-deletes or merges records.

## Rollout

1. Freeze Owner Data Readiness mutations.
2. Back up and confirm recovery for the canonical Supabase project.
3. Apply only `20260909042244_hq_data_readiness_foundation.sql` through the normal migration ledger.
4. Verify RLS, grants, function definitions, Owner authorization, non-Owner denial, and empty Data Readiness snapshot.
5. Deploy the application commit.
6. Verify signed-out and non-Owner denial, Owner read-only rendering, then one separately approved synthetic dry run before real intake.

The complete importer requires a later migration-first rollout of `20260915035447_hq_complete_manifest_importer.sql`. Applying that migration does not authorize staging or applying the private manifest. A future Production import approval must cite the exact executable-manifest file hash, exact item counts, and the accepted preview-v3 source hash; migration rollout, manifest staging, import apply, and rollback remain separately auditable gates.

If the migration fails, its transaction must roll back before application deployment. If the application deployment fails after a successful migration, keep the additive migration in place and roll the application back; the prior application does not call the new objects. If authorization is too permissive, disable execute on the eight Data Readiness RPCs immediately, preserve audit evidence, and deploy a reviewed corrective migration.

## Deferred work

- Automatic duplicate merging
- Original document storage
- General integration-outbox processing
- Automation-outbox processing
- External calendar or GigSalad synchronization
- A large import-management dashboard
