import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 3107;
const origin = `http://127.0.0.1:${port}`;
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const server = spawn(process.execPath, [fileURLToPath(nextBin), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += String(chunk); });
server.stderr.on("data", (chunk) => { output += String(chunk); });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Wedding Hero smoke server did not start.\n${output}`);
}

async function verify() {
  await waitForServer();

  const login = await fetch(`${origin}/client/login`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(login.status));
  assert.match(login.headers.get("location") ?? "", /\/weddinghero/);

  const homepage = await fetch(`${origin}/weddinghero`, { redirect: "manual" });
  assert.equal(homepage.status, 200);
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, /Wedding Hero/);
  assert.match(homepageHtml, /Interactive Companion/);
  assert.match(homepageHtml, /Traditional Form/);
  assert.match(homepageHtml, /Printable Planner/);
  assert.match(homepageHtml, /private access/i);
  assert.match(homepageHtml, /\/client\/wedding\?mode=guided/);
  assert.match(homepageHtml, /Wedding resources/i);
  assert.match(homepageHtml, /Meeting Companion/);
  assert.match(homepageHtml, /Need help/);
  assert.match(homepageHtml, /\+1 \(574\) 274-5213/);
  assert.match(homepageHtml, /tel:\+15742745213/);
  assert.match(homepageHtml, /sms:\+15742745213/);
  assert.match(homepageHtml, /mailto:/);
  assert.match(homepageHtml, /Request callback/);

  const publicPlanner = await fetch(`${origin}/client/wedding?mode=form`, { redirect: "manual" });
  assert.equal(publicPlanner.status, 200);
  const publicPlannerHtml = await publicPlanner.text();
  assert.match(publicPlannerHtml, /No account or email required/);
  assert.match(publicPlannerHtml, /Traditional planning form/);
  assert.match(publicPlannerHtml, /Songs or artists we love and must play/);
  assert.match(publicPlannerHtml, /Add speaker/);
  assert.match(publicPlannerHtml, /Do you already know your reception timeline/);
  assert.match(publicPlannerHtml, /Music styles and preferences/);
  assert.match(publicPlannerHtml, /EVENTSible services/);
  assert.match(publicPlannerHtml, /Day-of Cheat Sheet/);
  assert.match(publicPlannerHtml, /Helpful right now/);
  assert.match(publicPlannerHtml, /Song &amp; Moment Guide/);
  assert.match(publicPlannerHtml, /Ceremony location or setup area/);
  assert.match(publicPlannerHtml, /Rehearsal date/);
  assert.match(publicPlannerHtml, /Cocktail-hour location/);
  assert.match(publicPlannerHtml, /Wedding-party introduction order/);
  assert.match(publicPlannerHtml, /Reception timeline/);
  assert.match(publicPlannerHtml, /Meal service details/);
  assert.match(publicPlannerHtml, /Venue coordinator contact/);
  assert.match(publicPlannerHtml, /Exact version or link/);
  assert.match(publicPlannerHtml, /\+1 \(574\) 274-5213/);
  assert.match(publicPlannerHtml, /tel:\+15742745213/);
  assert.match(publicPlannerHtml, /sms:\+15742745213/);
  assert.match(publicPlannerHtml, /Request callback/);
  assert.match(publicPlannerHtml, /Send to EVENTSible/);
  assert.match(publicPlannerHtml, /Saved locally on this device/);
  assert.match(publicPlannerHtml, /Not sent yet/);
  assert.match(publicPlannerHtml, /Autosave does not notify EVENTSible/);

  const guidedPlanner = await fetch(`${origin}/client/wedding?mode=guided`, { redirect: "manual" });
  assert.equal(guidedPlanner.status, 200);
  const guidedPlannerHtml = await guidedPlanner.text();
  assert.match(guidedPlannerHtml, /Is your wedding date confirmed/);
  assert.doesNotMatch(guidedPlannerHtml, /EVENTSible attire notes/);

  const printablePlanner = await fetch(`${origin}/client/wedding?mode=print`, { redirect: "manual" });
  assert.equal(printablePlanner.status, 200);
  const printablePlannerHtml = await printablePlanner.text();
  assert.match(printablePlannerHtml, /Printable Wedding Hero/);
  assert.match(printablePlannerHtml, /Ceremony location or setup area/);
  assert.match(printablePlannerHtml, /Rehearsal date/);
  assert.match(printablePlannerHtml, /Cocktail-hour location/);
  assert.match(printablePlannerHtml, /Wedding-party introduction order/);
  assert.match(printablePlannerHtml, /Reception timeline/);
  assert.match(printablePlannerHtml, /Meal service details/);
  assert.match(printablePlannerHtml, /Venue coordinator contact/);
  assert.match(printablePlannerHtml, /Exact version or link/);
  assert.match(printablePlannerHtml, /Setup location/);
  assert.match(printablePlannerHtml, /Send to EVENTSible/);

  const dayOfSheet = await fetch(`${origin}/client/wedding?mode=print&view=day-of`, { redirect: "manual" });
  assert.equal(dayOfSheet.status, 200);
  const dayOfSheetHtml = await dayOfSheet.text();
  assert.match(dayOfSheetHtml, /Day-of Production Cheat Sheet/);
  assert.match(dayOfSheetHtml, /Still needs confirmation/);
  assert.match(dayOfSheetHtml, /View full planner/);

  const resources = await fetch(`${origin}/client/wedding/resources`, { redirect: "manual" });
  assert.equal(resources.status, 200);
  const resourcesHtml = await resources.text();
  assert.match(resourcesHtml, /Wedding Hero Resources/);
  assert.match(resourcesHtml, /Budget Tracker/);
  assert.match(resourcesHtml, /Guestbook Starter/);

  const meetingCompanion = await fetch(`${origin}/client/wedding/resources/meeting-companion`, { redirect: "manual" });
  assert.equal(meetingCompanion.status, 200);
  const meetingCompanionHtml = await meetingCompanion.text();
  assert.match(meetingCompanionHtml, /Wedding Planning Meeting Companion/);
  assert.match(meetingCompanionHtml, /Ceremony walkthrough/);
  assert.match(meetingCompanionHtml, /Print or save as PDF/);

  const client = await fetch(`${origin}/client`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(client.status));
  assert.match(client.headers.get("location") ?? "", /\/client\/login/);

  const wedding = await fetch(`${origin}/client/wedding/00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(wedding.status));
  assert.match(wedding.headers.get("location") ?? "", /\/client\/login/);

  const staffReview = await fetch(`${origin}/admin/wedding/00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
  if ([302, 303, 307, 308].includes(staffReview.status)) {
    assert.match(staffReview.headers.get("location") ?? "", /\/login/);
  } else {
    assert.equal(staffReview.status, 200);
    assert.match(await staffReview.text(), /NEXT_REDIRECT[^<]*\/login/);
  }

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);

  console.log("Wedding Hero route smoke verification passed.");
}

try {
  await verify();
} finally {
  server.kill("SIGTERM");
}
