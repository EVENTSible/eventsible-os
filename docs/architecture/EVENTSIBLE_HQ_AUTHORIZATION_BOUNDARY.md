# EVENTSible HQ authorization boundary

## Canonical role source

HQ authorization is derived only from the administrator-controlled Supabase Auth `app_metadata.role` claim. `user_metadata` is never an authorization source. Because JWT claims can remain cached until a session refresh, role changes take effect after the affected user refreshes or signs in again.

## Capability policy

`owner` retains all current HQ capabilities. `manager`, `staff`, and `host` share the same deliberately bounded operational set until a future assignment model is approved:

- Read all protected HQ routes and operational records.
- Update fixed event operational timing, event-day logistics, Day-Of Contact, and event-day notes through bounded RPCs.
- Create and update normal tasks.
- Review existing-gig import candidates without finalizing an import.

Only `owner` may change lead lifecycle, approve quotes, convert leads to gigs, activate/invite Wedding Hero clients, sync or create import candidates, finalize imports, change service/planning structure, delete business data, administer staff/roles, or change system configuration.

The TypeScript contract lives in `src/lib/hq-authorization.ts`. The matching SQL contract lives in the ordered HQ authorization migration. Server actions must name the capability they require; UI omission is only a usability layer and never the security boundary.

## Database boundary

Existing broad staff SELECT access is preserved for normal HQ operations. Restrictive RLS policies remove direct write/delete power from Manager, Staff, and Host while preserving existing public/client self-service policies. Bounded operational RPCs remain the write path. Candidate review receives a fixed-field RPC; final import receives an Owner-only wrapper and the old authenticated entry point is revoked.

## Authentication behavior

Signed-out users go to `/login`. Signed-in accounts without a recognized staff role go to `/access-denied`, which explains that access has not been assigned and provides logout. This prevents the former `/login` to `/admin` redirect loop.

## Provisioning

Provisioning remains an Owner/admin operation outside browser code. Create or invite the Auth user using an approved normalized email, then set `app_metadata.role` with a server-side administrative client. Never place a service-role credential in a public bundle. No account creation, invitation, or role change is part of this implementation.

## Rollback

Revert the application commit and apply a reviewed forward migration that drops only the new restrictive policies and wrapper RPCs, restores authenticated execution of `os_import_existing_gig(uuid)`, and removes the three capability helper functions. Rollback must not alter staff accounts or business rows.
