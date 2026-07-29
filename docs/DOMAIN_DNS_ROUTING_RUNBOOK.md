# EVENTSible DNS & Deployment Routing Runbook

_Last updated: 2026-07-21_

> Current canonical note, recorded 2026-07-29: Cross-system domain decisions are now governed by `docs/ecosystem/EVENTSIBLE_DOMAIN_AND_APP_INDEX.md` and `docs/decisions/EVENTSIBLE_DECISION_LOG.md`. Where this historical runbook conflicts with those documents, the canonical hub supersedes it. In particular, `client.eventsible.biz` is now the planned booked-client portal lane, while `portal.eventsible.biz` is historical or transitional until manually confirmed.

This runbook turns the domain routing decisions into the exact launch steps needed to connect the public site, business OS, shop, and live-event app domains.

## Locked Canonical Decisions

| Domain | Canonical Use | Repo / App Source | Status |
| --- | --- | --- | --- |
| `eventsible.info` | Public customer website, Event Builder, quote flow, Hero Lite | `EVENTSible/eventsible` / Lovable customer app | Target selected, routing pending; app unfinished |
| `www.eventsible.info` | Redirect alias to `eventsible.info` | Same as above | Hold until public app is ready |
| `eventsible.biz` | Private business OS / admin shell | `EVENTSible/eventsible-os` | Primary deployment target |
| `portal.eventsible.biz` | Booked-client portal | `EVENTSible/eventsible-os` or portal app route | Target selected, routing pending |
| `client.eventsible.biz` | Reserved alias only | No primary app | Do not use as canonical |
| `eventsible.shop` | Storefront / Custom Creations / product orders | Shop app TBD | Planned |
| `eventsible.app` | VINCE / Booth Console / live event tech | VINCE app repo outside current visible connector | Planned; user believes Vercel-hosted |

## Current Access Finding

Connected Vercel team found through the Vercel connector:

- Team: `firstfamdjs-5913's projects`
- Team ID: `team_n1QSM4NPq03IdnxCbwD0r7Kr`
- Current visible projects: none

Because the connected Vercel team currently lists zero projects, domain routing cannot be completed from this connector session yet. Before DNS changes, confirm whether the production apps are under a different Vercel team/account, Lovable-managed hosting, or another deployment provider.

## 2026-07-21 Deployment Attempt Status

Attempted from this ChatGPT/Vercel connector session:

- Retrieved the EVENTSible OS Supabase URL via the Supabase connector.
- Retrieved active publishable Supabase keys via the Supabase connector.
- Confirmed `EVENTSible/eventsible-os` is a Next.js app with `npm run build` mapped to `next build`.
- Confirmed the connected Vercel team currently exposes no existing projects.
- Tried the connected Vercel deploy tool; it requires a direct file deployment payload (`target`, `name`, and `files`) and does not import a GitHub repo by name from this session.
- Tried cloning the public GitHub repo into the runtime; the container cannot resolve `github.com`, so it cannot build a file payload from the repo locally.

Result: direct deployment from this session is blocked by tool/runtime limitations, not by the app configuration. The next deploy path is a Vercel Dashboard GitHub import of `EVENTSible/eventsible-os`, or connecting a Vercel account/team where the project is visible to this connector.

## Target Project Mapping Needed

Fill this table before making DNS changes.

| Domain / Subdomain | App Target | Required Project ID / Hosting Target | Needed Before Routing |
| --- | --- | --- | --- |
| `eventsible.info` | Customer app / Event Builder | TBD | Finish Lovable app before routing |
| `www.eventsible.info` | Redirect to apex | Same as `eventsible.info` | Hold until `eventsible.info` app is ready |
| `eventsible.biz` | EVENTSible OS / admin login | Vercel GitHub import target for `EVENTSible/eventsible-os` | Import/deploy repo, then inspect DNS requirements |
| `portal.eventsible.biz` | Booked-client portal | TBD | Decide if portal is route inside OS or separate project |
| `eventsible.shop` | Shop / Custom Creations | TBD | Locate/restore shop app |
| `eventsible.app` | VINCE live event hub | TBD | Locate VINCE production Vercel/project target |

## Vercel Routing Flow

Use this flow only after the real Vercel project is visible in the connected account/team.

1. Add the domain to the correct Vercel project.
2. Inspect the domain in Vercel to get exact DNS requirements.
3. Add DNS records at the registrar or DNS provider.
4. Re-inspect the domain until Vercel marks it configured.
5. Confirm SSL is issued.
6. Smoke-test the actual route.
7. Update this runbook with the final DNS records and verification result.

Do not blindly hard-code generic DNS records until Vercel/project-specific instructions are visible. Vercel’s docs show common defaults, but the correct record should be taken from the domain inspection result.

## Expected DNS Intent

| Domain | Record Intent | Notes |
| --- | --- | --- |
| `eventsible.info` | Apex/root record to public customer app | Hold until the Lovable/customer app is finished |
| `www.eventsible.info` | Redirect/CNAME alias to public app | Must redirect to `https://eventsible.info` when app is ready |
| `eventsible.biz` | Apex/root record to business OS | Must land on login/admin shell, not public marketing site |
| `portal.eventsible.biz` | CNAME/subdomain to portal target | Must require auth before exposing booked-client data |
| `eventsible.shop` | Apex/root record to shop target | Keep custom order data protected as needed |
| `eventsible.app` | Apex/root or hub route to VINCE | Guest routes can be public; host/booth routes must be protected |

## Supabase / API Allow-List Changes

After routing is staged, update the relevant CORS/auth configuration:

- Add `https://eventsible.info`
- Add `https://www.eventsible.info` only long enough to support redirects or direct traffic
- Add `https://eventsible.biz`
- Add `https://portal.eventsible.biz`
- Add `https://eventsible.shop` only if shop orders call EVENTSible OS intake
- Add `https://eventsible.app` and selected subdomains only when VINCE calls protected APIs
- Remove temporary preview origins after public launch

## Required Smoke Tests

### `eventsible.info`

- Homepage loads.
- `/build` loads Event Builder.
- `/quote` loads quote summary.
- Builder submission reaches EVENTSible OS intake.
- Confirmation or next-step messaging appears for the client.

### `eventsible.biz`

- Login/admin shell loads.
- Unauthorized visitors cannot access admin data.
- GigTracker / lead intake / quote intake views are available to approved users.

### `portal.eventsible.biz`

- Booked client portal requires auth or secure link.
- Client sees only their own event data.
- Contracts, invoices, planning docs, and files are not public.

### `eventsible.app`

- Guest join route works by QR.
- Player route works by room code.
- Host route requires host PIN or auth.
- Screen route works on display devices.
- Booth/host controls are not public.

## Manual Vercel Import Steps For `eventsible.biz`

Use this if the connector still cannot see or create the project directly:

1. Open Vercel Dashboard.
2. Choose the correct team/account for EVENTSible production deployments.
3. Import Git Repository: `EVENTSible/eventsible-os`.
4. Framework preset: Next.js.
5. Install command: `npm install`.
6. Build command: `npm run build`.
7. Add environment variables for Preview and Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
8. Deploy preview.
9. Test `/api/health`, `/login`, and `/admin`.
10. Add `eventsible.biz` after preview QA.
11. Inspect Vercel's exact DNS requirements before changing registrar DNS.
12. Update Supabase Auth URL configuration after the domain is routed.

## Next Actions

1. Import/deploy `EVENTSible/eventsible-os` in Vercel Dashboard or reconnect the Vercel team that can manage projects.
2. Add the Supabase public env vars to Preview and Production.
3. Smoke-test the generated Vercel preview URL.
4. Add `eventsible.biz` to the deployed OS/admin project and inspect DNS requirements.
5. Decide whether `portal.eventsible.biz` is a route inside the OS app or separate project.
6. Keep `eventsible.info` parked until the Lovable customer app is finished.
7. Locate VINCE's Vercel project for `eventsible.app`.
8. Update this runbook with final DNS records after provider inspection.
