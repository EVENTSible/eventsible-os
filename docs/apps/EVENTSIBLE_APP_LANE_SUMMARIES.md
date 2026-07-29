# EVENTSible App Lane Summaries

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: non-primary and planned app lanes
- Supersedes: casual references that treat planned apps as live
- Related documents: `../ecosystem/EVENTSIBLE_ECOSYSTEM_CURRENT_STATE.md`

## Booth Console / KJ Genie

Status: IMPLEMENTED LOCAL FOUNDATION / PARTIAL.

ECC/VINCE contains `apps/booth-console` with local media index/search, MP3+G pairing direction, standalone event/queue recovery, playback adapter contracts, and a local SQLite schema. Tauri/Rust is the intended native shell path, but native build verification remains blocked until Rust/Cargo tooling is installed and tested. VINCE cloud synchronization is planned, not currently production-verified.

## Custom Creations

Status: PLANNED / NEEDS PROTOTYPE LOCATION.

Future `eventsible.shop` should own storefront, products, inventory, mockup packs, customizer, pricing, orders, and admin/production workflows. It should reference OS contact/event IDs for event-related orders.

## Content Factory

Status: PLANNED.

Content Factory should be an OS module using OS event IDs for event-linked media workflows. It must follow review-before-publish. Do not create a separate event database.

## Client Portal / Hero

Status: PARTIAL / PLANNED.

OS contains client portal assets and an auth bridge, but production domain and auth behavior need verification. Public Hero Lite belongs on `eventsible.info`; full booked-client workspace belongs on `client.eventsible.biz`.

## AI Event/Wedding Planner

Status: CONCEPT / PLANNED.

Future planner work can support Event Builder, Client Portal, and OS. It is not currently live and should not be documented as production behavior.

## Legacy Website

Status: LEGACY / BRIDGE.

`www.eventsible574.com` should remain a local trust and SEO bridge into the newer ecosystem. Do not use it as the home for new app architecture.

