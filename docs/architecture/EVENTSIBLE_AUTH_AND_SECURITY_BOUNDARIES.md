# EVENTSible Auth and Security Boundaries

- Status: CANONICAL
- Owner: EVENTSible
- Canonical source: EVENTSible OS repository
- Last verified: 2026-07-29
- Applies to: auth, secrets, public/private route boundaries
- Supersedes: any plan that exposes server-only credentials in public apps
- Related documents: `../ecosystem/EVENTSIBLE_DOMAIN_AND_APP_INDEX.md`

## Public Surfaces

- Event Builder public routes.
- ECC/VINCE Player, Audience, and Join routes.
- Legacy/public marketing pages.
- Future public shop catalog pages.

Public surfaces may use browser-safe Supabase publishable/anon variables, but never service-role keys.

## Private Surfaces

- EVENTSible OS / GigTracker.
- Event Builder Admin Leads.
- Client Portal booked-client workspace.
- Host-only ECC/VINCE controls.
- Content Factory operations.
- Custom Creations admin/order production workflows.

## Locked Secret Rules

- Do not expose Supabase service-role keys.
- Do not expose Host PIN secrets.
- Do not expose Host session secrets.
- Do not use `VITE_` for server-only Host PIN variables.
- Do not place passwords, access tokens, customer private details, QA emails/phones, or auth user IDs in documentation.

