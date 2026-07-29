# EVENTSible Shared Architecture

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: cross-app architecture
- Supersedes: plans that merge public Builder, OS, and live VINCE state into one app
- Related documents: `EVENTSIBLE_DATA_FLOW_OVERVIEW.md`, `EVENTSIBLE_AUTH_AND_SECURITY_BOUNDARIES.md`

EVENTSible uses separate app lanes with explicit handoffs:

- Public discovery and estimating live in the Event Builder/public website lane.
- Business records, quotes, bookings, staffing, equipment, tasks, contracts, payments, and automation live in EVENTSible OS.
- Live rooms, player interactions, audience displays, karaoke queues, games, scores, and show control live in ECC/VINCE.
- Client Portal reads and updates client-scoped OS data.
- Content Factory is an OS module using the same OS event IDs.
- Custom Creations owns shop/product/order workflows while referencing OS IDs when related to an event.

This architecture prevents public estimate data, private business records, and live event-session state from collapsing into one unsafe surface.

