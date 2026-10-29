import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStudioCopy,
  studioDraftForm,
  studioPreviewCopy,
} from "../lib/site-studio-workspace.mjs";
const input = {
  heading: "Classic",
  highlight: "Gold",
  subheading: "Intro",
  power_welcome: "Power",
  power_subtitles: { hq: "Discover", builder: "Build" },
  visible_sections: [],
  section_order: ["bad", "home-services", "home-services"],
  gallery_media_ids: [],
  hero_media_id: "private-id",
  created_by: "private-actor",
  service_role: "DO NOT SEND",
};
test("saving a contextual panel serializes all supported fields and preserves explicit hidden sections", () => {
  const copy = normalizeStudioCopy(input),
    data = studioDraftForm(copy);
  assert.equal(data.get("heading"), "Classic");
  assert.equal(data.get("power_subtitle_hq"), "Discover");
  assert.equal(data.get("power_subtitle_builder"), "Build");
  assert.deepEqual(data.getAll("visible_sections"), []);
  assert.equal(copy.section_order[0], "home-services");
  assert.equal(new Set(copy.section_order).size, 6);
  assert.equal(data.has("created_by"), false);
});
test("private preview allowlists known fields and suppresses media in media-free mode", () => {
  const copy = studioPreviewCopy(
    normalizeStudioCopy(input),
    [
      {
        id: "private-id",
        public_url: "https://example.invalid/photo",
        drive_file_id: "private-drive",
        title: "Photo",
        alt_text: "Approved",
      },
    ],
    true,
  );
  for (const forbidden of [
    "created_by",
    "hero_media_id",
    "service_role",
    "drive_file_id",
  ])
    assert.equal(JSON.stringify(copy).includes(forbidden), false);
  assert.equal(copy.hero_media_url, null);
  assert.deepEqual(copy.gallery_media, []);
  assert.equal(copy.heading, "Classic");
});
