import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { safeAuthCallbackNext, safeStaffNext, staffLoginNotice } from "../lib/staff-auth.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

test("staff next routes stay inside protected HQ", () => {
  assert.equal(safeStaffNext("/admin/calendar"), "/admin/calendar");
  assert.equal(safeStaffNext("//attacker.example"), "/admin");
  assert.equal(safeStaffNext("https://attacker.example/admin"), "/admin");
  assert.equal(safeStaffNext("/administrator"), "/admin");
  assert.equal(safeStaffNext("/client"), "/admin");
  assert.equal(safeAuthCallbackNext("/login/update-password"), "/login/update-password");
  assert.equal(safeAuthCallbackNext("https://attacker.example"), null);
});

test("staff login is password-first with accessible visibility and recovery controls", async () => {
  const source = await read("src/components/login-form.tsx");
  assert.match(source, /signInWithPassword/);
  assert.match(source, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(source, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(source, /Forgot or need to set your password\?/);
  assert.match(source, /Email or password was not accepted/);
  assert.doesNotMatch(source, /signInWithOtp|signUp|error\.message/);
});

test("staff recovery is generic and cannot create accounts", async () => {
  const source = await read("src/components/password-recovery-form.tsx");
  assert.match(source, /resetPasswordForEmail/);
  assert.match(source, /If this address is approved/);
  assert.match(source, /\/auth\/callback\?next=/);
  assert.doesNotMatch(source, /signInWithOtp|signUp|error\.message/);
});

test("password update requires an authenticated approved staff recovery session", async () => {
  const [page, form] = await Promise.all([
    read("src/app/login/update-password/page.tsx"),
    read("src/components/update-password-form.tsx"),
  ]);
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /isStaffRole\(data\.user\.app_metadata\?\.role\)/);
  assert.match(page, /redirect\("\/access-denied"\)/);
  assert.match(form, /updateUser\(\{ password \}\)/);
  assert.match(form, /signOut\(\{ scope: "local" \}\)/);
  assert.doesNotMatch(page + form, /user_metadata|SERVICE_ROLE|NEXT_PUBLIC_.*SECRET/);
});

test("staff callback admits only HQ or the exact recovery completion route", async () => {
  const callback = await read("src/app/auth/callback/route.ts");
  assert.match(callback, /safeAuthCallbackNext\(queryNext\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(staffLoginNotice("auth"), /could not be completed/i);
  assert.match(staffLoginNotice(undefined, "password-updated"), /Password updated/i);
});

test("client-facing passwordless login remains a separate unchanged surface", async () => {
  const clientLogin = await read("src/components/client-login-form.tsx");
  assert.match(clientLogin, /signInWithOtp/);
  assert.match(clientLogin, /shouldCreateUser: true/);
  assert.doesNotMatch(clientLogin, /signInWithPassword/);
});
