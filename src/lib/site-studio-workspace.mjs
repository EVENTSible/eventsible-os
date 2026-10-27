/** @type {{id:string,label:string,fields:Array<[string,string,number,boolean?]>,target:string}[]} */
export const STUDIO_SECTIONS = [
  {
    id: "hero",
    label: "Welcome and Hero",
    fields: [
      ["heading", "Headline", 110],
      ["highlight", "Highlighted words", 70],
      ["subheading", "Introduction", 600, true],
    ],
    target: "home-hero",
  },
  {
    id: "event-types",
    label: "Event Types",
    fields: [["event_types_heading", "Event types heading", 140]],
    target: "home-event-types",
  },
  {
    id: "services",
    label: "Services",
    fields: [
      ["services_heading", "Services heading", 140],
      ["services_body", "Services introduction", 600, true],
    ],
    target: "home-services",
  },
  { id: "trust", label: "Why EVENTSible", fields: [], target: "home-trust" },
  {
    id: "featured",
    label: "Featured Experiences",
    fields: [
      ["featured_heading", "Featured experiences heading", 140],
      ["featured_body", "Featured experiences introduction", 600, true],
    ],
    target: "home-featured-packages",
  },
  {
    id: "planning",
    label: "Planning Tools",
    fields: [],
    target: "home-planning-tools",
  },
  {
    id: "portfolio",
    label: "Portfolio and Gallery",
    fields: [
      ["portfolio_heading", "Portfolio heading", 140],
      ["portfolio_body", "Portfolio description", 600, true],
    ],
    target: "home-gallery",
  },
  {
    id: "cta",
    label: "Final Call to Action",
    fields: [
      ["final_cta_heading", "Call-to-action heading", 140],
      ["final_cta_body", "Call-to-action message", 600, true],
    ],
    target: "home-final-cta",
  },
  {
    id: "sections",
    label: "Section Visibility and Ordering",
    fields: [],
    target: "",
  },
];
export const STUDIO_POWER = [
  ["welcome", "Welcome Banner"],
  ["hq", "Discover description"],
  ["fast-track", "Fast Track description"],
  ["builder", "Build description"],
  ["stage", "Stage description"],
  ["workshop", "Custom Creations description"],
  ["play-connect", "Play / Connect description"],
];
export const OPTIONAL_SECTIONS = [
  ["home-event-types", "Event Types"],
  ["home-services", "Services"],
  ["home-trust", "Why EVENTSible"],
  ["home-featured-packages", "Featured Experiences"],
  ["home-planning-tools", "Planning Tools"],
  ["home-faq", "Frequently Asked Questions"],
];
export function normalizeStudioCopy(copy) {
  const ids = OPTIONAL_SECTIONS.map(([id]) => id);
  return {
    ...copy,
    power_subtitles: { ...copy.power_subtitles },
    section_order: [
      ...new Set([
        ...(copy.section_order || []).filter((id) => ids.includes(id)),
        ...ids,
      ]),
    ],
    visible_sections: copy.visible_sections ?? ids,
    gallery_media_ids: [...(copy.gallery_media_ids || []), "", "", ""].slice(
      0,
      3,
    ),
  };
}
export function studioDraftForm(copy) {
  const form = new FormData();
  for (const section of STUDIO_SECTIONS)
    for (const [key] of section.fields) form.set(key, copy[key] || "");
  form.set("power_welcome", copy.power_welcome || "");
  for (const [id] of STUDIO_POWER.slice(1))
    form.set("power_subtitle_" + id, copy.power_subtitles[id] || "");
  form.set("hero_media_id", copy.hero_media_id || "");
  form.set("section_order", copy.section_order.join(","));
  for (const id of copy.visible_sections) form.append("visible_sections", id);
  for (const id of copy.gallery_media_ids) form.append("gallery_media_ids", id);
  return form;
}
// Explicit allowlist, never revision metadata, private media candidates or credentials.
export function studioPreviewCopy(copy, media, mediaFree = true) {
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const section of STUDIO_SECTIONS)
    for (const [key] of section.fields) result[key] = copy[key] || "";
  result.power_welcome = copy.power_welcome;
  result.power_subtitles = Object.fromEntries(
    STUDIO_POWER.slice(1).map(([id]) => [id, copy.power_subtitles[id] || ""]),
  );
  result.section_order = copy.section_order;
  result.visible_sections = copy.visible_sections;
  const hero = mediaFree
    ? null
    : media.find((m) => m.id === copy.hero_media_id);
  result.hero_media_url = hero?.public_url || null;
  result.hero_media_alt = hero?.alt_text || null;
  result.gallery_media = mediaFree
    ? []
    : copy.gallery_media_ids.flatMap((id) => {
        const m = media.find((m) => m.id === id);
        return m
          ? [{ public_url: m.public_url, alt_text: m.alt_text, title: m.title }]
          : [];
      });
  return result;
}
