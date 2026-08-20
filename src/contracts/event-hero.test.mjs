import assert from "node:assert/strict";
import test from "node:test";
import { answerHasValue, eventHeroProgress, formatEventAnswer, normalizeEventAnswer } from "../lib/event-hero.mjs";

test("normalizes Event Hero field types", () => {
  assert.equal(normalizeEventAnswer({ fieldType: "yes_no" }, "false"), false);
  assert.equal(normalizeEventAnswer({ fieldType: "number" }, "125"), 125);
  assert.equal(normalizeEventAnswer({ fieldType: "number" }, "-2"), null);
  assert.deepEqual(normalizeEventAnswer({ fieldType: "repeater" }, "First\n\nSecond"), ["First", "Second"]);
  assert.deepEqual(normalizeEventAnswer({ fieldType: "multi_select" }, ["Karaoke", "Karaoke", " Trivia "]), ["Karaoke", "Trivia"]);
});

test("Event Hero progress prioritizes required answers", () => {
  const questions = [
    { key: "goal", required: true },
    { key: "theme", required: false },
  ];
  assert.equal(eventHeroProgress(questions, { theme: "gold" }), 0);
  assert.equal(eventHeroProgress(questions, { goal: "Celebrate" }), 100);
});

test("formats saved answers for staff review", () => {
  assert.equal(answerHasValue(false), true);
  assert.equal(formatEventAnswer({ fieldType: "yes_no" }, false), "No");
  assert.equal(formatEventAnswer({ fieldType: "multi_select" }, ["Adults", "Teens"]), "Adults\nTeens");
});
