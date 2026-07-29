# EVENTSible Ecosystem Contracts

These JSON Schema-style contracts are the OS-owned source of truth for cross-app payloads. Public apps may mirror the safe TypeScript subset, but must not import private OS runtime files directly.

Current contract set:

- `builder_submission_v1`
- `public_service_catalog_v1`
- `quote_draft_v1`
- `booking_v1`
- `event_activation_v1`
- `client_portal_summary_v1`
- `media_asset_v1`
- `content_factory_job_v1`

Compatibility policy:

- New fields must be additive and optional unless a new contract version is introduced.
- Existing identifiers stay stable. Do not rename `event_id`, `builder_submission_id`, `quote_id`, or live `room_id`.
- Currency values are integer cents in contracts, even if older Builder code still stores display dollars during compatibility conversion.
- Public contracts exclude private cost, margin, supplier, internal note, service-role, Host PIN, and customer-private fields.
