import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const page = fs.readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
const eventHero = fs.readFileSync(fileURLToPath(new URL("../app/eventhero/page.tsx", import.meta.url)), "utf8");
const styles = fs.readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

test("public front door routes each audience to a current, intentional destination", () => {
  assert.match(page, /https:\/\/eventsible\.info/);
  assert.match(page, /https:\/\/build\.eventsible\.info\/build\?start=choose/);
  assert.match(page, /href: "\/weddinghero"/);
  assert.match(page, /href: "\/eventhero"/);
  assert.match(page, /https:\/\/eventsible\.app/);
  assert.match(page, /https:\/\/eventsible\.info\/fast-track/);
  assert.match(page, /href="\/admin"/);
  assert.doesNotMatch(page, /client\.eventsible\.biz|eventsible\.shop/);
});

test("root is a public company one-sheet rather than an admin redirect or data surface", () => {
  assert.doesNotMatch(page, /redirect\s*\(\s*["']\/admin/);
  assert.doesNotMatch(page, /createServerSupabase|service_role|SERVICE_ROLE|\.from\s*\(/);
  assert.match(page, /<main className="front-door">/);
  assert.match(page, /<h1 id="front-door-title">/);
  assert.match(page, /Excellence in Event Entertainment/);
  assert.match(page, /DJ \+ MC/);
  assert.match(page, /Karaoke/);
  assert.match(page, /Photo Booths/);
  assert.match(page, /EVENTSible Live/);
  assert.match(page, /South Bend, Indiana/);
  assert.match(page, /approximately 300 miles/);
});

test("front door uses the approved logo and verified contact details", () => {
  assert.match(page, /src="\/brand\/eventsible-logo\.png"/);
  assert.match(page, /\(574\) 274-5213/);
  assert.match(page, /tel:\+15742745213/);
  assert.match(page, /sms:\+15742745213/);
  assert.match(page, /thepartys@eventsible\.info/);
  assert.doesNotMatch(page, /Wordmark/);
});

test("Event Hero is honest about preview status and is not represented as the quote builder", () => {
  assert.match(eventHero, /Event Hero · Public preview/);
  assert.match(eventHero, /full public Event Hero experience is coming soon/i);
  assert.match(eventHero, /not choose services or calculate a quote/i);
  assert.match(eventHero, /https:\/\/build\.eventsible\.info\/build\?start=choose/);
  assert.doesNotMatch(eventHero, /createServerSupabase|service_role|SERVICE_ROLE|\.from\s*\(/);
});

test("front door preserves accessible responsive interaction contracts", () => {
  assert.match(styles, /\.front-door a:focus-visible/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /\.front-door-hero-actions > a \{ height:\s*48px;/);
  assert.match(styles, /\.front-door-contact-actions \{[^}]*flex-wrap:\s*nowrap;/);
  assert.match(page, /aria-label="EVENTSible gateway links"/);
  assert.match(page, /aria-label="Current client and live event access"/);
});

test("front door keeps the one-sheet dense without shrinking interaction targets", () => {
  assert.match(styles, /\.front-door-hero \{[\s\S]*?min-height:\s*480px;/);
  assert.match(styles, /\.front-door-path \{[^}]*min-height:\s*300px;/);
  assert.match(styles, /\.front-door-hero-actions \{ display:\s*grid; grid-template-columns:\s*1fr 1fr;/);
  assert.match(styles, /\.front-door-service-grid \{ grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.front-door-contact-actions a,[\s\S]*?min-height:\s*44px/);
});
