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
  assert.equal(music.items.find((item) => item.label === "Must-play highlights").value, "1. Song or artist: September · Earth, Wind & Fire\n2. Song or artist: Crazy in Love · Beyoncé");
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

test("Wedding Hero formats structured processional, speaker, timeline, and service details", () => {
  const sheet = buildWeddingDaySheet({
    ceremony_participants: [{ name: "Sam", role: "Officiant" }, { name: "Casey", role: "Bride", escortedBy: "Morgan" }],
    blessing_and_toasts: [{ name: "Taylor", moment: "Blessing", microphone: "Yes" }],
    reception_timeline_known: "yes",
    reception_timeline: [{ moment: "Grand entrance", time: "18:00", cue: "September" }],
    booked_services: [{ service: "Photo Booth", status: "booked", location: "Lobby" }],
  });

  const ceremony = sheet.sections.find((section) => section.title === "Ceremony cues");
  assert.ok(ceremony.items.find((item) => item.label === "Processional order").value.includes("Role: Bride"));
  const reception = sheet.sections.find((section) => section.title === "Reception flow");
  assert.ok(reception.items.find((item) => item.label === "Master timeline").value.includes("Grand entrance"));
  assert.ok(reception.items.find((item) => item.label.includes("toast speakers")).value.includes("Microphone needed: Yes"));
  const logistics = sheet.sections.find((section) => section.title === "Venue and production logistics");
  assert.ok(logistics.items.find((item) => item.label === "EVENTSible services").value.includes("Setup: Lobby"));
});

test("Wedding Hero keeps unsure gated logistics visibly pending", () => {
  const sheet = buildWeddingDaySheet({
    reception_timeline_known: "unsure",
    venue_contact_known: "unsure",
    venue_access_known: "unsure",
  });

  const reception = sheet.sections.find((section) => section.title === "Reception flow");
  assert.equal(reception.items.find((item) => item.label === "Timeline status").value, "We'll add this later");
  assert.ok(sheet.missing.includes("Reception timeline"));
  assert.ok(sheet.missing.includes("Venue coordinator"));
  assert.ok(sheet.missing.includes("Venue access time"));
});

test("Wedding Hero keeps earlier saved service and music notes visible", () => {
  const sheet = buildWeddingDaySheet({
    ceremony_special_music: "Live violin during unity ceremony",
    favorite_genres: ["Motown", "Disco"],
    photo_booth_plan: "Lobby from 7:00 to 10:00",
    power_available: true,
  });

  const ceremony = sheet.sections.find((section) => section.title === "Ceremony cues");
  assert.equal(ceremony.items.find((item) => item.label === "Saved ceremony special music").value, "Live violin during unity ceremony");
  const music = sheet.sections.find((section) => section.title === "Music and special moments");
  assert.equal(music.items.find((item) => item.label === "Saved favorite genres and artists").value, "Motown\nDisco");
  const logistics = sheet.sections.find((section) => section.title === "Venue and production logistics");
  assert.equal(logistics.items.find((item) => item.label === "Saved Photo Booth plan").value, "Lobby from 7:00 to 10:00");
  assert.equal(logistics.items.find((item) => item.label === "Saved reliable power availability").value, "Yes");
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
