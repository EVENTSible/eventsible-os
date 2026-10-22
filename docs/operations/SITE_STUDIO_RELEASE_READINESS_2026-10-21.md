# Site Studio / Public Website — Controlled Release Readiness
**Review date:** 2026-10-21  
**Status:** **PARTIAL — NO GO for Production merge or deployment**  
**Authority:** current GitHub PR source and GitHub/Vercel Production/deployment evidence; canonical ecosystem ownership from `docs/README.md` and `docs/ecosystem/EVENTSIBLE_FULL_SCOPE_REFRESH_2026-08-24.md`.

This is a release assessment, not approval for any production changes.

## Source and deployment baseline verified

| Lane | Repo / branch | Production commit | Production deployment | Draft |
|---|---|---|---|---|
| HQ/OS `eventsible.biz` | `EVENTSible/eventsible-os` / `main` | `c9aed02eeb96c71f84dd336400cfbfc50d0496b4` | `dpl_GBWt9twCj87MmMQh4JAqzdygvYXY` (READY) | [#50](https://github.com/EVENTSible/eventsible-os/pull/50) |
| Public `eventsible.info` | `EVENTSible/eventsible` / `main` | `26a49f80bd47b68920d9c78cd4345545bafc2d9e` | `dpl_6hrXt2ouaYp3iaDy6m5oVdS9FUQb` (READY) | [#5](https://github.com/EVENTSible/eventsible/pull/5) |
| Builder `build.eventsible.info` | same `EVENTSible/eventsible` / `main` | `26a49f80bd47b68920d9c78cd4345545bafc2d9e` | `dpl_GdQPEB2geX2h7ur2Muvpdfy87Q7Q` (READY) | shared-repository blast radius |

**Production branch protection:** the two draft PRs are unmerged. They have clean base ancestry as inspected with GitHub compare, but no local developer worktree or untracked-file condition was directly inspected. Verify that again immediately before any merge. Do **not** treat Vercel's READY status as proof of authenticated editor or cross-app browser functionality.

### Implemented / tested

- **IMPLEMENTED:** OS Owner-only Site Studio edits Classic and Power Mode copy, preserves an approved-media queue, saves drafts, publishes/reverts revisions; public site consumes a restricted published projection with fallback. Guest routes, Builder quote/lead ownership, and VINCE guest destination remain source-owned.
- **IMPLEMENTED:** four owner-permission-cleared photo derivatives in the draft website code, used by the Classic homepage and Media page. Their private Drive originals were not published or moved. Review video clips remain unpublished.
- **VERIFIED IN DISPOSABLE LOCAL CI:** [two-app run 39554501627](https://github.com/EVENTSible/eventsible/actions/runs/39554501627) passed real OS→public-site published-content read, Power + Classic UI, actual image loads, protected Builder/VINCE destinations, API outage fallback, cleanup/controlled dev-only side effects.
- **PASS at website PR head before this document review:** [public verification 39554501555](https://github.com/EVENTSible/eventsible/actions/runs/39554501555) and [security 39554501671](https://github.com/EVENTSible/eventsible/actions/runs/39554501671).
- **HQ functional validation:** isolated schema/RLS, Owner browser and app build pass on previous HQ PR head; its overall workflow still fails the strict audit. A follow-up production-only audit gate was added to differentiate shipped runtime exposure from development-tool findings. Its outcome must be verified from its exact CI run before claiming runtime clearance.

## Explicit unresolved release blockers

1. **HQ security:** `GHSA-vfj7-8cjw-p6xm` for `braces@3.0.3`, reached through `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch`. GitHub reviewed advisory says **no patched version** as of this review. Existing `npm audit --audit-level=high` is **still required** and fails. The newer `npm audit --omit=dev --audit-level=high` is additive evidence, **not** an automatic waiver. Decide whether to hold release for upstream remediation or submit a narrow, expiring **development-only** exception for separate explicit Owner approval after confirming packaged-runtime absence.
2. **Exact HEAD Preview:** website Vercel status at reviewed draft HEAD reports `build-rate-limit`, not READY. Most recent **READY** website Preview `dpl_7gs6khT2HCzETnGQopHFkyXF4crZ` used the *older* commit `1500d38e4e713cbcc6233b91375789ca1c071197`; it does **not** certify draft HEAD `ad812524d799b148414069580f9a2a74e2c81a77`. Wait for Vercel allowance / resolve through authorized plan settings without upgrading, retrying blindly, or releasing by assumption.
3. **Hosted HQ editor dependency:** reviewed `supabase/proposals/20261020_site_studio_v1.sql` is NOT in Production migration history and must not be applied without a separate schema/data approval gate. Supabase Free database branching was denied without Pro; user chose **remain on Free**. Hosted HQ Preview therefore lacks confirmed schema. Vercel environment variable inventory requests returned 403; no guesswork or key copying.
4. **Live operational readiness:** separately verify Owner login, edit/save/publish/rollback on the *actual approved release* against authorized test data, the published API from the site origin (including CORS), responsive/mobile QA, browser/network console, and that page fetch never exposes raw revisions, Drive IDs, business/guest records, private URLs, PINs, or service-role credentials.
5. **Shared site/Builder main:** merging website PR #5 advances the source branch for *both* Vercel projects. Require independent Builder smoke tests for `/build` calculation and contact/lead submission, plus Wedding Hero links and public/Builder route separation. No duplicate CRM or pricing logic is permitted.
6. **Content approval:** public photos are within the Owner's stated permission for the people depicted. Confirm appropriateness of background subjects, product/trademark exposure, and final placement before Production release; specific video footage/music usage remains NEEDS VERIFICATION.

## Vercel plan compliance — additional release check

Vercel's [current Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) and [Hobby Plan documentation](https://vercel.com/docs/plans/hobby) restrict Hobby to **non-commercial personal use**. EVENTSible's sites and Builder support a commercial event-entertainment business. Current Vercel team billing tier could **not** be verified by the accessible `get_team` response (it omitted plan/billing). GitHub's Vercel status linked to `upgradeToPro=build-rate-limit` but that link alone does not authoritatively establish the active subscription.

**NEEDS VERIFICATION before Production release:** have the authorized Owner inspect Vercel team Settings → Billing for the plan and its permitted use. If Hobby, obtain owner approval for a compliant commercial hosting solution or authorized plan change; no paid upgrade, subscription or domain move is preapproved. This is distinct from the owner's decision to remain on **Supabase Free**.

## Proposed sequence with independent approval gates

1. **Preview QA only:** pin exact OS and site draft SHAs, recheck package names/remotes, `AGENTS.md`, Vercel project links, merge bases, worktree cleanliness, presence (not values) of required Preview env names, and source/Production diff. Do not modify unrelated local work.
2. Re-run `npm ci`, tests, lint, type check, build, `npm audit --audit-level=high`, production-only dependency audit, secret scan, isolated Supabase RLS/advisors, and the two-app browser harness. Record PASS/FAIL individually. Never run `npm audit fix`.
3. **Review schema proposal:** examine `SECURITY DEFINER` RPC authorization, schema qualification and function grants, RLS policy ownership, media public URL validation, publication atomicity and rollback. Confirm every read projection exposes only published, approved data. Prepare schema migration in normal repository ledger for review, but **do not apply** until a specific Owner schema/Production approval.
4. **Separate schema/data approval required:** apply approved OS schema at a controlled window with database backup/restore evidence; ensure no customer/QA/test records enter Production. Preserve OS as only business-media metadata owner.
5. **Separate merge/Production approvals required:** after release security resolution and exact HEAD Preview browser pass, merge/deploy HQ first and validate public published API; promote website after separately checking both `eventsible-info` and `eventsible-event-builder` against the same approved SHA. Never merge on this document's authority.
6. **Rollback plan:** maintain exact prior Vercel READY deployment IDs above; use Vercel's supported deployment rollback/promotion only after approved action-time authorization. Roll back public consumer source independently of HQ where possible; keep business data/media intact. For content changes, publish a known-good prior revision instead of deleting records. Do not drop Site Studio tables to roll back code.
7. **Structured report-back:** SHA/branch/worktree cleanliness, exact Vercel targets, environment-name presence only, browser QA/results, dependency audit findings, remaining issues, remediation/owner approval record, and the evidence URLs.

**Decision required before Production:** whether to accept a time-limited, development-only `braces` security exception (only after runtime non-exposure proof) or wait for a patch; separately approve OS Production schema and each merge/deployment. These approvals are NOT implied by permission to continue preparation.

## SQL publishing security review (source inspection, 2026-10-21)

- **IMPLEMENTED:** `os_site_content_revisions` allows one published revision per `page_key`, with constrained `page_key='home'`. Publication serializes with an advisory transaction lock and archives the previous published record atomically.
- **IMPLEMENTED:** Owner-only checks are applied in authenticated server actions and the publishing/candidate-intake RPCs. Authorization uses JWT `app_metadata.role` and `auth.uid()`, not client-editable `user_metadata`. No direct anonymous table grants; authenticated draft write has insert-only RLS, while media candidates cannot self-approve.
- **IMPLEMENTED:** The public API uses server-side read-only projection from the published revision. Only approved media URLs and bounded public fields are emitted, with CORS response for cross-origin website consumption. Local CI now additionally asserts the absence of candidate Drive IDs, unpublished revisions, raw metadata flags, user identifiers and service-role field names in its exact API response.
- **REVIEW REMAINING:** The SQL is a proposal, not a reviewed production migration. Confirm latest Production migration order, `search_path`/EXECUTE role grants for the SECURITY DEFINER functions, media URL policy (credentials, fragments, query tokens, subdomain spoofing), schema advisor results and safe revision rollback. Production approval cannot be inferred from local successful fixture tests.

## Current approval packet and decision boundaries (October 21, 2026)

**The owner requested readiness preparation, not authorization to merge, write Production schema, or incur charges.** The release remains **NO GO** until checks explicitly marked NEEDS VERIFICATION are resolved.

| Gate | Status | Release authority |
|---|---|---|
| Exact public/HQ local two-app synthetic DB/browser connection | **PASS** on run 39554501627; additional public-projection privacy regression run pending | none |
| Website unit/integration/security tests | **PASS** on run 39554501555 / 39554501671; newest source run pending | none |
| HQ production-only `npm audit --omit=dev --audit-level=high` | **PASS**, 0 vulnerabilities, run 39654465172 | none |
| HQ full dependency `npm audit --audit-level=high` | **FAIL**, 5 high findings in one dev-tool chain | explicit scoped exception or fixed upstream and green rerun |
| Authenticated Owner editor / Staff forbidden / RLS / publish rollback | **PASS** isolated local CI; still needs hosted verification | none |
| Exact latest website commit hosted Vercel Preview | **BLOCKED** by `build-rate-limit`, no verified READY deployment at that SHA | no implicit approval to upgrade |
| Event Builder from shared website repository | Contract/navigation tests **PASS** locally; full hosted Builder booking/quote smoke **NEEDS VERIFICATION** | none |
| Live Site Studio database proposal | **NOT APPLIED**; normal migration review and rollback rehearsal need final approval | separate Owner schema approval |
| Site Studio content and imagery | four real photo derivatives owner-cleared for pictured people; hosted publication/placement **NEEDS VERIFICATION** | separate Owner media release approval |
| Vercel commercial hosting | **Owner confirmed team Hobby**; commercial-use restriction requires separate compliant hosting decision | owner hosting decision, no auto-upgrade |
| Production merge / deploy | **NOT APPROVED**, both PRs drafts | explicit Owner merge/deploy approval |

**Candidate release sequence:** (1) keep both PRs draft while resolving blockers, (2) security disposition, (3) exact-HEAD website + Builder Preview QA, (4) reviewed schema migration for explicit approval, (5) separately approved HQ deploy + safe verification, (6) separately approved website and Builder release + smoke tests, (7) report actual rollout/rollback evidence.

**No new account, paid plan, DNS change, production DB write, PR merge, or customer/real event testing is part of this readiness step.**

## Current exclusions

No Production database writes, DNS, domain routing, paid Supabase upgrades, Host PIN, active ECC rooms, contacts/leads/bookings, service-role disclosures, destructive Drive actions, or automated Production deployments.
