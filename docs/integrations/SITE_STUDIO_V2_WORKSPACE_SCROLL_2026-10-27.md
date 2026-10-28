# Site Studio V2 stable workspace and scroll ownership

Local Preview implementation only. No schema, Auth, RLS, content fields, revision persistence, publication/restoration actions, public projection, media permissions or hosted settings change.

## Evidence and cause

The Owner's October 27 recording (50.97 seconds) was reviewed locally through sampled frames across the clip. The original recording was not edited or published. The live pre-change page confirmed the same competing scroll regions: in one section the document was 900px high in a 627px viewport; the saved Hero draft produced a 1280px document in a 571px viewport.

The workspace had automatic height, while HQ's document remained scrollable. The section navigator used a two-column grid with `max-height:205px; overflow:auto`. Contextual controls had no bounded scroller, so their height enlarged the document. The preview had a second `overflow:auto` stage around its already-scrollable iframe, plus a 400px shell floor and 650px inner-frame floor. Sticky toolbar/preview offsets and viewport-subtraction formulas could not constrain that complete ancestor chain. Focusing fields or reaching a scroll boundary therefore moved a different surface than the Owner intended.

## One bounded workspace

The existing HQ shell receives a pathname-derived `data-workspace="site-studio"` attribute. Route-scoped CSS locks only that workspace to `100dvh`; the existing HQ topbar occupies an automatic grid row and the content uses `minmax(0,1fr)`. Each subsequent grid/flex ancestor has `min-height:0`. Other HQ routes remove the attribute and retain ordinary document scrolling; the rule does not depend on cached editor descendants being unmounted.

The Site Studio command toolbar is a non-scrolling flex item. The two main panels share the remaining height. Notices stay compact and unsaved-state explanation remains available to assistive technology without adding another visible toolbar row.

| Surface | Before | Current intended behavior |
|---|---|---|
| HQ document | Scrolled around the editor and sticky surfaces | No scrolling while Site Studio is active; normal behavior restored on other HQ routes |
| Workspace/split | Grew with content | Fills remaining viewport; no workspace scrollbar |
| Section navigation | Small two-column scroll region | Native labelled dropdown; no persistent navigator scrollbar |
| Fields panel | Content expanded the document | One focusable, named region with native wheel/Page Down scrolling and containment |
| Long textarea | Native text scrolling | Native text scrolling retained; boundary does not chain to HQ |
| Preview stage | Second outer scroller around iframe | Non-scrolling measured frame surface |
| Website document | Native iframe scrolling, sometimes clipped by wrapper floors | Preview's single native content scroller; fills the measured viewport |
| HQ navigation sidebar/dialog | Existing navigation overflow | Retained; no navigation redesign |

Changing sections resets only the controls panel. Preview focus no longer calls ancestor `scrollIntoView`. The real website uses the existing allowlisted private draft bridge, normal components, fallbacks and media-free substitutions. Desktop/tablet/mobile widths remain 1280/768/390. Removing wrapper floors lets the iframe's virtual height fit the available surface rather than creating another scroll box.

The public consumer adds presentation rules only when the existing approved local private-frame gate sets `data-site-studio-preview`. Those rules contain overscroll and expose the existing Power cover's minimum-height canvas through native iframe scrolling. Ordinary public pages do not receive the attribute. No draft data is written to a public endpoint, URL, browser storage or database by previewing.

## Responsive and accessible controls

Desktop/landscape tablet retain the split, with a keyboard-accessible preferred editor-width slider and a constrained maximum that reserves space for the website. Portrait tablets stack the two sibling panels. Mobile displays Edit or Preview, with a single active content scroller and space reserved for the existing HQ bottom navigation. Icon-only mobile website/full-screen buttons retain accessible names. Full screen uses the same actual renderer and restores the existing editing state on exit.

The scroll checks cover short laptop windows, common desktop sizes, zoom-equivalent CSS dimensions, portrait tablet and 320/375/390px mobile widths; they verify wheel and keyboard ownership, boundaries, text-field behavior, live preview, resize controls, expanded mode, ordinary HQ navigation, private/public separation and authorization. Actual Owner-Chrome save/publish/restore is checked separately against the same isolated backend. Preserve all pre-task rows and the actual publication, and retain synthetic test revisions rather than deleting them.

These focused branches remain local until separately authorized for PR updates. The existing PRs remain drafts. Deployment rollback, database recovery and content revision restoration remain separate operations; existing recovery checkpoints and original assets are retained.

## Verified local results

In the Owner's Chrome window at 1263×571, the document changed from 1280px to 571px high. The final fields surface was 258px high with 596px of content; the preview stage was 245px high with no outer overflow. Wheel and Page Down moved the fields while HQ remained at scroll position zero. The actual Power iframe moved to scroll position 217px while the fields, stage and HQ stayed at zero. The 1280px Power renderer preserves the existing responsive 650px cover canvas and exposes its lower controls through native iframe scrolling.

One synthetic revision, 32, was explicitly saved and published through Chrome. Both public Classic headline and Power Discover subtitle were verified. History restored revision 21, and the editor resumed Owner draft 31. All 28 pre-task revision records compared exactly with the private checkpoint; all six synthetic canonical business-table fingerprints and the media records remained unchanged. Revision 32 is retained archived. No original drafts or records were reset or deleted.

HQ's 283 tests and the consumer's 128 tests passed. Both lint checks passed with inherited warnings only (8 HQ, 10 consumer); types, media-free production builds and strict dependency audits passed. The client secret scan covered 120 assets without findings. Browser tests covered ten desktop/tablet/mobile sizes, private bridge rejection boundaries, unsaved refresh cancellation, normal Calendar and Wedding Hero layout, and unauthorized-role denial. Actual Chrome reported zero console errors.

Limits: this remains the existing Home-PC-only private preview bridge. A slow frame after form navigation was recovered with the existing Retry control; the final frame was connected. Browser zoom shortcuts did not change Chrome's zoom through the automation interface, so actual zoom-setting changes are unverified; reduced CSS viewport sizes were checked separately. No hosted deployment or PR update was performed.

Detailed evidence is in the workspace's `deliverables/site-studio-scroll-2026-10-27/` folder. Private database checkpoints and recording contact sheets are excluded from that report. To undo the presentation change, revert the focused local commits and rebuild the same prepared demo sources; do not reset the database or remove revisions. Production deployment rollback remains outside this local task.
