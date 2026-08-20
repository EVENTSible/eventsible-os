import assert from "node:assert/strict";
import test from "node:test";
import {
  heroConfig,
  heroEventTitle,
  localDateTimeToIso,
  normalizeHeroStartInput,
  splitDisplayName,
} from "../lib/hero-self-start.mjs";

test("maps the two self-start Hero experiences", () => {
  assert.equal(heroConfig("wedding")?.title, "Wedding Hero");
  assert.equal(heroConfig("wedding")?.description, "Interactive Wedding Companion");
  assert.equal(heroConfig("wedding")?.templateName, "Wedding Hero");
  assert.equal(heroConfig("event")?.routeSegment, "event");
  assert.equal(heroConfig("unknown"), null);
});

test("normalizes a legacy wedding self-start without asserting booked status", () => {
  const result = normalizeHeroStartInput("wedding", {
    clientName: "  Taylor  Morgan ",
    startsAt: "2026-08-24T18:30",
    relationship: "booked",
    venueName: " The Barn ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.eventType, "Wedding");
  assert.equal(result.data.relationship, "booked");
  assert.equal(result.data.eventTitle, "Taylor Morgan's wedding");
  assert.match(result.data.startsAt, /^2026-08-24T22:30:00\.000Z$/);
});

test("requires an event type for Event Hero", () => {
  const result = normalizeHeroStartInput("event", {
    clientName: "Jordan",
    startsAt: "2026-12-12T19:00",
    relationship: "planning",
  });
  assert.deepEqual(result, { ok: false, message: "Choose an event type." });
});

test("name and title helpers keep canonical records readable", () => {
  assert.deepEqual(splitDisplayName("Avery Lee Carter"), {
    displayName: "Avery Lee Carter",
    firstName: "Avery",
    lastName: "Lee Carter",
  });
  assert.equal(heroEventTitle(heroConfig("event"), "Graduation Bash", "Avery"), "Graduation Bash");
});

test("converts Indiana local time across daylight saving time", () => {
  assert.equal(localDateTimeToIso("2026-01-10T18:00"), "2026-01-10T23:00:00.000Z");
  assert.equal(localDateTimeToIso("2026-07-10T18:00"), "2026-07-10T22:00:00.000Z");
  assert.equal(localDateTimeToIso("not-a-date"), null);
});
