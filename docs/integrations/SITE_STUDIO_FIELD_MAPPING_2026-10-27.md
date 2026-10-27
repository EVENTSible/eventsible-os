# Site Studio field destinations and Owner feedback

Site Studio Preview only; no Production change is authorized. This reconciles the October 20 initial scope with the existing Classic/Power controls added since then. It does not make the whole Power cover editable.

## Current supported destinations

| Editor control / stored field | Classic View | Power Mode |
|---|---|---|
| Headline / `heading` | Main hero heading | Not used |
| Highlighted words / `highlight` | Gold words in the main hero heading | Not used |
| Introduction / `subheading` | Paragraph under the hero heading | Not used |
| Power Mode welcome / `power_welcome` | Not used | Welcome banner above the logo; displayed uppercase |
| Six panel descriptions / `power_subtitles.{hq,fast-track,builder,stage,workshop,play-connect}` | Not used | Subtitle below the corresponding fixed Power panel title |
| Event types heading / `event_types_heading` | Event types section heading, when visible | Not used |
| Services heading/introduction / `services_heading`, `services_body` | Services section heading/paragraph, when visible | Not used |
| Featured experiences heading/introduction / `featured_heading`, `featured_body` | Featured section heading/paragraph, when visible | Not used |
| Portfolio heading/description / `portfolio_heading`, `portfolio_body` | Gallery heading/paragraph, only when gallery is visible | Not used |
| Approved homepage photo / `hero_media_id` | Approved public hero rendition | Not used |
| Approved gallery photos / `gallery_media_ids` | Up to three approved public renditions | Not used |
| Section visibility/order / `visible_sections`, `section_order` | Six optional Classic sections only | Does not hide, reorder or rename Power panels |
| Call-to-action heading/message / `final_cta_heading`, `final_cta_body` | Final Classic section | Not used |

Media-free Preview suppresses media. A gallery without approved visible media can remain hidden even when its portfolio copy is saved. Blank optional text falls back to existing wording. Required hero fields cannot be blank. These conditions must not be described as failed publication.

## Corrections

- The local Owner editor previously linked to the real public website. An explicit local-demo flag plus the isolated backend binding now selects the matching loopback public Preview; platform deployments retain live navigation with a clear label.
- Publishing a recent revision previously allowed an older private draft to reappear in the editor on reload. Selection now keeps the newer publication; after publication/restoration the success page displays that exact published content. Older drafts remain preserved. On a normal editor visit, a newer private draft can still be resumed, explicitly labelled separately from the public revision.
- The server reads the current publication separately from the recent-history page. Restoring an old revision cannot cause the publication label to guess from recent drafts.
- Fieldsets and private previews now identify Classic-only and Power-only destinations; revision history shows copy summaries so the Owner can distinguish revisions before publishing.
- A supported 32-character Power welcome overflowed its mobile card under `white-space: nowrap`. Bounded wrapping now keeps its full text visible.

Saving remains private; publication uses the existing Owner-checked atomic function. The public API still projects only the allowlisted published revision with `no-store`; both layouts consume that same projection. No Auth/RLS, schema or media-approval rule was relaxed.

## Outside v1

Power logo/artwork, primary panel titles, colors, panel order/destinations and additional Power pages are not general editor controls. Classic navigation/button destinations, package data, reviews, Builder ownership, Drive ingestion, media approval and real-media publication are not expanded by this correction. Any proposed new Power controls require a separately specified product change.
