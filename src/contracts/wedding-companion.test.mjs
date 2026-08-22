import assert from "node:assert/strict";
import test from "node:test";
import {
  answerHasValue,
  guidedPromptIdeas,
  guidedResumeSectionKey,
  isQuestionVisible,
  normalizeWeddingAnswer,
  requiredQuestionKeys,
  weddingProgress,
  weddingQuestionMap,
  WEDDING_SECTIONS,
} from "../lib/wedding-companion.mjs";

test("Wedding Companion provides seven focused planning sections", () => {
  assert.deepEqual(WEDDING_SECTIONS.map((section) => section.key), [
    "event_basics",
    "ceremony",
    "reception",
    "songs_and_dances",
    "music",
    "logistics",
    "services",
  ]);
  assert.ok(WEDDING_SECTIONS.flatMap((section) => section.questions).length >= 45);
});

test("Wedding Companion progress counts visible required answers", () => {
  const keys = requiredQuestionKeys({ ceremony_included: false });
  const answers = Object.fromEntries(keys.map((key) => [key, key === "ceremony_included" ? false : "complete"]));
  assert.equal(weddingProgress(answers), 100);
  delete answers.first_dance_song;
  assert.ok(weddingProgress(answers) < 100);
});

test("Wedding Companion condition hides ceremony details when ceremony service is not included", () => {
  const ceremonyLocation = weddingQuestionMap().get("ceremony_location");
  assert.equal(isQuestionVisible(ceremonyLocation, { ceremony_included: false }), false);
  assert.equal(isQuestionVisible(ceremonyLocation, { ceremony_included: true }), true);
});

test("Wedding Companion unlocks ceremony, rehearsal, and cocktail-hour follow-ups only when relevant", () => {
  const map = weddingQuestionMap();
  assert.equal(isQuestionVisible(map.get("guest_arrival_time"), { ceremony_included: true }), true);
  assert.equal(isQuestionVisible(map.get("lineup_time"), { ceremony_included: true }), true);
  assert.equal(isQuestionVisible(map.get("rehearsal_date"), { ceremony_included: true, rehearsal_needed: false }), false);
  assert.equal(isQuestionVisible(map.get("rehearsal_date"), { ceremony_included: true, rehearsal_needed: true }), true);

  assert.equal(isQuestionVisible(map.get("cocktail_hour_location"), { cocktail_hour_included: false }), false);
  assert.equal(isQuestionVisible(map.get("cocktail_hour_sound"), { cocktail_hour_included: true }), true);
});

test("Wedding Companion requires the wedding date only after it is confirmed", () => {
  const weddingDate = weddingQuestionMap().get("event_date");
  assert.equal(weddingDate.fieldType, "date");
  assert.equal(weddingDate.required, true);
  assert.equal(isQuestionVisible(weddingDate, { event_date_confirmed: false }), false);
  assert.equal(isQuestionVisible(weddingDate, { event_date_confirmed: true }), true);

  const unconfirmedKeys = requiredQuestionKeys({ event_date_confirmed: false, ceremony_included: false });
  const confirmedKeys = requiredQuestionKeys({ event_date_confirmed: true, ceremony_included: false });
  assert.equal(unconfirmedKeys.includes("event_date"), false);
  assert.equal(confirmedKeys.includes("event_date"), true);
});

test("Wedding Companion keeps song moments together and reveals selected special-dance songs", () => {
  const songSection = WEDDING_SECTIONS.find((section) => section.key === "songs_and_dances");
  const songKeys = new Set(songSection.questions.map((question) => question.key));
  assert.ok(songKeys.has("first_dance_song"));
  assert.ok(songKeys.has("must_play_list"));
  assert.ok(songKeys.has("ceremony_processional_music"));
  assert.ok(songKeys.has("couple_entrance_song"));

  const cakeSong = weddingQuestionMap().get("cake_cutting_song");
  assert.equal(isQuestionVisible(cakeSong, { formal_moments: [] }), false);
  assert.equal(isQuestionVisible(cakeSong, { formal_moments: ["Cake cutting"] }), true);
});

test("Wedding Companion offers guided prompt starter ideas for open-ended planning questions", () => {
  assert.ok(guidedPromptIdeas("wedding_vision").includes("Elegant, classic, and polished"));
  assert.ok(guidedPromptIdeas("special_considerations").includes("Family dynamics to handle gently"));
  assert.ok(guidedPromptIdeas("cocktail_hour_sound").includes("DJ-curated upbeat mingling music"));
});

test("Wedding Companion resumes a device draft at the last worked or nearest incomplete section", () => {
  const completeBasics = {
    event_date_confirmed: true,
    event_date: "2026-10-10",
    partner_one_name: "Alex",
    partner_two_name: "Jordan",
    guest_count: 120,
    day_of_contact: "Morgan",
    day_of_contact_phone: "555-0100",
    wedding_vision: "Elegant dinner and full dance floor",
    ceremony_included: false,
  };

  assert.equal(guidedResumeSectionKey(completeBasics, "event_basics"), "reception");
  assert.equal(guidedResumeSectionKey({}, "ceremony"), "ceremony");
});

test("Wedding Companion normalizes boolean, numeric, repeater, and text answers", () => {
  const map = weddingQuestionMap();
  assert.equal(normalizeWeddingAnswer(map.get("ceremony_included"), "yes"), true);
  assert.equal(normalizeWeddingAnswer(map.get("guest_count"), "145"), 145);
  assert.deepEqual(normalizeWeddingAnswer(map.get("must_play_list"), "Song A\n\nSong B"), ["Song A", "Song B"]);
  assert.equal(normalizeWeddingAnswer(map.get("partner_one_name"), "  Alex  "), "Alex");
});

test("Wedding Companion treats false as an answered yes-or-no value", () => {
  assert.equal(answerHasValue(false), true);
  assert.equal(answerHasValue([]), false);
  assert.equal(answerHasValue("   "), false);
});
