// Read-only, two-app localhost rehearsal. Both apps must be running on
// loopback and must use disposable Supabase data. No Production credentials,
// Host PIN, customer records, schema changes or external URLs are permitted.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const websiteUrl = process.env.EVENTSIBLE_LOCAL_WEBSITE_URL || "http://127.0.0.1:5173";
const hqUrl = process.env.EVENTSIBLE_LOCAL_HQ_URL || "http://127.0.0.1:3100";

function assertLoopbackUrl(input, port) {
  const url = new URL(input);
  assert.equal(url.protocol, "http:");
  assert(["127.0.0.1", "localhost"].includes(url.hostname), "Only loopback servers are authorized");
  assert.equal(url.port, port);
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
}

assertLoopbackUrl(websiteUrl, "5173");
assertLoopbackUrl(hqUrl, "3100");

const publicApi = `${hqUrl}/api/public-site/home`;
const response = await fetch(publicApi);
assert(response.ok, "Start the local HQ app with disposable Site Studio schema and synthetic published revision");
const body = await response.json();
assert.equal(body.version, 1);
// Public projection must never contain private Drive identifiers, unpublished
// revisions, auth/user records, private media flags or server-only credentials.
assert.equal(response.headers.get("access-control-allow-origin"), "*");
assert(!("draft" in body) && !("revisions" in body) && !("media" in body));
const publicPayload = JSON.stringify(body).toLowerCase();
for (const forbidden of [
  "drive_file_id", "synthetic-approved-drive-id", "synthetic-private-drive-id",
  "service_role", "supabase_service_role", "created_by", "permission_confirmed",
  "usage_approved", "os_site_media", "os_site_content_revisions",
  "site-owner@example.invalid", "site-staff@example.invalid",
]) {
  assert(!publicPayload.includes(forbidden), "Private Site Studio metadata reached public response");
}
const copy = body.content;
assert(copy?.heading && copy?.highlight && copy?.subheading, "No synthetic published homepage fixture");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const siteErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const location = msg.location().url || "";
    if (location.startsWith(websiteUrl) || location.startsWith(hqUrl))
      siteErrors.push("site console error");
  });
  page.on("pageerror", () => siteErrors.push("uncaught browser exception"));
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 500 && (url.startsWith(websiteUrl) || url.startsWith(hqUrl)))
      siteErrors.push("local server error");
  });

  await page.goto(websiteUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(
    (expected) => document.querySelector(".power-home__welcome-card")?.textContent?.trim() === expected,
    copy.power_welcome || "Welcome To",
    { timeout: 10000 },
  );
  assert(await page.locator(".power-path-panel").count() === 6, "All six Power Mode routes must remain present");
  const builderHref = await page.locator(".power-path-panel--builder").getAttribute("href");
  const vinceHref = await page.locator(".power-path-panel--play-connect").getAttribute("href");
  assert.equal(builderHref, "https://build.eventsible.info/build?start=choose", "Builder route changed");
  assert.equal(vinceHref, "https://eventsible.app", "VINCE guest route changed");
  const siteHtml = await page.locator("body").innerText();
  for (const value of Object.values(copy.power_subtitles || {}).filter(Boolean)) {
    assert(siteHtml.includes(value), "One approved Power Mode panel description is missing");
  }

  await page.getByRole("button", { name: "Switch to Classic View" }).click();
  await page.waitForFunction(
    (expected) => document.querySelector("h1")?.textContent?.includes(expected),
    copy.heading,
    { timeout: 10000 },
  );
  const realHomeImages = page.locator('img[src^="/media/real/"]');
  assert((await realHomeImages.count()) >= 3, "Missing approved real photo gallery from homepage");
  // Instagram's third-party embeds are not part of this local integration.
  await page.goto(`${websiteUrl}/media`, { waitUntil: "domcontentloaded" });
  const mediaImages = page.locator('img[src^="/media/real/"]');
  await mediaImages.first().waitFor({ timeout: 15000 });
  assert((await mediaImages.count()) >= 4, "Missing verified photo assets from Media gallery");
  for (let i = 0; i < 4; i++) {
    const loaded = await mediaImages.nth(i).evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0);
    assert(loaded, "Website image rendition failed to load");
  }
  // Assert healthy-state browser errors before deliberately simulating a failed request.
  assert.deepEqual(siteErrors, [], "Browser console/server errors found during healthy local integration");
  // A disconnected HQ must not break the public fallback and must not reveal private content.
  await page.route(publicApi, (route) => route.abort());
  await page.goto(websiteUrl, { waitUntil: "networkidle" });
  // The previous Classic View choice is correctly persisted in localStorage.
  // Check its offline static content, then deliberately switch back to Power Mode.
  const classicFallback = await page.locator("h1").first().innerText();
  assert(classicFallback.includes("We make more of your"), "Offline Classic content fallback missing");
  await page.getByRole("button", { name: "Power Mode", exact: true }).click();
  const fallback = await page.locator(".power-home__welcome-card").textContent();
  assert.equal(fallback?.trim(), "Welcome To", "Offline Power Mode fallback missing");

  await context.close();
  console.log("PASS: loopback OS API -> real public website Power/Classic copy, Media photos, Builder gateway preservation and offline fallback");
} finally {
  await browser.close();
}
