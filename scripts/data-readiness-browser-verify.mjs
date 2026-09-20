import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.DATA_READINESS_APP_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.DATA_READINESS_TEST_PASSWORD ?? "";
const quickAddOnly = process.argv.includes("--quick-add-only");
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

async function rows(table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) throw new Error(`Local canonical-record verification failed for ${table} with status ${response.status}.`);
  return response.json();
}

async function signIn(page, email, nextPath = "/admin/data-readiness") {
  await page.goto(`${appUrl}/login?next=${nextPath}`, { waitUntil: "networkidle" });
  await page.getByLabel("Business email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

async function verifyEditorSurface(page, label, { services = false } = {}) {
  const editor = page.getByRole("dialog");
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector(".record-editor");
      const backdrop = document.querySelector(".record-editor-backdrop");
      const scroller = document.querySelector(".record-editor-scroll");
      const header = dialog?.querySelector(":scope > header");
      const drawerBackground = dialog ? getComputedStyle(dialog).backgroundColor : "";
      const scrollBackground = scroller ? getComputedStyle(scroller).backgroundColor : "";
      const backdropBackground = backdrop ? getComputedStyle(backdrop).backgroundColor : "";
      const blocker = document.elementFromPoint(8, Math.floor(innerHeight / 2));
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyOverflow: getComputedStyle(document.body).overflow,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        drawerBackground,
        scrollBackground,
        backdropBackground,
        scrollerOverflow: scroller ? getComputedStyle(scroller).overflowY : "",
        headerBottom: header?.getBoundingClientRect().bottom ?? 0,
        scrollerTop: scroller?.getBoundingClientRect().top ?? 0,
        blockerClass: blocker instanceof HTMLElement ? blocker.className : "",
      };
    });
    if (geometry.scrollWidth > geometry.width || geometry.bodyOverflow !== "hidden" || geometry.htmlOverflow !== "hidden" || geometry.scrollerOverflow !== "auto" || /rgba\([^)]*,\s*0\)|transparent/.test(geometry.drawerBackground) || /rgba\([^)]*,\s*0\)|transparent/.test(geometry.scrollBackground) || !geometry.backdropBackground.startsWith("rgba(24, 10, 35, 0.68)") || Math.abs(geometry.headerBottom - geometry.scrollerTop) > 1 || !String(geometry.blockerClass).includes("record-editor")) throw new Error(`Record Details visual boundary failed for ${label} at ${viewport.width}px: ${JSON.stringify(geometry)}`);
    if (services) {
      const serviceList = editor.locator(".data-checks");
      if (!(await serviceList.isVisible()) || !(await serviceList.locator("label").count())) throw new Error("Booked-services selector is not visibly separated inside Record Details.");
    }
    await page.screenshot({ path: `artifacts/data-readiness/${label}-${viewport.width}x${viewport.height}.png`, fullPage: false });
  }
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

  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/New_York" });
  const page = await ownerContext.newPage();
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) serverFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await signIn(page, users[0].email);
  if (!page.url().endsWith("/admin/data-readiness")) throw new Error(`Owner did not reach Records & Intake: ${new URL(page.url()).pathname}`);
  await page.getByRole("heading", { name: "Records & Intake" }).waitFor();

  await page.goto(`${appUrl}/admin/quick-add`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Quick Add" }).waitFor();
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll("main button, main a, main input:not([type='hidden']):not([type='checkbox']), main select, main textarea, main summary")).map((element) => element.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0);
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, minimumControlHeight: Math.min(...controls.map((box) => box.height)) };
    });
    if (geometry.scrollWidth > geometry.width || geometry.minimumControlHeight < 43.5) throw new Error(`Quick Add responsive contract failed at ${viewport.width}px: ${JSON.stringify(geometry)}`);
    await page.screenshot({ path: `artifacts/data-readiness/quick-add-${viewport.width}x${viewport.height}.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel(/Display name/).fill("Synthetic Quick Add browser client");
  await page.getByLabel("Email", { exact: true }).fill("quick-browser@example.invalid");
  await page.getByRole("button", { name: "Save contact" }).click();
  await page.getByText("Contact saved to EVENTSible HQ.").waitFor();

  await page.goto(`${appUrl}/admin/quick-add?type=lead`, { waitUntil: "networkidle" });
  await page.getByLabel(/Contact/).selectOption({ label: "Synthetic Quick Add browser client" });
  await page.getByLabel(/What do they want/).fill("Synthetic direct birthday inquiry");
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.getByText("Lead saved to EVENTSible HQ.").waitFor();

  await page.goto(`${appUrl}/admin/quick-add?type=event`, { waitUntil: "networkidle" });
  await page.getByLabel(/Gig \/ event title/).fill("Synthetic Quick Add date-only gig");
  await page.getByLabel(/Client contact/).selectOption({ label: "Synthetic Quick Add browser client" });
  await page.getByLabel(/Event type/).fill("birthday_party");
  await page.getByLabel("Date *").fill("2027-08-14");
  await page.getByRole("button", { name: "Save gig" }).click();
  await page.getByText("Gig saved to EVENTSible HQ.").waitFor();

  await page.goto(`${appUrl}/admin/quick-add?type=booking`, { waitUntil: "networkidle" });
  await page.getByLabel(/Gig \/ event/).selectOption({ label: "Synthetic Quick Add date-only gig · inquiry" });
  await page.getByRole("button", { name: "Save booking" }).click();
  await page.getByText("Booking saved to EVENTSible HQ.").waitFor();

  await page.goto(`${appUrl}/admin/quick-add?type=note`, { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Record type" }).selectOption("event");
  await page.getByLabel(/Attach to/).selectOption({ label: "Synthetic Quick Add date-only gig" });
  await page.getByLabel(/Business note/).fill("Synthetic Owner-entered browser note.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByText("Note saved to EVENTSible HQ.").waitFor();
  await page.screenshot({ path: "artifacts/data-readiness/quick-add-owner-workflow-390x844.png", fullPage: false });

  const quickContacts = await rows("os_contacts", "primary_email=eq.quick-browser%40example.invalid&select=id");
  if (quickContacts.length !== 1) throw new Error("Contact Quick Add browser flow did not create exactly one canonical contact.");
  const quickLeads = await rows("os_leads", `contact_id=eq.${quickContacts[0].id}&inquiry_summary=eq.Synthetic%20direct%20birthday%20inquiry&select=id`);
  if (quickLeads.length !== 1) throw new Error("Lead Quick Add browser flow did not create exactly one canonical lead.");
  const quickEvents = await rows("os_events", "title=eq.Synthetic%20Quick%20Add%20date-only%20gig&select=id,historical_date,starts_at,timezone");
  if (quickEvents.length !== 1 || quickEvents[0].historical_date !== "2027-08-14" || quickEvents[0].starts_at !== null || quickEvents[0].timezone !== null) throw new Error("Date-only Event Quick Add browser flow did not preserve exact canonical date semantics.");
  const quickBookings = await rows("os_bookings", `event_id=eq.${quickEvents[0].id}&select=id,payment_status,total_amount,deposit_amount,balance_due`);
  if (quickBookings.length !== 1 || quickBookings[0].payment_status !== "unknown" || quickBookings[0].total_amount !== null || quickBookings[0].deposit_amount !== null || quickBookings[0].balance_due !== null) throw new Error("Booking Quick Add browser flow did not preserve zero-service unknown-payment semantics.");
  const quickServices = await rows("os_booking_services", `booking_id=eq.${quickBookings[0].id}&select=id`);
  if (quickServices.length !== 0) throw new Error("Booking Quick Add browser flow created an unselected service.");
  const quickNotes = await rows("os_event_notes", `event_id=eq.${quickEvents[0].id}&body=eq.Synthetic%20Owner-entered%20browser%20note.&select=id`);
  if (quickNotes.length !== 1) throw new Error("Note Quick Add browser flow did not create exactly one canonical event note.");

  if (!quickAddOnly) {
  await page.goto(`${appUrl}/admin/data-readiness`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Records & Intake" }).waitFor();

  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => { const heights = Array.from(document.querySelectorAll("main button, main input:not([type='hidden']):not([type='checkbox']):not([type='radio']), main select, main summary, main textarea")).map((element) => element.getBoundingClientRect().height).filter((height) => height > 0); return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, minimumActionHeight: heights.length ? Math.min(...heights) : 0 }; });
    if (geometry.scrollWidth > geometry.width || geometry.minimumActionHeight < 43.5) throw new Error(`Responsive interaction contract failed at ${viewport.width}px: ${JSON.stringify(geometry)}`);
    await page.screenshot({ path: `artifacts/data-readiness/owner-${viewport.width}x${viewport.height}.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Create contact" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Display name").fill("Synthetic browser contact");
  await editor.getByLabel("Email", { exact: true }).fill("browser-contact@example.invalid");
  await editor.getByRole("button", { name: "Create contact" }).click();
  await page.getByText(/Contact create recorded with provenance/).waitFor();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("Synthetic browser contact");
  await page.getByRole("button", { name: /Synthetic browser contact/ }).click();
  await verifyEditorSurface(page, "record-details-contact");
  await editor.getByLabel("Display name").fill("Synthetic browser contact corrected");
  await editor.getByRole("button", { name: "Save contact" }).click();
  await page.getByText(/Contact update recorded with provenance/).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Archive" }).click();
  await page.getByText(/Contact archive recorded with provenance/).waitFor();
  await editor.getByRole("button", { name: "Restore" }).click();
  await page.getByText(/Contact restore recorded with provenance/).waitFor();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("");
  await page.locator(".record-type-tabs").getByRole("button", { name: "Gigs" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("70th Birthday Karaoke");
  const veraRow=page.getByRole("button",{name:/70th Birthday Karaoke/});
  await veraRow.getByText(/6:00 PM CDT/).waitFor();
  await veraRow.click();
  if(await editor.getByLabel("Starts").inputValue()!=="2026-08-22T18:00"||await editor.getByLabel("Ends").inputValue()!=="2026-08-22T22:30")throw new Error("Event-local Central time was converted to the browser's Eastern timezone.");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("");
  await page.getByPlaceholder("Search names, titles, source…").fill("Synthetic corrected event");
  await page.getByRole("button", { name: /Synthetic corrected event/ }).click();
  await verifyEditorSurface(page, "record-details-timed-gig", { services: true });
  await editor.getByLabel("Title").fill("Synthetic browser-corrected event");
  await editor.getByRole("button", { name: "Save gig" }).click();
  await page.getByText(/Event update recorded with provenance/).waitFor();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.locator(".record-type-tabs").getByRole("button", { name: "Archived" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("Synthetic gig success 19");
  await page.getByRole("button", { name: /Synthetic gig success 19/ }).click();
  await editor.getByText("Time not provided", { exact: true }).waitFor();
  await verifyEditorSurface(page, "record-details-date-only-gig", { services: true });
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.locator(".record-type-tabs").getByRole("button", { name: "Leads" }).click();
  await page.getByPlaceholder("Search names, titles, source…").fill("");
  await page.locator(".record-row").first().click();
  await editor.getByLabel("Status").selectOption({ label: "follow up" });
  await editor.getByLabel("Next follow-up").fill("2026-10-21");
  await editor.getByRole("button", { name: "Save lead" }).click();
  const leadFeedback = editor.locator(".operational-message");
  await leadFeedback.waitFor();
  const leadMessage = await leadFeedback.innerText();
  if (!/Lead update recorded with provenance/.test(leadMessage)) throw new Error(`Synthetic lead edit failed: ${leadMessage}`);
  await editor.getByRole("button", { name: "Close editor" }).click();

  const intakeTab = page.getByRole("button", { name: "Reviewed Intake" });
  await intakeTab.focus();
  await page.keyboard.press("Enter");
  if ((await intakeTab.getAttribute("aria-current")) !== "page") throw new Error("Keyboard section navigation failed.");
  const manifest = { contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic browser review", items: [{ key: "contact.browser-1", type: "contact", sourceHash: "9".repeat(64), sourceRef: "synthetic/browser-1", uncertainFields: [], data: { displayName: "Synthetic browser import", primaryEmail: "browser-import@example.invalid" } }] };
  await page.getByText("Stage reviewed intake").click();
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
  }
  if (quickAddOnly) await ownerContext.close();

  for (const user of users.slice(1)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const deniedPage = await context.newPage();
    await signIn(deniedPage, user.email, quickAddOnly ? "/admin/quick-add" : "/admin/data-readiness");
    await deniedPage.waitForURL(/\/access-denied$/);
    if (!deniedPage.url().endsWith("/access-denied")) throw new Error(`${user.role} reached the Owner-only route.`);
    await context.close();
  }

  if (consoleErrors.length || serverFailures.length) throw new Error(`Browser/runtime errors occurred: ${JSON.stringify({ consoleErrors, serverFailures })}`);
  console.log(`${quickAddOnly ? "Owner Quick Add" : "Data Readiness"} authenticated browser verification passed with synthetic local Owner, Manager, Staff, and Host identities.`);
} finally {
  await browser.close();
  for (const id of createdIds) {
    try { await admin(`/users/${id}`, { method: "DELETE" }); } catch { /* The local stack is destroyed after the job. */ }
  }
}
