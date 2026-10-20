import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.DATA_READINESS_APP_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.DATA_READINESS_TEST_PASSWORD ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(appUrl) ||
    !/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) ||
    !serviceRole || !password) throw Error("Refusing non-local Site Studio browser QA");

const accounts = [
  { email: "site-studio-owner@example.invalid", role: "owner" },
  { email: "site-studio-staff@example.invalid", role: "staff" },
];
const created = [];

async function admin(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw Error(`Synthetic Auth operation failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function login(page, email) {
  await page.goto(`${appUrl}/login?next=/admin/site-studio`, { waitUntil: "networkidle" });
  await page.getByLabel("Business email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch({ headless: true });
const errors = [];
await mkdir("artifacts/site-studio", { recursive: true });
try {
  for (const user of accounts) {
    const result = await admin("/users", {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        password,
        email_confirm: true,
        app_metadata: { role: user.role },
      }),
    });
    created.push(result.id);
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console");
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`http_${res.status()}`);
  });

  await login(page, accounts[0].email);
  await page.getByRole("heading", { name: "Site Studio" }).waitFor();

  const before = await fetch(`${appUrl}/api/public-site/home`);
  const firstContent = await before.json();
  if (!before.ok || !firstContent.content) throw Error("Synthetic SQL verification must seed a published baseline.");

  await page.getByLabel("Headline", { exact: true }).fill("EVENTSible makes");
  await page.getByLabel("Highlighted words").fill("party magic");
  await page.getByLabel("Power Mode welcome").fill("Supercharge Your");
  await page.getByLabel("Discover panel description").fill("See us in action");
  const preview = page.getByRole("region", { name: "Live private draft preview" });
  await preview.getByText(/EVENTSible makes/).waitFor();
  await preview.getByText(/party magic/).waitFor();

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw Error(`Site Studio horizontal overflow at ${width}px`);
    await page.screenshot({ path: `artifacts/site-studio/owner-draft-${width}.png`, fullPage: false });
  }

  await page.getByLabel("Google Drive file link or ID").fill("syntheticDriveCandidate9992026");
  await page.getByLabel("Working title").fill("Synthetic private photo");
  await page.getByRole("button", { name: "Queue for private review" }).click();
  await page.getByText(/Drive candidate queued for private review/).waitFor();
  await page.getByText("Synthetic private photo").waitFor();

  await page.getByLabel("Headline", { exact: true }).fill("EVENTSible makes");
  await page.getByLabel("Highlighted words").fill("party magic");
  await page.getByRole("button", { name: "Save private draft" }).click();
  await page.getByText("Private draft saved. Public site unchanged.").waitFor();

  const unpublished = await (await fetch(`${appUrl}/api/public-site/home`)).json();
  if (JSON.stringify(unpublished) !== JSON.stringify(firstContent)) {
    throw Error("Saving a draft unexpectedly changed the public revision.");
  }

  await page.getByRole("button", { name: "Publish this revision" }).first().click();
  await page.getByText(/Selected revision published/).waitFor();

  const publishedResponse = await fetch(`${appUrl}/api/public-site/home`);
  const published = await publishedResponse.json();
  if (!publishedResponse.ok ||
      published.content?.heading !== "EVENTSible makes" ||
      published.content?.highlight !== "party magic" ||
      published.content?.power_welcome !== "Supercharge Your" ||
      published.content?.power_subtitles?.hq !== "See us in action" ||
      published.content?.hero_media_url !== null) {
    throw Error("Published homepage contract did not reflect owner-approved synthetic copy.");
  }

  await page.screenshot({ path: "artifacts/site-studio/owner-published-synthetic-390.png" });
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffPage = await denied.newPage();
  await login(staffPage, accounts[1].email);
  await staffPage.waitForURL(/\/access-denied$/);
  await denied.close();

  if (errors.length) throw Error(`Site Studio QA browser/runtime issues: ${errors.join(", ")}`);
  console.log("PASS: synthetic Owner mobile/desktop preview, candidate queue, draft save without publication, deliberate public projection, Staff denial.");
} finally {
  await browser.close();
  for (const id of created) {
    try { await admin(`/users/${id}`, { method: "DELETE" }); } catch { /* disposable local stack */ }
  }
}
