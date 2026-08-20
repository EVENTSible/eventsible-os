import assert from "node:assert/strict";
import test from "node:test";
import { buildWeddingDaySheet } from "../lib/wedding-day-sheet.mjs";

test("Wedding Hero builds a readable production title, date, and time", () => {
  const sheet = buildWeddingDaySheet({
    partner_one_name: "Casey",
    partner_two_name: "Riley",
    event_date: "2026-10-24",
    ceremony_start_time: "16:30",
  });

  assert.equal(sheet.coupleName, "Casey & Riley");
  assert.equal(sheet.eventDate, "October 24, 2026");
  const ceremony = sheet.sections.find((section) => section.title === "Ceremony cues");
  assert.equal(ceremony.items.find((item) => item.label === "Ceremony start").value, "4:30 PM");
});

test("Wedding Hero Day-of Cheat Sheet includes only answered details", () => {
  const sheet = buildWeddingDaySheet({
    partner_one_name: "Casey",
    must_play_list: ["September · Earth, Wind & Fire", "Crazy in Love · Beyoncé"],
  });

  const glance = sheet.sections.find((section) => section.title === "Wedding at a glance");
  assert.equal(glance.items.some((item) => item.label === "Wedding date"), false);
  assert.equal(glance.items.find((item) => item.label === "Couple").value, "Casey");
  const music = sheet.sections.find((section) => section.title === "Music and special moments");
  assert.equal(music.items.find((item) => item.label === "Must-play highlights").value, "September · Earth, Wind & Fire\nCrazy in Love · Beyoncé");
});

test("Wedding Hero flags conditional production details that still need confirmation", () => {
  const sheet = buildWeddingDaySheet({
    event_date_confirmed: true,
    ceremony_included: true,
    wedding_party_introductions: true,
  });

  assert.ok(sheet.missing.includes("Confirmed wedding date"));
  assert.ok(sheet.missing.includes("Ceremony start time"));
  assert.ok(sheet.missing.includes("Introduction order and pronunciations"));
});

test("Wedding Hero marks a complete production core as ready", () => {
  const sheet = buildWeddingDaySheet({
    partner_one_name: "Casey",
    partner_two_name: "Riley",
    day_of_contact: "Morgan, planner",
    day_of_contact_phone: "317-555-0100",
    reception_timeline: "6:00 PM introductions",
    first_dance_song: "At Last · Etta James",
    venue_contact: "Taylor · Venue Manager",
    venue_access_time: "14:00",
    load_in_instructions: "Use the west dock",
    event_date_confirmed: true,
    event_date: "2026-10-24",
    ceremony_included: true,
    ceremony_start_time: "16:30",
    wedding_party_introductions: true,
    introduction_order: ["Jordan and Avery", "Casey and Riley"],
  });

  assert.deepEqual(sheet.missing, []);
});
