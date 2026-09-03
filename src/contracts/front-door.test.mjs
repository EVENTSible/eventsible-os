import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const page = fs.readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
const styles = fs.readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

test("public front door exposes only current verified visitor routes", () => {
  assert.match(page, /What are you here to do\?/);
  assert.match(page, /https:\/\/eventsible\.info\/discover/);
  assert.match(page, /https:\/\/build\.eventsible\.info\/build\?start=choose/);
  assert.match(page, /href: "\/weddinghero"/);
  assert.match(page, /https:\/\/eventsible\.app\//);
  assert.match(page, /https:\/\/eventsible\.info\/fast-track/);
  assert.match(page, /href="\/admin"/);
  assert.doesNotMatch(page, /client\.eventsible\.biz|eventsible\.shop/);
});

test("root is public routing content rather than an admin redirect or data surface", () => {
  assert.doesNotMatch(page, /redirect\s*\(\s*["']\/admin/);
  assert.doesNotMatch(page, /createServerSupabase|service_role|SERVICE_ROLE|\.from\s*\(/);
  assert.match(page, /<main className="front-door">/);
  assert.match(page, /<h1 id="front-door-title">/);
  assert.match(page, /Excellence in Event Entertainment/);
});

test("front door preserves accessible responsive interaction contracts", () => {
  assert.match(styles, /\.front-door a:focus-visible/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(page, /aria-label="Choose your EVENTSible experience"/);
});
