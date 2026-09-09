import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.DATA_READINESS_APP_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.DATA_READINESS_TEST_PASSWORD ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) || !serviceKey || !password) throw new Error("Isolated local Supabase browser-test environment is incomplete.");

const users = [
  { email: "data-browser-owner@example.invalid", role: "owner" },
  { email: "data-browser-manager@example.invalid", role: "manager" },
  { email: "data-browser-staff@example.invalid", role: "staff" },
  { email: "data-browser-host@example.invalid", role: "host" },
];
const createdIds = [];

async function admin(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`Local Auth administration failed with status ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

async function signIn(page, email) {
  await page.goto(`${appUrl}/login?next=/admin/data-readiness`, { waitUntil: "networkidle" });
  await page.getByLabel("Business email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
const serverFailures = [];
await mkdir("artifacts/data-readiness", { recursive: true });

try {
  for (const user of users) {
    const created = await admin("/users", { method: "POST", body: JSON.stringify({ email: user.email, password, email_confirm: true, app_metadata: { role: user.role } }) });
    createdIds.push(created.id);
  }

  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ownerContext.newPage();
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await signIn(page, users[0].email);
  if (!page.url().endsWith("/admin/data-readiness")) throw new Error(`Owner did not reach Data Readiness: ${new URL(page.url()).pathname}`);
  await page.getByRole("heading", { name: "Data Readiness" }).waitFor();

  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => { const heights = Array.from(document.querySelectorAll("main button, main input:not([type='hidden']):not([type='checkbox']):not([type='radio']), main select, main summary, main textarea")).map((element) => element.getBoundingClientRect().height).filter((height) => height > 0); return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, minimumActionHeight: heights.length ? Math.min(...heights) : 0 }; });
    if (geometry.scrollWidth > geometry.width || geometry.minimumActionHeight < 43.5) throw new Error(`Responsive interaction contract failed at ${viewport.width}px: ${JSON.stringify(geometry)}`);
    await page.screenshot({ path: `artifacts/data-readiness/owner-${viewport.width}x${viewport.height}.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Display name").first().fill("Synthetic browser contact");
  await page.getByLabel("Email").first().fill("browser-contact@example.invalid");
  await page.getByRole("button", { name: "Create contact" }).click();
  await page.getByText(/Contact create recorded with provenance/).waitFor();
  const contactDetails = page.locator("details").filter({ has: page.locator("summary", { hasText: "Synthetic browser contact" }) });
  await contactDetails.locator("summary").click();
  await contactDetails.getByLabel("Display name").fill("Synthetic browser contact corrected");
  await contactDetails.getByRole("button", { name: "Save contact" }).click();
  await page.getByText(/Contact update recorded with provenance/).waitFor();
  await contactDetails.getByRole("button", { name: "Archive" }).click();
  await page.getByText(/Contact archive recorded with provenance/).waitFor();
  await contactDetails.getByRole("button", { name: "Restore" }).click();
  await page.getByText(/Contact restore recorded with provenance/).waitFor();

  const eventDetails = page.locator("details").filter({ has: page.locator("summary", { hasText: "Synthetic corrected event" }) });
  await eventDetails.locator("summary").click();
  await eventDetails.getByLabel("Event title").fill("Synthetic browser-corrected event");
  await eventDetails.getByRole("button", { name: "Save event" }).click();
  await page.getByText(/Event update recorded with provenance/).waitFor();

  const lead = page.locator(".data-lead").first();
  await lead.getByLabel("Status").selectOption({ label: "follow up" });
  await lead.getByLabel("Next follow-up").fill("2026-10-21");
  await lead.getByRole("button", { name: "Save" }).click();
  await page.getByText(/Lead update recorded with provenance/).waitFor();

  const intakeTab = page.getByRole("button", { name: "Reviewed intake" });
  await intakeTab.focus();
  await page.keyboard.press("Enter");
  if ((await intakeTab.getAttribute("aria-current")) !== "page") throw new Error("Keyboard section navigation failed.");
  const manifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic browser review", items: [{ key: "contact.browser-1", type: "contact", sourceHash: "9".repeat(64), sourceRef: "synthetic/browser-1", uncertainFields: [], data: { displayName: "Synthetic browser import", primaryEmail: "browser-import@example.invalid" } }] };
  await page.getByLabel("Versioned JSON manifest").fill(JSON.stringify(manifest));
  await page.getByRole("button", { name: "Validate and stage dry run" }).click();
  await page.getByText(/Dry run staged/).waitFor();
  const batch = page.locator(".data-batch").filter({ hasText: "Synthetic browser review" });
  await batch.getByRole("button", { name: "Approve exact item set" }).click();
  await page.getByText(/selected item set approved/).waitFor();
  await batch.getByRole("button", { name: "Apply approved items" }).click();
  await page.getByText("Approved items applied idempotently.").waitFor();
  await batch.locator("summary", { hasText: "Archive / compensate" }).click();
  await batch.getByLabel("Type ARCHIVE BATCH").fill("ARCHIVE BATCH");
  await batch.getByRole("button", { name: "Archive imported results" }).click();
  await page.getByText(/without erasing history/).waitFor();
  await page.screenshot({ path: "artifacts/data-readiness/owner-workflow-complete-390x844.png", fullPage: false });
  await ownerContext.close();

  for (const user of users.slice(1)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const deniedPage = await context.newPage();
    await signIn(deniedPage, user.email);
    await deniedPage.waitForURL(/\/access-denied$/);
    if (!deniedPage.url().endsWith("/access-denied")) throw new Error(`${user.role} reached the Owner-only Data Readiness route.`);
    await context.close();
  }

  if (consoleErrors.length || serverFailures.length) throw new Error(`Browser/runtime errors occurred: ${JSON.stringify({ consoleErrors, serverFailures })}`);
  console.log("Data Readiness authenticated browser verification passed with synthetic local Owner, Manager, Staff, and Host identities.");
} finally {
  await browser.close();
  for (const id of createdIds) {
    try { await admin(`/users/${id}`, { method: "DELETE" }); } catch { /* The local stack is destroyed after the job. */ }
  }
}
