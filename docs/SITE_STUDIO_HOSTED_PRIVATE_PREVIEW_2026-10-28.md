# Site Studio hosted private renderer

This extends the owner-approved V2 workspace without changing its layout, revision contract, database, or public publication API. It is an implementation contract, not Production release authorization.

## Authorization and transport

- The HQ capability endpoint requires the current authenticated Owner (`system.manage` and trusted `app_metadata.role`), same-origin JSON, and the exact configured website audience.
- A capability authorizes rendering only for 90 seconds. It contains exact issuer/audience, random channel/frame nonce and expiry; no user identity, draft, cookie, refresh token or database key. Its HMAC uses a purpose-separated derivation of the existing HQ server-only service key. It grants no draft-read, write or publication permission.
- The browser submits this capability once in an ephemeral iframe POST body. It is never put in a URL, storage or rendered HTML. The website server verifies it against the fixed HQ verifier, then renders the existing homepage and returns only nonsecret bootstrap identifiers.
- The private response is `private, no-store`, `noindex, nofollow, noarchive`, `no-referrer`, with CSP `frame-ancestors` restricted to the verified exact HQ issuer. A hosted GET marker alone is denied. Bodies are bounded before parsing.
- Unsaved allowlisted content travels only from the Owner editor to its actual iframe in memory. Both sides check exact origin, source window, channel and frame nonce. Content messages require an increasing sequence and current authorization; unknown/private fields and unsafe media go through the existing public-content parser. Draft messages are not persisted or sent through an HTTP/public endpoint.
- HQ reauthorizes every 30 seconds. The frame clears private content on expiry or explicit authorization loss. Refresh creates a fresh nonce; saved revisions stay in the existing database. Publication still requires the existing explicit saved-revision confirmation.

## Exact deployment pairing

Production uses canonical `https://eventsible.biz` and `https://eventsible.info`; this task does not change Production configuration or release either application.

Preview requires deployment-only `EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL` on HQ and `EVENTSIBLE_SITE_STUDIO_OWNER_ORIGIN` on Public. These are exact reviewed deployment origins, not suffix-wide browser allowlists. Missing configuration fails closed. The Builder is not a private renderer.

For immutable Vercel URLs, a reviewed HQ verifier bootstrap can be deployed first, then Public, then the paired Owner HQ. The verifier and Owner HQ must use the same isolated backend service key. The verifier validates the signed actual Owner issuer; it cannot issue a capability without its own authenticated Owner and configured audience. No alias or Production setting needs to change.

## Recovery and release limits

Existing local-only rendering remains available on approved loopback origins. A hosted authorization/dependency failure clears the frame or offers Retry; it never publishes, discards saved revisions or changes public content. Public fallback and exact-revision restoration remain independent. Retain earlier deployment IDs for rollback. After restricted QA, retire synthetic credentials, close the tunnel and stop only its disposable backend. Immutable Preview snapshots then reference revoked credentials and a closed endpoint.

Production rollout still needs a fresh verified encrypted backup, approved environment/Auth changes if any, separate migration approval, and separate HQ/Public/Builder merge, staged deployment and promotion approvals. Git main-deployment and automatic domain-assignment safeguards remain in force.
