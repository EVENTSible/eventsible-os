# EVENTSible Domain + System Architecture Map

_Last updated: 2026-07-21_

This document is the working source of truth for where each EVENTSible domain, app, product surface, and customer/business flow should live.

## Core Rule

| Domain | Primary Meaning | Audience | Sensitivity |
| --- | --- | --- | --- |
| `www.eventsible574.com` | Legacy local brochure / trust bridge | Public customers | Low |
| `eventsible.info` | Main customer-facing planning and booking website | Public customers / leads | Low to moderate |
| `eventsible.biz` | Private business OS, admin hub, operations, booked-client workspaces | Staff, owners, booked clients | High |
| `eventsible.shop` | Online store + Custom Creations product/order HQ | Public customers, store buyers, internal product ops | Low to moderate |
| `eventsible.app` | VINCE + Booth Console live event app ecosystem | Event guests, hosts, DJs/KJs, staff | Low to moderate, with host-only controls protected |

Simple memory rule:

```text
.info = customers learning, planning, pricing, quoting
.biz  = business running, managing, booking, billing, staffing
.shop = products, custom creations, online orders, merch
.app  = live event technology, VINCE, Booth Console, QR rooms
574   = legacy/local trust bridge
```

## Domain 1: `www.eventsible574.com`

### Role
Legacy / local trust website.

This site should remain alive and familiar. It should not become the heavy platform. It should be updated visually and structurally to match the newer EVENTSible ecosystem while staying simple.

### Public Purpose
- Local South Bend / Northern Indiana trust presence
- Basic service overview
- Reviews and testimonials
- Photos and simple proof of work
- Quick contact
- Bridge links into the new system

### Recommended Links
- Plan Your Event -> `https://eventsible.info`
- Build a Quote -> `https://eventsible.info/build`
- Wedding Hero -> `https://eventsible.info/wedding-hero`
- Event Hero -> `https://eventsible.info/event-hero`
- Shop Custom Creations -> `https://eventsible.shop`
- Client Portal -> `https://portal.eventsible.biz` or final booked-client portal route
- Join Live Event -> `https://join.eventsible.app`

### Should NOT Hold
- Admin data
- Contracts/invoices
- Private client portals
- Staff tools
- Sensitive documents
- Full CRM/GigTracker workflows

## Domain 2: `eventsible.info`

### Role
Main customer-facing EVENTSible website.

This is the modern public front door for planning, pricing, availability, quotes, service deep dives, reviews, corporate credibility, Wedding Hero Lite, Event Hero Lite, and the Event Builder.

### Public Purpose
- Planning
- Pricing
- Availability request
- Quote generation
- Event Builder
- Service education / deep dives
- Reviews and proof
- Corporate/past-client credibility
- Lead capture

### Recommended Top-Level Routes
| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Main EVENTSible public homepage | Planned |
| `/services` | Full service library | Planned |
| `/pricing` | Pricing ranges and packages | Planned |
| `/build` | Event Builder | Built in Lovable repo, needs final placement |
| `/quote` | Quote summary / submit flow | Built in Lovable repo, connected to EVENTSible OS intake |
| `/weddings` | Wedding services hub | Planned |
| `/wedding-hero` | Public Wedding Hero Lite | Planned |
| `/event-hero` | Public Event Hero Lite | Planned |
| `/photo-booths` | Photo booth deep dive | Planned |
| `/karaoke` | Karaoke / Karaoke DJ deep dive | Planned |
| `/t-shirt-bar` | T-Shirt Bar as an event service | Planned |
| `/custom-creations` | Custom Creations event-service overview and bridge to shop | Planned |
| `/corporate` | Corporate, schools, organizations, activations | Planned |
| `/reviews` | Reviews, testimonials, past clients | Planned |
| `/contact` | Inquiry/contact | Planned |

### Public Hero Lite Rule
People who have not officially booked should still be able to use a scaled-down version of Wedding Hero / Event Hero on `eventsible.info`.

Hero Lite is lead-generation and planning assistance. It should avoid private/sensitive booked-client details.

#### Wedding Hero Lite Can Collect
- Couple names
- Wedding date or possible dates
- Venue/city
- Guest count
- Ceremony and reception needs
- Music style
- Must-have moments
- Services of interest
- Budget comfort zone
- Rough timeline
- Planning priorities
- What they still need help with

#### Event Hero Lite Can Collect
- Event type
- Date or possible dates
- Location/city
- Guest count
- Event purpose
- Vibe/theme
- Services of interest
- Entertainment goals
- Setup needs
- Rough schedule
- Budget comfort zone
- Questions/notes

### Public Hero Lite Flow
```text
Visitor uses Hero Lite
  -> EVENTSible OS intake
  -> Contact
  -> Lead
  -> Planning draft / builder facts
  -> Quote opportunity
  -> Follow-up task
```

## Domain 3: `eventsible.biz`

### Role
Private business OS / admin hub.

This is where EVENTSible runs the business: calendars, leads, quotes, booking info, contracts, invoices, booked-client portals, sensitive files, training, staff hub, job board, and internal operations.

### Private Purpose
- Admin dashboard
- GigTracker
- CRM
- Calendar
- Leads
- Quotes
- Bookings
- Contracts
- Invoices
- Sensitive client details
- Booked client portals
- Internal documents
- Staff training
- Helper/assistant job board
- Volunteer and event assistant management

### Recommended Subdomains / Routes
| Subdomain or Route | Purpose | Audience | Sensitivity |
| --- | --- | --- | --- |
| `eventsible.biz` | Private login / business OS home | Staff/admin | High |
| `admin.eventsible.biz` | Admin mission control | Staff/admin | High |
| `gigs.eventsible.biz` | GigTracker / booking pipeline | Staff/admin | High |
| `calendar.eventsible.biz` | Master event calendar | Staff/admin | High |
| `portal.eventsible.biz` | Booked client portals | Booked clients + staff | High |
| `contracts.eventsible.biz` | Contracts and agreements | Staff + booked clients | High |
| `invoices.eventsible.biz` | Invoice/payment tracking | Staff + booked clients | High |
| `staff.eventsible.biz` | Staff hub, training, SOPs | Staff/helpers | High |
| `jobs.eventsible.biz` | Recruiting, assistants, volunteers | Public applicants + staff | Moderate |
| `docs.eventsible.biz` | Internal docs, EIN, insurance, W-9, SOPs | Staff/admin | High |
| `crm.eventsible.biz` | Contacts/leads/follow-up pipeline | Staff/admin | High |

### GigTracker Product Vision
GigTracker is not just a calendar. The long-term vision is EVENTSible's own booking and operations platform, inspired by:

- GigSalad marketplace/lead flow
- Bark, The Knot, Thumbtack, Eventective, The Bash lead channels
- DJ Intelligence planning features
- EventSync event operations concepts
- MixRoster roster/talent/staff coordination concepts

GigTracker should eventually include:

```text
Lead Inbox
Quote Builder
Availability Checker
Booking Pipeline
Contracts
Invoices
Payments
Client Planning Portal
Talent / Staff Roster
Job Assignments
Event Prep Checklist
Review Collection
Client History
Repeat Booking Engine
```

### External Marketplace Data Strategy
Stage 1 should use Gmail-based ingestion because most marketplaces send lead/review/booking notifications by email.

```text
Marketplace email arrives
  -> Gmail rule/label
  -> Parser identifies source, event date, location, service, contact details
  -> EVENTSible OS contact/lead/event created or updated
  -> Original email/thread attached or referenced
  -> Follow-up task created
  -> Source tracked for reporting
```

Later stages can explore direct integrations or APIs where permitted.

## Domain 4: `eventsible.shop`

### Role
Online store + Custom Creations HQ.

This is the product, merch, order, and Custom Creations operations side.

### Public + Ops Purpose
- Online store
- Product catalog
- Custom orders
- Mockup requests
- Event merch
- T-Shirt Bar product/order support
- Vendor season preparation
- DTF/sublimation workflow
- Blank inventory
- Pickup/shipping status

### Recommended Routes
| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Storefront | Planned |
| `/custom-creations` | Custom Creations homepage | Planned |
| `/t-shirt-bar` | T-Shirt Bar product/order side | Planned |
| `/custom-orders` | Custom order intake | Planned |
| `/products` | Product catalog | Planned |
| `/event-merch` | Event merch collections | Planned |
| `/order-status` | Customer order status | Future |
| `/vendor-hq` | Vendor setup/inventory direction | Future/internal |

### T-Shirt Bar Dual-Home Rule
The T-Shirt Bar is both an event service and a shop/product line.

- On `eventsible.info`, it is sold as an event activation/service.
- On `eventsible.shop`, it is managed as a product/order/inventory workflow.

#### `.info` T-Shirt Bar Positioning
- Mobile event activation
- On-site pressing
- Guest keepsakes
- Weddings
- School events
- Corporate events
- Family reunions
- Vendor fairs
- Birthday/graduation parties
- Brand activations

#### `.shop` T-Shirt Bar Positioning
- Product catalog
- Custom apparel
- Mockups
- Orders
- Inventory
- Production queue
- Pickup/shipping

## Domain 5: `eventsible.app`

### Role
VINCE + Booth Console live event technology ecosystem.

This domain has been purchased and should become the permanent home for live event interaction, QR rooms, game modes, karaoke, host controls, screen displays, and DJ/KJ console tooling.

### Product Split
```text
VINCE = cloud/live guest interaction system
Booth Console = local/offline event-day control layer for DJs/KJs/hosts
```

Together:

```text
Guests use VINCE.
Hosts control the room through VINCE.
DJs/KJs run local music/karaoke through Booth Console.
Screens show the shared live experience.
```

### Recommended Subdomains / Routes
| Subdomain | Purpose | Audience | Sensitivity |
| --- | --- | --- | --- |
| `eventsible.app` | VINCE app hub / live event app landing | Public / guests / staff | Low |
| `join.eventsible.app` | QR join flow | Guests | Low |
| `play.eventsible.app` | Guest/player experience | Guests | Low/moderate |
| `host.eventsible.app` | Host controls | Staff/hosts | Moderate/high |
| `screen.eventsible.app` | TV/projector display mode | Public display | Low |
| `karaoke.eventsible.app` | Karaoke signup, queue, singer tools | Guests + hosts | Moderate |
| `games.eventsible.app` | Trivia, surveys, Squad Goals, game modes | Guests + hosts | Moderate |
| `booth.eventsible.app` | Booth Console / DJ-KJ command system | DJs/KJs/staff | High |
| `media.eventsible.app` | Visuals, soundboard, reactions, media engine | Hosts/staff | Moderate/high |

## Repositories

| Repo | Role | Current Notes |
| --- | --- | --- |
| `EVENTSible/eventsible` | Lovable public customer website / Event Builder app | Private repo. Contains the Builder. Quote submit has been connected to EVENTSible OS intake. |
| `EVENTSible/eventsible-os` | Admin/OS/backend docs/Supabase integration source of truth | Public repo. Holds admin shell, OS docs, integration helpers, architecture maps. |
| Future: `EVENTSible/eventsible-interactive` | VINCE live event platform | Recommended eventual repo or project boundary for `.app` ecosystem. |
| Future: `EVENTSible/booth-console` | Standalone Booth Console / KJ tool | May remain under VINCE initially; split when it becomes a downloadable app. |
| Future: `EVENTSible/eventsible-shop` | Custom Creations storefront and order HQ | Recommended if shop app becomes separate from main public site. |

## Customer Journey Map

```text
Customer discovers EVENTSible
  -> eventsible574.com or eventsible.info
  -> reads service pages, reviews, pricing, past-client proof
  -> uses Event Builder or Hero Lite
  -> lead lands in EVENTSible OS
  -> staff reviews in eventsible.biz
  -> quote/contract/invoice generated
  -> booked client receives private portal
  -> planning continues in Hero Pro / Client Portal
  -> event day uses eventsible.app / VINCE / Booth Console
  -> custom products route through eventsible.shop
  -> post-event follow-up, reviews, gallery, referrals
```

## Data Boundary Rules

### Public / Low Sensitivity
Safe for `eventsible574.com`, `eventsible.info`, `eventsible.shop`, and guest-facing `.app` routes:

- Service information
- General pricing ranges
- Reviews and testimonials
- Public corporate client proof
- Non-sensitive inquiry form data
- Hero Lite planning data
- Product catalog
- Public event room codes / join screens

### Private / High Sensitivity
Must live behind `eventsible.biz` auth or protected host/staff controls:

- Contracts
- Invoices
- Deposits/payments
- Client files/uploads
- Private timelines
- Vendor contacts
- VIP/family names
- Staff notes
- Venue access details
- Insurance, EIN, W-9, business docs
- Employee/helper/private training details
- Host-only controls for live events

## Build / Launch Labels

Use these labels consistently:

| Label | Meaning |
| --- | --- |
| Idea | Concept only |
| Built / Not Tested | Code or database exists, but flow has not been verified |
| Internal Testing | Internal test path works; not public |
| Soft Launch | Limited real-world use with controlled clients/events |
| Public Live | Public URL, latest code deployed, tested, mobile checked, no known critical blocker |

No project should be called `live` unless:

- The intended domain/URL is public
- The latest code is deployed
- Auth redirects work
- Test submission works
- Mobile flow works
- Data lands in the right place
- No critical security failures are active

## Immediate Sprint 0 Checklist

- [x] Lock domain roles
- [x] Confirm `eventsible.app` has been purchased for VINCE
- [x] Define Hero Lite vs Hero Pro boundary
- [x] Define T-Shirt Bar dual-home rule
- [ ] Create DNS/subdomain routing sheet
- [ ] Audit current URLs and legacy names (`eventsible574`, temporary Vercel/Lovable URLs)
- [ ] Decide first production subdomains for `.info`, `.biz`, `.shop`, `.app`
- [ ] Confirm which app/project each domain points to
- [ ] Update CORS and auth redirect plans for final domains
- [ ] Triage GitHub security workflow failures before public launch
- [ ] Run full Builder -> EVENTSible OS -> Admin test with latest code
- [ ] Create launch readiness checklist per domain

## Recommended Launch Order

1. `eventsible.info` customer website and Event Builder soft launch
2. `eventsible.biz` Admin/GigTracker/Client Portal internal launch
3. `eventsible.app` VINCE live-event soft launch using a controlled event/demo room
4. `eventsible.shop` Custom Creations storefront/order flow soft launch
5. `www.eventsible574.com` refresh as legacy trust bridge linking into the new ecosystem

## Open Decisions

- Should booked-client portal live at `portal.eventsible.biz` or `client.eventsible.biz`?
- Should `admin.eventsible.biz` and `gigs.eventsible.biz` be separate apps or routes inside one OS shell?
- Should `eventsible.shop` be a separate app/repo or part of the Lovable customer app initially?
- Should VINCE and Booth Console remain together long-term or split into cloud app + local desktop app repos?
- Which domain registrar/DNS provider will control each domain long-term?
- What email addresses should be created per domain? Examples: `hello@eventsible.info`, `bookings@eventsible.biz`, `shop@eventsible.shop`, `support@eventsible.app`.
