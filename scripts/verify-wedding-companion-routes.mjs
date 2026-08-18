import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3107;
const origin = `http://127.0.0.1:${port}`;
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const server = spawn(process.execPath, [nextBin.pathname, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
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
  throw new Error(`Wedding Companion smoke server did not start.\n${output}`);
}

async function verify() {
  await waitForServer();

  const login = await fetch(`${origin}/client/login`, { redirect: "manual" });
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Your Wedding Companion/);
  assert.match(loginHtml, /Email my sign-in link/);

  const client = await fetch(`${origin}/client`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(client.status));
  assert.match(client.headers.get("location") ?? "", /\/client\/login/);

  const wedding = await fetch(`${origin}/client/wedding/00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(wedding.status));
  assert.match(wedding.headers.get("location") ?? "", /\/client\/login/);

  const staffReview = await fetch(`${origin}/admin/wedding/00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(staffReview.status));
  assert.match(staffReview.headers.get("location") ?? "", /\/login/);

  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);

  console.log("Wedding Companion route smoke verification passed.");
}

try {
  await verify();
} finally {
  server.kill("SIGTERM");
}
