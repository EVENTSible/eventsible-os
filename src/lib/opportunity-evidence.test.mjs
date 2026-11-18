import test from "node:test";
import assert from "node:assert/strict";
import { validOpportunityScreenshot } from "./opportunity-evidence.mjs";

test("screenshot intake rejects spoofed formats, empty files and oversized uploads", () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const jpg = Uint8Array.from([255,216,255,224,0,0,0,0,0,0,0,0]);
  const webp = new TextEncoder().encode("RIFF0000WEBP");
  assert.equal(validOpportunityScreenshot(png,"image/png"), true);
  assert.equal(validOpportunityScreenshot(jpg,"image/jpeg"), true);
  assert.equal(validOpportunityScreenshot(webp,"image/webp"), true);
  assert.equal(validOpportunityScreenshot(png,"image/jpeg"), false);
  assert.equal(validOpportunityScreenshot(new Uint8Array(0),"image/png"), false);
  assert.equal(validOpportunityScreenshot(new Uint8Array(5 * 1024 * 1024 + 1),"image/jpeg"), false);
  assert.equal(validOpportunityScreenshot(png,"image/svg+xml"), false);
});
