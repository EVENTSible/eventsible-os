# EVENTSible Opportunity Desk release checkpoint

Source branch `codex/hq-team-followups-20261118` extends the exact PR #51 source tree (`d5713212837aec75ceb7ea784702e485bea6abb4`) and the previously committed Follow-Up Board (`3495d9c`). PR #51 remains draft and unchanged. This document describes a source-only proposal; the new migration has not been applied to Production.

## One HQ workflow

- Owner opens `/admin/mission-control/follow-ups/new`, pastes the original inquiry or uploads a screenshot, verifies event details, enters the actual sent or draft quote and chooses a team member and due date.
- GigSalad intake requires a validated original conversation URL. The canonical lead holds the stable reference; a partial unique index prevents a second lead for the same URL. Existing contact/open-lead matches prompt review rather than automatic duplicates.
- One `os_create_opportunity` database transaction creates the contact (if new), inquiry event, lead, optional quote version, follow-up task, private activity, and screenshot file record. A missing uploaded screenshot or failed validation rolls back all database records. A private object can remain without a record after an ambiguous network failure; retry with the same form operation ID to finish safely.
- The screenshot is stored in the proposed `opportunity-evidence` bucket, private to HQ staff, with a 5 MB limit, supported raster formats and a staff-only `os_files` record. Existing `event-private` permits event members, so it is not appropriate for source screenshots. No public URL is stored. Board links expire after one minute. Evidence is retained with the opportunity pending an Owner-approved retention policy.
- Team members see open leads and verified quote status, claim unassigned follow-ups, save private notes/drafts/attempts, schedule next dates and complete tasks. The database function serializes the lead and operation, then commits lead/task and activity together. No GigSalad message is sent.

## Release gates

Apply `20261118100000_opportunity_desk.sql` only after separate Production schema authorization, index preflight and isolated DB concurrency/role tests. A deployed page without this migration fails closed on writes. Before any live intake, obtain separate approval for the exact customer inquiry and record creation. Preview testing must use noncustomer test data, Owner/Manager/Staff accounts and a protected HQ deployment. Production merge/promotion remains a separate decision.

AI extraction and recommendations are not enabled. The form uses Owner-verified manual facts and existing quote records. Model provider, API credentials, per-use cost and budget limits still require a separate design and approval.
