import assert from "node:assert/strict";
import test from "node:test";
import {
  answerHasValue,
  isQuestionVisible,
  normalizeWeddingAnswer,
  requiredQuestionKeys,
  weddingProgress,
  weddingQuestionMap,
  WEDDING_SECTIONS,
} from "../lib/wedding-companion.mjs";

test("Wedding Companion provides six focused planning sections", () => {
  assert.deepEqual(WEDDING_SECTIONS.map((section) => section.key), [
    "event_basics",
    "ceremony",
    "reception",
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
