# EVENTSible Domain Routing Sheet

_Last updated: 2026-07-21_

This file turns the domain architecture into a practical setup checklist. Use this before configuring DNS, CORS, auth redirects, deployments, or public links.

## Canonical Domain Decisions

These decisions are locked for initial launch so DNS, redirects, auth callbacks, CORS, and public links can be configured consistently.

| Decision | Locked Choice | Notes |
| --- | --- | --- |
| Public customer canonical domain | `https://eventsible.info` | Use apex as the main public/customer URL. |
| Public `www` behavior | `https://www.eventsible.info` redirects to `https://eventsible.info` | Keep `www` available for users who type it, but do not use it as the canonical URL. |
| Business/admin canonical domain | `https://eventsible.biz` | Main protected EVENTSible OS/admin entry. |
| Booked-client portal canonical domain | `https://portal.eventsible.biz` | Use this for booked-client portal, planning hub, contract/invoice status, and Hero Pro experiences. |
| Alternate client portal domain | `https://client.eventsible.biz` | Reserved alias only; do not use as the primary launch URL. |
| Storefront canonical domain | `https://eventsible.shop` | Custom Creations/storefront/product side. |
| Live event tech canonical domain | `https://eventsible.app` | VINCE, Booth Console, QR guest flows, host/screen routes. |

## Status Labels

| Status | Meaning |
| --- | --- |
| Planned | Defined, not configured |
| Built / Not Routed | App or code exists, domain not connected |
| DNS Pending | Domain/subdomain selected, DNS not complete |
| Internal Testing | Routed or testable internally, not public launch |
| Soft Launch | Limited public use |
| Public Live | Fully launched and verified |

## Root Domains

| Domain | Role | Audience | Platform/App | Repo/Source | Sensitivity | Current Status | Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `www.eventsible574.com` | Legacy brochure / local trust bridge | Public customers | Existing website | Legacy site | Low | Existing / needs refresh | Audit current content, update design/copy, add links to new ecosystem |
| `eventsible.info` | Canonical public customer website, planning, pricing, Event Builder, Hero Lite | Public customers/leads | Lovable customer app initially | `EVENTSible/eventsible` | Low/moderate | Built / Not Routed | Route apex as canonical, redirect `www`, verify Builder flow, replace temporary URLs |
| `eventsible.biz` | Canonical Business OS, admin, GigTracker, booked portals, docs, staff hub | Staff/admin/booked clients | EVENTSible OS app | `EVENTSible/eventsible-os` | High | Built / Not Routed | Route admin/business OS, configure `portal.eventsible.biz`, auth redirects |
| `eventsible.shop` | Canonical storefront + Custom Creations HQ | Public buyers/internal product ops | Future shop app or Lovable shop app | TBD | Low/moderate | Planned | Locate/restore Custom Creations Lovable app, decide repo/platform |
| `eventsible.app` | Canonical VINCE + Booth Console live event system | Guests/hosts/DJs/KJs | VINCE / Booth Console | Current VINCE repo outside visible GitHub connector | Low to high by route | Purchased / Not Routed | Pick DNS pattern, route VINCE app, protect host/booth routes |

## `eventsible.info` Routing Plan

| URL | Purpose | Audience | App/Route | Sensitivity | Status | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| `eventsible.info` | Canonical main public homepage | Public | Customer site | Low | DNS Pending | Route apex to customer app and use in all public links |
| `www.eventsible.info` | Public homepage alias | Public | Redirect only | Low | DNS Pending | Redirect permanently to `https://eventsible.info` |
| `eventsible.info/build` | Event Builder | Public leads | Lovable `/build` | Moderate | Built / Not Routed | Route to Lovable app and verify latest GitHub code |
| `eventsible.info/quote` | Quote summary / submit | Public leads | Lovable `/quote` | Moderate | Built / Not Routed | Verify submit reaches OS intake under final origin |
| `eventsible.info/wedding-hero` | Wedding Hero Lite | Public leads | Customer site | Moderate | Planned | Build scaled-down pre-booking form |
| `eventsible.info/event-hero` | Event Hero Lite | Public leads | Customer site | Moderate | Planned | Build scaled-down pre-booking form |
| `eventsible.info/services` | Service library | Public | Customer site | Low | Planned | Create deep service content |
| `eventsible.info/pricing` | Pricing/package guide | Public | Customer site | Low | Planned | Add ranges and bundle explanations |
| `eventsible.info/t-shirt-bar` | T-Shirt Bar as event service | Public leads | Customer site | Low/moderate | Planned | Create service page and quote CTA |
| `eventsible.info/custom-creations` | Custom Creations as event service | Public leads | Customer site | Low/moderate | Planned | Bridge to `eventsible.shop` |
| `eventsible.info/reviews` | Reviews/past clients | Public | Customer site | Low | Planned | Pull reviews/testimonials |
| `eventsible.info/corporate` | Corporate/school/org credibility | Public | Customer site | Low | Planned | Add past clients and packages |
| `eventsible.info/contact` | Contact/inquiry | Public | Customer site/intake | Moderate | Planned | Connect to OS lead intake |

## `eventsible.biz` Routing Plan

| URL | Purpose | Audience | App/Route | Sensitivity | Status | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| `eventsible.biz` | Canonical private business OS entry/login | Staff/admin | EVENTSible OS | High | DNS Pending | Route to admin shell or login |
| `admin.eventsible.biz` | Admin mission control | Staff/admin | EVENTSible OS | High | Planned | Optional alias/subdomain after apex is routed |
| `gigs.eventsible.biz` | GigTracker / booking pipeline | Staff/admin | EVENTSible OS | High | Planned | Build/route GigTracker dashboard |
| `crm.eventsible.biz` | Leads/contacts/follow-up | Staff/admin | EVENTSible OS | High | Planned | Build CRM view or route alias |
| `calendar.eventsible.biz` | Master event calendar | Staff/admin | EVENTSible OS | High | Planned | Add calendar route/alias |
| `portal.eventsible.biz` | Canonical booked-client portal | Booked clients/staff | Client portal | High | DNS Pending | Configure portal route, Supabase auth redirects, and booked-client access rules |
| `client.eventsible.biz` | Reserved booked-client portal alias | Booked clients/staff | Redirect/alias only | High | Reserved | Do not use as primary launch URL; optionally redirect to `portal.eventsible.biz` |
| `contracts.eventsible.biz` | Contracts/agreement status | Clients/staff | EVENTSible OS | High | Planned | Build contract module |
| `invoices.eventsible.biz` | Invoice/payment tracking | Clients/staff | EVENTSible OS | High | Planned | Build invoice/payment module |
| `staff.eventsible.biz` | Staff hub/training/SOPs | Staff/helpers | EVENTSible OS | High | Planned | Build staff area |
| `jobs.eventsible.biz` | Recruiting/job board/helpers | Public applicants/staff | Public + admin workflow | Moderate | Planned | Build public job form + staff review flow |
| `docs.eventsible.biz` | Internal docs, EIN, insurance, W-9 | Staff/admin | EVENTSible OS/Drive bridge | High | Planned | Organize protected business docs |

## `eventsible.shop` Routing Plan

| URL | Purpose | Audience | App/Route | Sensitivity | Status | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| `eventsible.shop` | Canonical storefront | Public buyers | Shop app TBD | Low | Planned | Decide platform/repo |
| `eventsible.shop/custom-creations` | Custom Creations HQ | Public/custom order customers | Shop app TBD | Moderate | Planned | Restore/locate Lovable app |
| `eventsible.shop/t-shirt-bar` | T-Shirt Bar product/order side | Public buyers/event customers | Shop app TBD | Moderate | Planned | Connect event service page to product/order workflow |
| `eventsible.shop/custom-orders` | Custom order intake | Public buyers | Shop app TBD | Moderate | Planned | Build order intake |
| `eventsible.shop/products` | Product catalog | Public buyers | Shop app TBD | Low | Planned | Add products/collections |
| `eventsible.shop/event-merch` | Event merch collections | Public buyers/events | Shop app TBD | Moderate | Planned | Build merch collection system |
| `eventsible.shop/order-status` | Order tracking | Customers | Shop app TBD | Moderate/high | Future | Requires customer/order auth |
| `eventsible.shop/vendor-hq` | Vendor inventory/setup | Internal/product ops | Shop app TBD | High | Future | Could be private route |

## `eventsible.app` Routing Plan

| URL | Purpose | Audience | App/Route | Sensitivity | Status | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| `eventsible.app` | Canonical VINCE app landing/hub | Public/guests/staff | VINCE | Low | Purchased / Not Routed | Route to VINCE landing or hub |
| `join.eventsible.app` | Guest QR join | Guests | VINCE `/join` | Low | Planned | Route and test QR flow |
| `play.eventsible.app` | Player/guest room | Guests | VINCE `/play/:roomCode` | Moderate | Planned | Route and test room flow |
| `host.eventsible.app` | Host controls | Staff/hosts | VINCE host routes | High | Planned | Protect with host PIN/auth |
| `screen.eventsible.app` | Display/screen mode | Public display | VINCE screen routes | Low | Planned | Route and test TV/projector view |
| `karaoke.eventsible.app` | Karaoke signup/queue tools | Guests/hosts | VINCE/Karaoke | Moderate | Planned | Define route mapping |
| `games.eventsible.app` | Trivia/game modes | Guests/hosts | VINCE games | Moderate | Planned | Define route mapping |
| `booth.eventsible.app` | Booth Console / DJ-KJ command system | DJs/KJs/staff | Booth Console | High | Planned | Decide cloud vs local bridge route |
| `media.eventsible.app` | Media/effects/soundboard | Hosts/staff | VINCE media engine | Moderate/high | Planned | Protect host-only actions |

## DNS / Auth / CORS Worklist

### DNS
- [ ] Confirm registrar for each domain
- [ ] Choose DNS manager/provider
- [ ] Add apex/root records for each active domain
- [ ] Add `www` records where needed
- [ ] Add subdomain records for `.biz`, `.app`, `.shop`
- [ ] Document exact records after setup

### Supabase Auth Redirects
- [ ] Add `https://eventsible.biz`
- [ ] Add `https://portal.eventsible.biz`
- [ ] Add final Builder URL(s) only if auth is needed
- [ ] Remove obsolete preview URLs after launch

### CORS / Intake Allow-List
- [ ] Add `https://eventsible.info`
- [ ] Add `https://www.eventsible.info` only if redirects or direct submissions are temporarily allowed
- [ ] Add any final Lovable/Vercel preview origins for internal testing only
- [ ] Add `https://eventsible574.com` only if it directly submits into OS
- [ ] Add `https://eventsible.shop` if custom orders use OS intake
- [ ] Add `.app` routes only if guest/host tools call protected APIs
- [ ] Remove temporary origins after public launch

### Security Boundaries
- [ ] Hero Lite routes must avoid sensitive booked-client data
- [ ] Hero Pro / booked portal must require auth
- [ ] Host/booth routes must require host PIN or auth
- [ ] Contracts/invoices/files must remain on `.biz` behind auth
- [ ] Store/order status must avoid exposing private order details without auth

## Immediate Next Actions

1. Confirm `EVENTSible/eventsible` Security workflow remains stable after commit `5566843`.
2. Route `eventsible.info` apex to the public customer app and redirect `www.eventsible.info` to apex.
3. Route `eventsible.biz` to EVENTSible OS/admin login.
4. Configure `portal.eventsible.biz` as the booked-client portal and add Supabase auth redirects.
5. Verify Lovable preview is serving the latest GitHub customer-site code.
6. Test Builder -> EVENTSible OS -> Admin using `https://eventsible.info` once routed.
7. Route `eventsible.app` to VINCE after DNS/project target is confirmed.
8. Locate/restore the Custom Creations Lovable app for `eventsible.shop`.
9. Refresh `eventsible574.com` as the legacy trust bridge.
