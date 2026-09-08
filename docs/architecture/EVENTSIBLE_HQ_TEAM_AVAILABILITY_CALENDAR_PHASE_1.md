# EVENTSible HQ Team Availability and Shared Master Calendar — Phase 1

- Status: IMPLEMENTED / LOCAL VERIFIED / PREVIEW-SAFE PUBLIC SMOKE VERIFIED
- Owner: EVENTSible OS
- Production impact: none until separately approved migration and application rollout

## Canonical boundaries

`os_events` and the existing calendar dashboard view remain the canonical EVENTSible gig and inquiry records. Personal commitments never create contacts, leads, quotes, bookings, or events.

Phase 1 adds three bounded scheduling records:

- `os_team_members` links one operational team profile to one authenticated `auth.users` identity. Authorization remains in administrator-controlled `app_metadata.role`; the profile is not a role source.
- `os_team_availability` stores outside bookings, unavailable blocks, and vacation/time off as all-day or timed occupied windows.
- `os_staff_assignments` links a team member to a canonical `os_events.id`, with a role and optional call time.

Raw tables are not exposed to `anon` or `authenticated`. Authenticated HQ clients use fixed-purpose RPCs. The shared snapshot RPC redacts titles and always removes private notes for anyone other than the entry owner—including the EVENTSible Owner.

## Permissions

| Capability | Owner | Manager | Staff | Host |
| --- | --- | --- | --- | --- |
| Read shared calendar and privacy-safe busy windows | Yes | Yes | Yes | Yes |
| Read own private entry details | Yes | Yes | Yes | Yes |
| Create, update, or remove own entries | Yes | Yes | Yes | Yes |
| Correct another member's availability window | Yes | No | No | No |
| Manage team operational labels/status | Yes | No | No | No |
| Assign staff to canonical EVENTSible events | Yes | No | No | No |

Unknown authenticated users and signed-out visitors receive no scheduling access. UI visibility is convenience only; every mutation is re-authorized in its Server Action and database RPC.

## Privacy

- `busy_only`: other HQ users receive only the occupied window and Busy/Unavailable label.
- `team_details`: other HQ users may receive the shared title, but never private notes.
- `private`: only the entry owner receives title and private notes. Other authorized HQ users receive only the occupied window and Busy/Unavailable label.

No outside-client contact, location, or provider identifier is collected in Phase 1. Conflict detection uses sanitized occupied windows and is therefore possible without disclosing private details.

## Conflict rules

Timed windows use half-open overlap semantics: an entry ending exactly when another begins is not a conflict. All-day entries occupy each selected local date. Assignment conflicts use the canonical event start/end, optional earlier call time, and recorded setup/breakdown boundaries when they can be derived safely. Missing end or travel information stays Unknown; travel time is never invented.

Managers, Staff, and Hosts receive conflict warnings only for their own schedule. Owners can review team-wide conflicts.

## Deferred phases

Google Calendar OAuth, two-way sync, ICS subscriptions, recurring availability, assignment acceptance, notifications, team chat, payroll, time tracking, equipment assignment, and full call sheets are deferred. A future import contract may use source/external identifiers, but Phase 1 does not store unnecessary provider data.

## Rollout and rollback

Apply `20260908045800_team_availability_calendar_phase_1.sql` before deploying the coupled application. The migration is additive and creates no rows or backfill. Verify Owner and bounded-role RPC behavior before application merge.

Rollback the application to the pre-feature commit first. Revoke and drop the six Phase 1 RPCs, drop the assignment, availability, and team-member tables in that dependency order, then restore the prior `os_has_hq_capability(text)` definition. Capture schema, grants, policies, function definitions, and Phase 1 row counts before rollback; never reset or delete unrelated canonical data.
