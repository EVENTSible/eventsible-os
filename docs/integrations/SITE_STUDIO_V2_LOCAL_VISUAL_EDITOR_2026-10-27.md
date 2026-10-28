# Site Studio V2 local visual workspace

Status: IMPLEMENTED IN FOCUSED LOCAL WORKTREES. Not merged, deployed or approved for Production.

Retains the v1 schema, immutable revision content, Owner-only Server Actions, atomic publication RPC, RLS, published projection and media rules. Existing PR #50 and consumer PR #5 are unchanged by this work. This is a presentation refactor and the separately approved Home-PC-only preview bridge, not a new CMS.

## Workspace

Persistent toolbar shows selected saved revision, current publication and unsaved status. Classic/Power section navigation mounts only the relevant controls, while Save serializes **all** existing supported field names. Private drafts are never autosaved or published. Publish is disabled with unsaved edits and requires a confirmation identifying the exact saved revision and replacement publication.

History is a keyboard-accessible native dialog with bounded, paginated existing records. Preview selection is an authenticated server read using `?revision=UUID`, restricted to the home page. This does not insert or rewrite revisions. Restore calls the same publication action after confirmation. Media review uses the existing intake action in its own dialog; no second media store exists.

Current workspace and scrolling behavior: [stable viewport, compact section selector and explicit scroll ownership](SITE_STUDIO_V2_WORKSPACE_SCROLL_2026-10-27.md). Desktop/landscape tablet use the split with an adjustable editor width; portrait tablet stacks the panels; mobile has Edit/Preview switches. The frame retains Desktop (1280), Tablet (768), Mobile (390), refresh/reconnect and full-screen controls. Why EVENTSible/Planning Tools copy, panel titles, destinations and artwork remain protected. Visibility/order controls remain limited to the existing six optional Classic sections.

## Approved local preview boundary

The HQ page first verifies Owner capability and `app_metadata.role`. It enables the bridge only under the existing explicit local-demo identity guard bound to the synthetic backend, with no hosted runtime context. The preview target is fixed to `http://127.0.0.1:5173/?studio-preview=1`; draft text, revision IDs and credentials are never encoded in the URL.

The consumer activates the bridge only in development, with the local-demo flag, on exact origin `http://127.0.0.1:5173`, inside a frame with the explicit preview marker. Production builds disable it. It uses the **same** `ClassicHome`/`PowerGateway`, public shell, CSS, projection parser, fallbacks and media-free substitutions as the normal homepage.

HQ sends only allowlisted homepage fields in memory using an exact target origin. Both sides verify exact origins and window source. A random per-mount channel correlates acknowledgements; it is not an authorization token. The consumer never fetches private data: access to saved revisions remains exclusively on the authenticated HQ page. Ready/ack messages contain no content. No preview content is written to public endpoints, localStorage, URLs or database records. Public reader requests are suppressed inside the private frame; ordinary public pages continue to read published content only.

The cross-origin sandbox allows scripts and its own origin, without forms, popups or top-navigation permissions. Preview links/submissions are intercepted, so the inspection frame cannot submit or navigate into live systems. Server credentials and media candidates are never included. No public share URL is created. The server-only credentials remain in the existing local backend configuration.

Blank required hero fields temporarily retain the last valid preview and show a warning; Save remains disabled. Blank optional text uses the existing consumer fallback. Unsaved content remains in browser memory only: cancel navigation to preserve it, or explicitly Save before refreshing. No persistent draft browser cache is introduced.

## Verification and rollback

Run the HQ and consumer focused/full suites, lint, types, media-free Production builds, audits and local guard, then actual isolated Owner save/publish/restore, role/RLS and responsive browser QA. Verify every pre-task row and media record plus canonical-table fingerprints against a private snapshot; restore the **actual pre-task publication**, not a hardcoded initial fixture. Preserve synthetic test revisions and archive only those created by this task through normal Owner publication/restoration.

The existing local prepared source is updated in place. Prior source and a private synthetic database backup remain retained locally. Application rollback uses those prior source files and rebuilds the same apps; it does not reset the database. Content restoration independently republishes an existing saved revision. No Production migration, deployment, DNS, environment, media or data action is authorized.

Hosted private visual preview is outside this approval. A future hosted bridge needs an independently reviewed target/origin/authentication contract; do not broaden the local allowlist implicitly.

## Chrome connection and short-window correction

The iframe's load event can arrive after its ready/acknowledgement handshake. It now resends the allowlisted draft instead of resetting an acknowledged connection. A visible loading panel covers the initial empty frame; after 12 seconds it offers an explicit retry without saving or publishing. Exact origins, window-source checks and the existing channel remain enforced.

The early measured-toolbar/sticky-position strategy is superseded by the stable viewport layout linked above. The consumer's section navigation continues to scroll only its own window. The connection fixture verifies acknowledgement-before-load ordering, stalled-frame feedback/retry and recovery to the real renderer without database mutations. Initial background-tab paint timing cannot be reconstructed from the earlier screenshot alone; it is not evidence of a publishing or data failure.
