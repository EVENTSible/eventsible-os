import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { safeStaffNext, staffLoginNotice } from "../lib/staff-auth.mjs";

test("staff next routes stay inside authenticated admin surfaces", () => {
  assert.equal(safeStaffNext("/admin/gigs/example"), "/admin/gigs/example");
  assert.equal(safeStaffNext("//attacker.example"), "/admin");
  assert.equal(safeStaffNext("https://attacker.example"), "/admin");
  assert.equal(safeStaffNext("/client"), "/admin");
});

test("login notices are generic and do not disclose account existence", () => {
  assert.match(staffLoginNotice("access"), /not approved/i);
  assert.match(staffLoginNotice("auth"), /could not be completed/i);
  assert.equal(staffLoginNotice("unknown"), "");
});

test("staff login offers password auth and preserves passwordless fallback without signup", async () => {
  const source = await readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /type="password"/);
  assert.match(source, /signInWithPassword/);
  assert.match(source, /Email or password was not accepted/);
  assert.match(source, /signInWithOtp/);
  assert.match(source, /shouldCreateUser: false/);
  assert.match(source, /encodeURIComponent\(safeStaffNext\(next\)\)/);
  assert.match(source, /Email me a magic link instead/);
  assert.doesNotMatch(source, /\.auth\.signUp|Create Account|Create account/);
});

test("admin authorization remains server-side and role-based", async () => {
  const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  assert.match(adminPage, /supabase\.auth\.getUser\(\)/);
  assert.match(adminPage, /isStaffRole\(role\)/);
  assert.match(actions, /requireStaffSupabase\(\)/);
});

test("callback and server client preserve the existing cookie session model", async () => {
  const callback = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
  const serverClient = await readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8");
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /queryNext\?\.startsWith\("\/admin"\)/);
  assert.match(serverClient, /cookieStore\.set/);
});
