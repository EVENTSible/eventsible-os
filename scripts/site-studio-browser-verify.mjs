import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.DATA_READINESS_APP_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRole = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.DATA_READINESS_TEST_PASSWORD ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(appUrl) ||
    !/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) ||
    !serviceRole || !password) throw Error("Refusing non-local Site Studio browser QA");
if (new URL(supabaseUrl).port === "56521") throw Error("Refusing the preserved Owner demonstration database");

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
  const command = page.locator(".studio-command");
  await command.getByRole("button", { name: "Power Mode", exact: true }).click();
  await page.getByRole("textbox", { name: "Power Mode welcome", exact: true }).fill("Supercharge Your");
  await page.getByRole("combobox", { name: "Power section", exact: true }).selectOption("hq");
  await page.getByRole("textbox", { name: "Discover description", exact: true }).fill("See us in action");
  if (await command.getByRole("button", { name: "Publish", exact: true }).isEnabled()) {
    throw Error("Unsaved edits must not be publishable.");
  }
  await page.locator(".studio-mobile-tabs").getByRole("button", { name: "Preview", exact: true }).click();
  // CI runs one application against a different isolated backend. The approved
  // real renderer is local-demo-only: verify that boundary instead of claiming
  // the removed V1 mock preview is the live website.
  await page.getByRole("heading", { name: "Private visual preview is local only", exact: true }).waitFor();
  if (await page.locator("iframe").count()) throw Error("CI must not open an unconfigured private renderer.");

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw Error(`Site Studio horizontal overflow at ${width}px`);
    if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || window.scrollY !== 0)) {
      throw Error(`Site Studio workspace escaped its viewport at ${width}px`);
    }
    await page.screenshot({ path: `artifacts/site-studio/owner-draft-${width}.png`, fullPage: false });
  }

  await page.getByRole("button", { name: "Media review", exact: true }).click();
  await page.getByLabel("Google Drive file link or ID").fill("syntheticDriveCandidate9992026");
  await page.getByLabel("Working title").fill("Synthetic private photo");
  await page.getByRole("button", { name: "Queue for private review" }).click();
  await page.getByText(/Drive candidate queued for private review/).waitFor();
  await page.getByRole("button", { name: "Close media review", exact: true }).click();

  // Adding media must NOT discard copy typed before the queue action.
  await command.getByRole("button", { name: "Classic View", exact: true }).click();
  if ((await page.getByLabel("Headline", { exact: true }).inputValue()) !== "EVENTSible makes" ||
      (await page.getByLabel("Highlighted words").inputValue()) !== "party magic") {
    throw Error("Queueing media discarded unsaved Classic edits.");
  }
  await command.getByRole("button", { name: "Power Mode", exact: true }).click();
  if ((await page.getByRole("textbox", { name: "Power Mode welcome", exact: true }).inputValue()) !== "Supercharge Your") {
    throw Error("Queueing media discarded unsaved Power welcome.");
  }
  await page.getByRole("combobox", { name: "Power section", exact: true }).selectOption("hq");
  if ((await page.getByRole("textbox", { name: "Discover description", exact: true }).inputValue()) !== "See us in action") {
    throw Error("Queueing media discarded unsaved Site Studio edits.");
  }
  await page.getByRole("button", { name: "Save private draft" }).click();
  await page.getByText("Private draft saved. Public site unchanged.").waitFor();

  const unpublished = await (await fetch(`${appUrl}/api/public-site/home`)).json();
  if (JSON.stringify(unpublished) !== JSON.stringify(firstContent)) {
    throw Error("Saving a draft unexpectedly changed the public revision.");
  }

  await command.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  if (JSON.stringify(await (await fetch(`${appUrl}/api/public-site/home`)).json()) !== JSON.stringify(firstContent)) {
    throw Error("Canceling publication changed the public revision.");
  }
  await command.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Confirm publication", exact: true }).click();
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
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: `Restore revision ${firstContent.revision}`, exact: true }).click();
  await page.getByRole("button", { name: "Confirm publication", exact: true }).click();
  await command.getByText(`Published revision ${firstContent.revision}`, { exact: true }).waitFor();
  const restored = await (await fetch(`${appUrl}/api/public-site/home`)).json();
  if (JSON.stringify(restored) !== JSON.stringify(firstContent)) throw Error("History did not restore the exact baseline projection.");
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffPage = await denied.newPage();
  await login(staffPage, accounts[1].email);
  await staffPage.waitForURL(/\/access-denied$/);
  await denied.close();

  if (errors.length) throw Error(`Site Studio QA browser/runtime issues: ${errors.join(", ")}`);
  console.log("PASS: V2 contextual Classic/Power editing, bounded responsive workspace, private-renderer gate, candidate queue preservation, private save, cancel/confirm publication, exact history restore, Staff denial.");
} finally {
  await browser.close();
  for (const id of created) {
    try { await admin(`/users/${id}`, { method: "DELETE" }); } catch { /* disposable local stack */ }
  }
}
