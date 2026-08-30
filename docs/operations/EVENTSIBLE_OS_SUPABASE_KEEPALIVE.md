# EVENTSible OS Supabase Keep-Alive

- Status: IMPLEMENTED / NOT ACTIVE
- Owner: EVENTSible OS
- Repository: `EVENTSible/eventsible-os`
- Supabase project: `cplpbzudjprzbnzocirc`
- Vercel project: `eventsible-os` (`eventsible-os-admin` is the package name)
- Production domain: `eventsible.biz`
- Production activation: PENDING APPROVAL
- Last verified scheduled Production execution: NOT YET VERIFIED

## Purpose

The OS Supabase project is on the pausable Free plan. This app-native Vercel Cron route creates several genuine, lightweight, read-only database requests each day. It reduces the risk of an inactivity pause but is not an uptime guarantee. Supabase Pro remains the appropriate long-term Production reliability solution.

The existing ChatGPT Production smoke test remains secondary oversight. It is not the primary anti-pause mechanism.

## Route and schedule

- Route: `GET /api/cron/supabase-keepalive`
- Schedule: `20 10 * * *`
- UTC: daily at 10:20 UTC; Vercel Hobby may invoke it later within that hour
- Indiana: 6:20-7:19 AM EDT or 5:20-6:19 AM EST
- Activity: count-backed, body-free reads against `os_events`, `os_contacts`, and `os_bookings`
- Database writes: none

The current server client reaches Supabase through the Data API and has no existing read-only database-time RPC. Adding a SQL function solely for `current_timestamp` would violate this change's no-schema rule, so the scheduled route uses the three established table reads and reports its server timestamp. The pre-implementation live health gate separately verified `SELECT current_timestamp` through authorized read-only administrative access.

`origin/main` had no `vercel.json` and therefore no repository-defined Vercel Cron entries to preserve. This change adds one job, remaining within the requested Hobby limit of two.

Vercel Cron runs only on Production deployments. A Preview request verifies endpoint behavior, not the Production scheduler.

## Required environment-variable names

Required for the route:

- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Reused for the optional owner failure alert when all are configured:

- `RESEND_API_KEY`
- `EVENTSIBLE_LEAD_NOTIFICATION_TO` or `EVENTSIBLE_LEAD_NOTIFICATION_RECIPIENT`
- `EVENTSIBLE_LEAD_NOTIFICATION_FROM`

Values belong only in the owning Vercel project. Never commit them, print them, move them to another repository, or use a `NEXT_PUBLIC_` name for a secret.

## Security behavior

- Missing or invalid `Authorization: Bearer <CRON_SECRET>` returns `401`.
- A missing `CRON_SECRET` also returns `401`; the route fails closed.
- The Supabase service-role credential is read only by the server-side admin client.
- The authorized route returns counts of checks attempted and passed, never database rows.
- Responses and logs exclude environment values, customer data, and raw Supabase errors.
- The response is dynamic and explicitly marked `no-store`.

## Manual verification

Use a Preview or Production URL only when that environment already has an approved `CRON_SECRET`. Keep the value in the shell environment and do not paste it into reports:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "https://<approved-deployment>/api/cron/supabase-keepalive" -Headers $headers
```

Expected success shape:

```json
{
  "ok": true,
  "timestamp": "2026-08-30T12:00:00.000Z",
  "checksAttempted": 3,
  "checksPassed": 3,
  "durationMs": 42
}
```

Interpretation:

- `401`: missing `CRON_SECRET`, missing authorization, or invalid authorization.
- `503`: authorization succeeded but the route did not complete all database checks.
- `200`: all configured read-only checks passed for that request.

For Production activation, verify one scheduler-originated invocation in Vercel **Project > Settings > Cron Jobs > View Logs**, then correlate its time with genuine Supabase database/API activity. A manual request or Preview request is not scheduled Production proof.

## Failure visibility

The route emits only concise sanitized Vercel runtime errors. If the existing Resend owner-notification variables are present, it also sends a concise alert using the established owner destination. The alert uses a UTC-day idempotency key to prevent duplicate sends for the same failure day and does not depend on a Supabase write.

## Rollback or retirement

1. Obtain approval for the Production change.
2. Remove the `/api/cron/supabase-keepalive` entry from `vercel.json` and remove the dedicated route/helper/tests in a focused branch, or temporarily disable the job in Vercel Cron settings.
3. Deploy the approved rollback to Production.
4. Confirm Vercel no longer schedules the route.
5. Remove `CRON_SECRET` only under a separately approved environment-variable change.
6. Record the retirement date and replacement reliability mechanism in the ecosystem inventory.

Retirement does not authorize Supabase schema, data, RLS, Auth, DNS, billing, or credential changes.
