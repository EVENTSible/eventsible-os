# EVENTSIBLE_SUPABASE_RELIABILITY_STANDARD

- Status: CANONICAL
- Owner: EVENTSible
- Applies to: every current or future build that owns a hosted Supabase project
- Canonical source: EVENTSible OS documentation hub

## Required project record

Every Supabase-backed build must record:

1. Owning application and owning repository.
2. Supabase project ID and environment status.
3. Free or paid plan and whether the project may pause.
4. Secure keep-alive route when pause prevention is required.
5. Cron provider and schedule.
6. Exact read-only activity performed.
7. Authentication method.
8. Required environment-variable names without values.
9. Monitoring and failure-notification method.
10. Manual verification procedure.
11. Production activation date.
12. Last verified successful scheduled Production execution.
13. Retirement or disablement procedure.

## Mandatory controls

1. Each application owns its own Supabase credentials. Never consolidate credentials into EVENTSible OS or another hub.
2. Service-role credentials remain server-only and never use public/client variable prefixes.
3. No shared public endpoint may trigger database activity without authorization.
4. Keep-alive activity performs multiple lightweight read-only requests and requires no database writes.
5. Responses, alerts, and logs contain no customer data, secrets, environment values, or raw backend errors.
6. Cron secrets are unique per deployed application when practical.
7. Preview verification proves endpoint behavior only. It does not prove scheduled Production execution.
8. A mechanism remains `IMPLEMENTED / NOT ACTIVE` until a scheduled Production run is verified in provider logs and correlated with genuine Supabase activity.
9. Free-tier keep-alives reduce pause risk; they are not uptime guarantees.
10. Paid Production systems should ultimately use an appropriate paid Supabase plan.
11. Dormant, abandoned, duplicate, test, or historical projects remain unprotected unless Travis separately approves activation.

## Framework-neutral implementation pattern

Use the owning repository's existing server route and Supabase client conventions:

```text
Production scheduler
  -> Authorization: Bearer <application CRON_SECRET>
  -> owning app's server-only keep-alive route
  -> several minimal SELECT/count requests through that app's Supabase client
  -> sanitized 200 or non-200 operational response
  -> provider runtime log and optional existing owner alert
```

The implementation must:

- fail closed when the cron secret is absent;
- compare the complete Authorization header;
- use a dynamic/non-cached server response;
- attempt several safe reads on every authorized run;
- avoid functions, migrations, RLS changes, `SECURITY DEFINER`, and write-only heartbeat tables;
- keep alerting independent of Supabase writes;
- fit the framework and deployment plan actually used by that repository;
- preserve all existing cron jobs and respect provider plan limits.

Do not copy Next.js route code into Vite serverless functions, Supabase Edge Functions, or local-only tools without adapting it to that application's runtime and tests.

## Production-readiness gate

A hosted Supabase build cannot be marked `PRODUCTION READY` or `PRODUCTION VERIFIED` for reliability until its project record answers all of the following:

- Does this build use hosted Supabase?
- Is the Supabase project on a pausable plan?
- Who owns the project and repository?
- Is secure pause prevention required?
- Has the Production schedule been deployed?
- Has at least one scheduled execution been verified?
- Is failure visibility configured?
- Is the project recorded in the ecosystem inventory?
- What is the retirement procedure?

Any unknown answer is `NEEDS VERIFICATION`, not a pass. The application may have other Production-verified features while its Supabase reliability gate remains incomplete.

## Reusable project template

```markdown
### <Application>
- Repository:
- Supabase project ID:
- Environment: Production | Preview | local-only | dormant | historical
- Plan: Free | Pro | Team | Enterprise | unknown
- May pause: yes | no | unknown
- Classification:
- Route:
- Authentication:
- Schedule/provider:
- Read-only requests:
- Required variable names:
- Monitoring/notification:
- Manual verification:
- Production activation date:
- Last scheduled Production success:
- Retirement procedure:
```
