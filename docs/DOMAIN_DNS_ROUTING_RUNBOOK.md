# EVENTSible DNS & Deployment Routing Runbook

_Last updated: 2026-07-21_

This runbook turns the domain routing decisions into the exact launch steps needed to connect the public site, business OS, shop, and live-event app domains.

## Locked Canonical Decisions

| Domain | Canonical Use | Repo / App Source | Status |
| --- | --- | --- | --- |
| `eventsible.info` | Public customer website, Event Builder, quote flow, Hero Lite | `EVENTSible/eventsible` / Lovable customer app | Target selected, routing pending |
| `www.eventsible.info` | Redirect alias to `eventsible.info` | Same as above | Redirect pending |
| `eventsible.biz` | Private business OS / admin shell | `EVENTSible/eventsible-os` | Target selected, routing pending |
| `portal.eventsible.biz` | Booked-client portal | `EVENTSible/eventsible-os` or portal app route | Target selected, routing pending |
| `client.eventsible.biz` | Reserved alias only | No primary app | Do not use as canonical |
| `eventsible.shop` | Storefront / Custom Creations / product orders | Shop app TBD | Planned |
| `eventsible.app` | VINCE / Booth Console / live event tech | VINCE app repo outside current visible connector | Planned |

## Current Access Finding

Connected Vercel team found through the Vercel connector:

- Team: `firstfamdjs-5913's projects`
- Team ID: `team_n1QSM4NPq03IdnxCbwD0r7Kr`
- Current visible projects: none

Because the connected Vercel team currently lists zero projects, domain routing cannot be completed from this connector session yet. Before DNS changes, confirm whether the production apps are under a different Vercel team/account, Lovable-managed hosting, or another deployment provider.

## Target Project Mapping Needed

Fill this table before making DNS changes.

| Domain / Subdomain | App Target | Required Project ID / Hosting Target | Needed Before Routing |
| --- | --- | --- | --- |
| `eventsible.info` | Customer app / Event Builder | TBD | Locate actual Lovable/Vercel production target for `EVENTSible/eventsible` |
| `www.eventsible.info` | Redirect to apex | Same as `eventsible.info` | Confirm provider supports redirect rule |
| `eventsible.biz` | EVENTSible OS / admin login | TBD | Locate deployed target for `EVENTSible/eventsible-os` |
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
| `eventsible.info` | Apex/root record to public customer app | Final value must come from hosting provider inspection |
| `www.eventsible.info` | Redirect/CNAME alias to public app | Must redirect to `https://eventsible.info` |
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

## Next Actions

1. Confirm where the actual production apps are deployed: Vercel team/account, Lovable, or another host.
2. If Vercel: make sure the connected account can see the relevant projects.
3. Add `eventsible.info` to the customer app project and inspect DNS requirements.
4. Add `eventsible.biz` to the OS/admin project and inspect DNS requirements.
5. Decide whether `portal.eventsible.biz` is a route inside the OS app or separate project.
6. Update this runbook with final DNS records after provider inspection.
