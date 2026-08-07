# Builder Submission Email Notifications - 2026-08-05

- Status: IMPLEMENTED / PREVIEW VERIFIED
- Repository: `EVENTSible/eventsible-os`
- Branch: `feat/builder-submission-email-notifications`
- Trigger source: `builder.submission_received`
- Recipient: `firstfamdjs@gmail.com`
- Temporary sender: `EVENTSible Leads <thepartys@updates.eventsible.info>`
- Desired eventual sender: `EVENTSible Leads <thepartys@eventsible.info>`
- ECC/VINCE and EventsGame: unchanged

## Scope

This phase adds a narrow internal email notification worker for successful Event Builder submissions. It does not modify Event Builder behavior, ECC/VINCE, EventsGame, Production Supabase data, public DNS, Vercel Production environment variables, or live outbox dispatching.

Email delivery is intentionally outside `public.os_ingest_builder_submission(jsonb)`. A Resend outage must not roll back a successful Builder intake or show a customer-facing failure.

## Sender Domain Findings

Resend account inspection on 2026-08-05 found one verified sending domain:

- `updates.eventsible.info`: verified, sending enabled, receiving disabled, open/click tracking disabled.

`eventsible.info` is not currently listed as a verified Resend sending domain. Public DNS inspection showed the root domain uses Porkbun forwarding MX records, one root SPF TXT for Porkbun, and a root DMARC TXT. Root-domain Resend verification should be handled later with the exact account-generated DNS records and must not create a second SPF TXT record at the same hostname.

Until root sending is explicitly verified, the safe sender is:

`EVENTSible Leads <thepartys@updates.eventsible.info>`

## Architecture

The worker processes existing `os_integration_outbox` rows where:

- `event_type = builder.submission_received`
- `payload_version = builder_submission_received_v1`
- `source_application = eventsible-event-builder`

It uses server-only Supabase service-role access and a server-only Resend API key. Resend is never called from the public browser and no browser-exposed Resend key is allowed.

The protected internal route is:

`/api/internal/builder-lead-notifications`

It requires `EVENTSIBLE_NOTIFICATION_WORKER_SECRET` through an authorization header or worker header. If the secret is absent or incorrect, the route refuses the request.

## Delivery Log

Migration candidate:

`supabase/migrations/20260805170000_builder_submission_email_notifications.sql`

It creates only:

- `public.os_notification_deliveries`
- supporting indexes
- RLS enabled
- service-role-only policy and grants

Tracked fields include:

- `builder_submission_id`
- `notification_key`
- `notification_type`
- `recipient_email`
- `provider`
- `provider_message_id`
- `status`
- `attempt_count`
- `max_attempts`
- `last_safe_error`
- `next_attempt_at`
- `sent_at`
- timestamps

The table does not store email API keys, full customer payloads, raw outbox payloads, or customer-facing secrets.

## Idempotency

The deterministic notification key is:

`builder-lead-email:<builder_submission_id>`

`public.os_notification_deliveries.notification_key` is unique. A sent or dry-run delivery causes later worker runs to skip the same Builder submission. Retry rows are not retried before `next_attempt_at`, and final failed rows are not retried automatically.

## Retry Policy

Default maximum attempts: `5`.

Retry delay uses bounded exponential backoff:

- attempt 1: about 5 minutes
- attempt 2: about 10 minutes
- attempt 3: about 20 minutes
- attempt 4+: capped at about 60 minutes

Failures store only sanitized error text. Notification failure does not mutate or roll back the Builder submission chain and does not change the integration outbox event.

## Email Content

The internal email includes HTML and plain-text versions with:

- Client name
- Email
- Phone
- Preferred contact method
- Best contact time
- Event type
- Event date and confidence
- Start/end time or duration
- City and state
- Planning stage
- Selected services
- Recommended package tier
- Subtotal
- Package savings
- Travel
- Final estimate
- Custom Quote items
- Lead/source label
- Protected Admin Leads link

The Admin link is:

`https://build.eventsible.info/admin`

The email excludes raw JSON, auth tokens, service-role values, database passwords, full outbox payloads, and unnecessary private metadata. Reply-To is included only when the lead email is present and valid.

## Builder Usage Event Plan

This phase sends only on submitted Builder leads, derived from `builder.submission_received`.

Future usage events may include:

- `builder.opened`
- `builder.started`
- `builder.contact_entered`
- `builder.submitted`

No real-time email should be sent for opens or page views. Contact details typed before submission should not be stored without a separately approved abandoned-builder policy. A later daily usage digest is preferred over real-time “opened Builder” alerts.

## Environment Variables

Server-only:

- `RESEND_API_KEY`
- `EVENTSIBLE_NOTIFICATION_WORKER_SECRET`
- `EVENTSIBLE_LEAD_NOTIFICATION_TO`
- `EVENTSIBLE_LEAD_NOTIFICATION_FROM`
- `EVENTSIBLE_LEAD_NOTIFICATION_DRY_RUN`
- `EVENTSIBLE_LEAD_NOTIFICATION_MAX_ATTEMPTS`
- `EVENTSIBLE_ADMIN_LEADS_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No Resend API key may use a browser-exposed environment prefix.

## Preview Verification

Exact-head pull request workflow:

- PR: `EVENTSible/eventsible-os#7`
- Run ID: `31024258688`
- Job ID: `92368525134`
- Result: success
- Runner: Ubuntu 24.04
- Docker: available; `hello-world` passed
- Supabase CLI: `2.111.0`
- Local Supabase target: localhost only

The workflow verified:

- migration from zero
- ecosystem integration chain
- production-shaped quote lookup
- Event Staff quote label normalization
- new Builder lead notification delivery log
- outbox/helper grants
- contract and email renderer tests
- lint wrapper with documented inherited GigTracker parse issue
- build
- cleanup

Notification-specific CI evidence:

- provider: `resend-dry-run`
- recipient: `firstfamdjs@gmail.com`
- status: `dry_run`
- idempotency key prefix: `builder-lead-email:`
- outbox unchanged: true
- RLS: anon/authenticated denied; service_role allowed

Vercel Preview:

- Deployment ID: `dpl_AgjCd6BtD8YUpqGGMPupZN9kF51d`
- Preview URL: `https://eventsible-jo6mqvnuz-firstfamdjs-5913s-projects.vercel.app`
- Target: preview
- Status: READY
- `/api/health`: HTTP 200, `ok: true`, service `EVENTSible OS Admin`
- Unauthenticated POST to `/api/internal/builder-lead-notifications`: HTTP 401
- Runtime logs checked after Preview: no logs found

`npm audit` reported 4 high advisories. The fixes require dependency changes outside this narrow notification phase and were not applied.

## Source Verification Coverage

Local source checks added:

- email rendering with HTML and text
- currency formatting
- Custom Quote formatting
- Date TBD formatting
- Reply-To omission for missing or invalid lead email
- duplicate-send prevention after success
- retry and final-failure status behavior
- safe provider error sanitization
- outbox event unchanged by notification processing
- delivery-log RLS and service-role-only access in local Supabase CI

Preview deployment and dry-run delivery-log evidence are recorded above.

## Recovery Plan

If notification delivery causes problems after a later Production activation:

1. Disable the scheduled caller or remove the worker secret from the runtime environment.
2. Keep Builder intake active.
3. Preserve existing `os_notification_deliveries` rows for audit.
4. Preserve existing `os_integration_outbox` rows.
5. Forward-fix the worker or delivery-log schema.
6. Do not delete contacts, leads, events, quotes, submissions, activities, or outbox rows.

## Production Authorization Gate

No Production action is authorized by this branch.

Later Production sequence must be separately approved:

1. Review and merge this branch.
2. Apply only the notification delivery-log migration.
3. Configure server-only Vercel environment variables without printing values.
4. Verify the protected worker route refuses unauthenticated requests.
5. Run one controlled dry-run or test-recipient notification from an existing synthetic Builder outbox event.
6. Confirm one delivery log row and no duplicate sends.
7. Only then enable real Resend sending for Builder lead notifications.

## Production Dry-Run Compatibility Follow-Up - 2026-08-06

The first authenticated Production dry-run request reached the protected worker and returned HTTP 500. The worker did not create a delivery row and Resend showed no new email, so no real notification was sent.

Safe schema readback identified the failure class: the worker route selected several columns that are not present in the current Production schema, including Builder submission `event_id` / `submitted_at`, quote-version cent columns, and quote-item `label` / `custom_quote` / `line_total_cents`.

Forward-fix branch:

`fix/builder-lead-notification-production-schema`

The branch keeps the worker protected and dry-run gated, makes the worker select only Production-supported columns, derives cent values from the existing dollar-shaped quote fields, preserves Custom Quote labeling from outbox payload service codes, and adds source tests that fail if unsupported Production-missing select columns return.

No Production worker retry, real email, environment change, Event Builder change, ECC/VINCE change, or database migration is included in this source fix. A new Preview and final Production dry-run remain separate gates.

## Classification

- Builder intake: LIVE
- Builder intake-to-outbox event creation: PRODUCTION VERIFIED
- Internal email notification code: IMPLEMENTED / PREVIEW VERIFIED; Production dry-run forward-fix in progress
- Preview email dry-run: PASSED
- Live email sending: NOT ACTIVATED
