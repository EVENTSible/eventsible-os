import { chromium } from "playwright";

const appUrl = process.env.DATA_READINESS_APP_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.DATA_READINESS_TEST_PASSWORD ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(appUrl) ||
    !/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) || !serviceKey || !password) {
  throw new Error("Disposable loopback browser-test environment required.");
}
const suffix = crypto.randomUUID().slice(0, 8);
const users = [
  { email: `opportunity-owner-${suffix}@example.invalid`, role: "owner" },
  { email: `opportunity-staff-${suffix}@example.invalid`, role: "staff" },
  { email: `opportunity-client-${suffix}@example.invalid`, role: "client" },
];
const createdIds = [];
const errors = [];
const screenshot = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k94AAAAASUVORK5CYII=", "base64");
const api = async (path, init = {}) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init, headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Disposable Supabase returned ${response.status} for ${path.split("?")[0]}.`);
  return response.status === 204 ? null : response.json();
};
const rows = (table, query) => api(`/rest/v1/${table}?${query}`);
async function signIn(page, email, path) {
  await page.goto(`${appUrl}/login?next=${path}`, { waitUntil: "networkidle" });
  await page.getByLabel("Business email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}
const browser = await chromium.launch({ headless: true });
try {
  for (const user of users) {
    const created = await api("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({
      email: user.email, password, email_confirm: true, app_metadata: { role: user.role },
    }) });
    createdIds.push(created.id);
  }
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerContext.newPage();
  owner.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  owner.on("response", response => {
    if (response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  const formPath = "/admin/mission-control/follow-ups/new";
  const boardPath = "/admin/mission-control/follow-ups";
  await signIn(owner, users[0].email, formPath);
  await owner.getByRole("heading", { name: "New Opportunity" }).waitFor();
  await owner.getByLabel("Original conversation URL").fill(`https://www.gigsalad.com/synthetic-ci-${suffix}`);
  await owner.getByLabel("Original client message (or attach screenshot)").fill("Synthetic request for DJ services. No actual customer content.");
  await owner.getByLabel("Inquiry screenshot (optional)").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: screenshot });
  await owner.getByLabel("Client name").fill(`Synthetic Browser ${suffix}`);
  await owner.getByLabel("Email", { exact: true }).fill(`opportunity-client-${suffix}@example.invalid`);
  await owner.getByLabel("Event type").fill("Synthetic party");
  await owner.getByLabel("What does the client want?").fill("DJ and microphone for a synthetic party");
  await owner.getByLabel("Quote status").selectOption("confirmed_sent");
  await owner.getByLabel("Actual amount offered or drafted ($)").fill("425");
  await owner.getByLabel("Deposit ($)").fill("105");
  await owner.getByLabel("Service options").fill("DJ and microphone");
  await owner.getByLabel("Sent date and time, Indiana").fill("2026-11-17T14:00");
  await owner.getByLabel("Original sent reply").fill("Synthetic verified sent quote for test only.");
  await owner.getByLabel(/I checked the original conversation/).check();
  await owner.getByLabel("Next action date").fill("2026-11-17");
  await owner.getByLabel(/I checked these details against/).check();
  await owner.getByRole("button", { name: "Save opportunity and task" }).click();
  await owner.getByText("Opportunity saved with its task and private source history.", { exact: false }).waitFor();
  const contacts = await rows("os_contacts", `primary_email=eq.opportunity-client-${suffix}%40example.invalid&select=id`);
  if (contacts.length !== 1) throw new Error("Owner intake did not create exactly one canonical contact.");
  const leads = await rows("os_leads", `contact_id=eq.${contacts[0].id}&select=id,event_id,assigned_to`);
  if (leads.length !== 1 || leads[0].assigned_to) throw new Error("Owner intake did not create one unclaimed canonical lead.");
  const lead = leads[0];
  const [quotes, tasks, files, activity] = await Promise.all([
    rows("os_quote_versions", `lead_id=eq.${lead.id}&select=status,total_amount,deposit_amount,sent_at`),
    rows("os_tasks", `lead_id=eq.${lead.id}&select=id,due_at,assigned_to`),
    rows("os_files", `event_id=eq.${lead.event_id}&select=bucket_id,visibility,object_path`),
    rows("os_activity_events", `event_id=eq.${lead.event_id}&event_type=eq.opportunity.intake_created&select=id`),
  ]);
  if (quotes.length !== 1 || quotes[0].status !== "sent" || Number(quotes[0].total_amount) !== 425 ||
      Number(quotes[0].deposit_amount) !== 105 || !quotes[0].sent_at || tasks.length !== 1 ||
      files.length !== 1 || files[0].bucket_id !== "opportunity-evidence" ||
      files[0].visibility !== "staff_only" || activity.length !== 1) {
    throw new Error("Owner browser intake did not atomically create the verified quote, task, file reference and history.");
  }
  await owner.goto(`${appUrl}${boardPath}?lead=${lead.id}`, { waitUntil: "networkidle" });
  await owner.getByRole("heading", { name: "Team Follow-Ups" }).waitFor();
  await owner.getByText("Original inquiry and reply").click();
  await owner.getByText("Synthetic verified sent quote for test only.").waitFor();
  await owner.getByText("Private screenshots").waitFor();
  await owner.getByRole("navigation", { name: "Follow-up filters" }).getByRole("link", { name: /^Overdue/ }).waitFor();
  for (const width of [390, 1440]) {
    await owner.setViewportSize({ width, height: 844 });
    if (await owner.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
      throw new Error(`Follow-up board overflows at ${width}px.`);
    }
  }
  await owner.goto(`${appUrl}${formPath}`, { waitUntil: "networkidle" });
  await owner.getByLabel("Original conversation URL").fill(`https://www.gigsalad.com/synthetic-ci-${suffix}`);
  await owner.getByLabel("Original client message (or attach screenshot)").fill("Same synthetic conversation");
  await owner.getByLabel("Client name").fill("Synthetic duplicate");
  await owner.getByLabel("Email", { exact: true }).fill(`duplicate-${suffix}@example.invalid`);
  await owner.getByLabel("Event type").fill("Synthetic party");
  await owner.getByLabel("What does the client want?").fill("Duplicate request");
  await owner.getByLabel(/I checked these details against/).check();
  await owner.getByRole("button", { name: "Save opportunity and task" }).click();
  await owner.getByText("This GigSalad conversation already exists.", { exact: false }).waitFor();
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await signIn(staff, users[1].email, `${boardPath}?lead=${lead.id}`);
  await staff.getByRole("button", { name: "Claim this follow-up" }).click();
  await staff.getByText("Follow-up saved with its activity history.").waitFor();
  await staff.goto(`${appUrl}${boardPath}?lead=${lead.id}`, { waitUntil: "networkidle" });
  for (const [label, body, button] of [
    ["Team note", "Synthetic private note", "Add private note"],
    ["Private reply draft", "Synthetic draft, no message sent", "Save draft only"],
    ["Record contact attempt", "Synthetic phone attempt, no connection", "Record outcome"],
  ]) {
    await staff.getByLabel(label).fill(body);
    await staff.getByRole("button", { name: button }).click();
    await staff.getByText(button === "Save draft only" ? "Private draft saved. No client was contacted." :
      button === "Record outcome" ? "Contact attempt recorded. HQ sent no message." :
      "Follow-up saved with its activity history.").waitFor();
    await staff.goto(`${appUrl}${boardPath}?lead=${lead.id}`, { waitUntil: "networkidle" });
  }
  await staff.getByLabel("Next follow-up").fill("2027-02-01");
  await staff.getByRole("button", { name: "Set date" }).click();
  await staff.getByText("Follow-up saved with its activity history.").waitFor();
  const updatedLead = await rows("os_leads", `id=eq.${lead.id}&select=assigned_to,next_follow_up_at`);
  if (updatedLead[0]?.assigned_to !== createdIds[1] || !updatedLead[0]?.next_follow_up_at?.startsWith("2027-02-01")) {
    throw new Error("Staff claim and follow-up date did not reach the canonical lead.");
  }
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await signIn(client, users[2].email, boardPath);
  await client.goto(`${appUrl}${boardPath}?lead=${lead.id}`, { waitUntil: "networkidle" });
  const clientPath = new URL(client.url()).pathname;
  if (!["/access-denied", "/login"].includes(clientPath) ||
      await client.getByRole("heading", { name: "Team Follow-Ups" }).count()) {
    throw new Error(`Client could open private team correspondence; route: ${clientPath}.`);
  }
  if (errors.length) throw new Error(`Owner browser runtime errors: ${errors.slice(0, 3).join(" | ")}`);
  console.log("PASS: isolated Owner screenshot intake, confirmed quote, duplicate guard, staff claim, notes, drafts, outcome, schedule, responsive board, and client boundary.");
} finally {
  for (const id of createdIds) await api(`/auth/v1/admin/users/${id}`, { method: "DELETE" }).catch(() => {});
  await browser.close();
}
