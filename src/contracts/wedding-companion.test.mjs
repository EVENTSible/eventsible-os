import assert from "node:assert/strict";
import test from "node:test";
import {
  answerHasValue,
  formatWeddingAnswer,
  guidedPromptIdeas,
  guidedResumeSectionKey,
  isQuestionVisible,
  normalizeWeddingAnswer,
  requiredQuestionKeys,
  shouldRevealAllWeddingQuestions,
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

test("Wedding Companion reveals every conditional question outside Guided mode", () => {
  const map = weddingQuestionMap();
  const conditionalQuestions = [
    map.get("event_date"),
    map.get("rehearsal_date"),
    map.get("cocktail_hour_location"),
    map.get("introduction_order"),
    map.get("reception_timeline"),
    map.get("venue_contact"),
  ];

  assert.equal(shouldRevealAllWeddingQuestions("guided"), false);
  assert.equal(isQuestionVisible(map.get("rehearsal_date"), {}, shouldRevealAllWeddingQuestions("guided")), false);
  for (const mode of ["form", "print", "printable"]) {
    assert.equal(shouldRevealAllWeddingQuestions(mode), true);
    assert.equal(conditionalQuestions.every((question) => isQuestionVisible(question, {}, shouldRevealAllWeddingQuestions(mode))), true);
  }
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

test("Wedding Companion keeps guided song moments together", () => {
  const songSection = WEDDING_SECTIONS.find((section) => section.key === "songs_and_dances");
  const songKeys = new Set(songSection.questions.map((question) => question.key));
  assert.ok(songKeys.has("first_dance_song"));
  assert.ok(songKeys.has("ceremony_processional_music"));
  assert.ok(songKeys.has("couple_entrance_song"));

  const cakeSong = weddingQuestionMap().get("cake_cutting_song");
  assert.equal(cakeSong.fieldType, "song_moment");
  assert.equal(isQuestionVisible(cakeSong, {}), true);
});

test("Wedding Companion offers guided prompt starter ideas for open-ended planning questions", () => {
  assert.ok(guidedPromptIdeas("wedding_vision").includes("Elegant, classic, and polished"));
  assert.ok(weddingQuestionMap().get("special_considerations").options.includes("Family dynamics"));
});

test("Wedding Companion provides reusable reorderable lists and processional guidance", () => {
  const map = weddingQuestionMap();
  const processional = map.get("ceremony_participants");
  assert.equal(processional.fieldType, "reorderable_people_list");
  assert.equal(processional.defaultRows, 3);
  assert.equal(processional.addLabel, "Add person/group");
  assert.ok(processional.itemFields.some((field) => field.key === "escortedBy"));
  assert.deepEqual(processional.additionalFieldKeys, ["pronunciation", "escortedBy", "cue"]);
  assert.equal(processional.additionalFieldsLabel, "Additional details");
  assert.ok(processional.helperInfo.body.includes("six to eight feet"));
  assert.equal(processional.helperInfo.expandableTitle, "Ceremony Entry Sequence");

  const introductions = map.get("introduction_order");
  assert.equal(introductions.fieldType, "introduction_list");
  assert.equal(isQuestionVisible(introductions, { wedding_party_introductions: false }), false);
  assert.equal(isQuestionVisible(introductions, { wedding_party_introductions: true }), true);

  const speakers = map.get("blessing_and_toasts");
  assert.equal(speakers.fieldType, "speaker_list");
  assert.ok(speakers.itemFields.some((field) => field.key === "microphone"));
});

test("Wedding Companion gates timeline, meal, MC, and venue details without blocking unsure couples", () => {
  const map = weddingQuestionMap();
  assert.equal(map.get("reception_timeline_known").fieldType, "tri_state");
  assert.equal(isQuestionVisible(map.get("reception_timeline"), { reception_timeline_known: "unsure" }), false);
  assert.equal(isQuestionVisible(map.get("reception_timeline"), { reception_timeline_known: "yes" }), true);
  assert.ok(map.get("reception_timeline").starterItems.includes("Grand entrance"));
  assert.equal(isQuestionVisible(map.get("meal_service_details"), { meal_service_status: "no" }), false);
  assert.equal(isQuestionVisible(map.get("reception_notes"), { mc_instructions_status: "yes" }), true);
  assert.equal(isQuestionVisible(map.get("venue_contact"), { venue_contact_known: "unsure" }), false);
  assert.equal(isQuestionVisible(map.get("venue_contact"), { venue_contact_known: "yes" }), true);
});

test("Wedding Companion includes guided music, service, and attire choices", () => {
  const map = weddingQuestionMap();
  assert.ok(map.get("music_styles").options.includes("Disco/funk"));
  assert.deepEqual(map.get("guest_requests").options, ["Yes, take requests", "Ask us first", "Wedding party only", "No requests"]);
  assert.equal(map.get("booked_services").fieldType, "service_checklist");
  assert.ok(map.get("booked_services").options.includes("360 Booth"));
  assert.ok(map.get("eventsible_staff_attire").options.includes("Formal black"));
});

test("Wedding Companion preserves legacy answers without showing empty legacy fields", () => {
  const map = weddingQuestionMap();
  const legacyPhotoBooth = map.get("photo_booth_plan");
  assert.equal(isQuestionVisible(legacyPhotoBooth, {}), false);
  assert.equal(isQuestionVisible(legacyPhotoBooth, { photo_booth_plan: "Lobby setup" }), true);
  assert.equal(isQuestionVisible(map.get("clean_music_required"), { clean_music_required: false }), true);
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

test("Wedding Companion normalizes scalar and backward-compatible structured answers", () => {
  const map = weddingQuestionMap();
  assert.equal(normalizeWeddingAnswer(map.get("ceremony_included"), "yes"), true);
  assert.equal(normalizeWeddingAnswer(map.get("guest_count"), "145"), 145);
  assert.deepEqual(normalizeWeddingAnswer(map.get("must_play_list"), "Song A\n\nSong B"), [{ songTitle: "Song A" }, { songTitle: "Song B" }]);
  assert.deepEqual(normalizeWeddingAnswer(map.get("ceremony_participants"), ["Officiant Sam", "Alex and Jordan"]), [{ name: "Officiant Sam" }, { name: "Alex and Jordan" }]);
  assert.deepEqual(normalizeWeddingAnswer(map.get("ceremony_processional_music"), ["Canon in D", "Here Comes the Sun"]), { status: "chosen", songTitle: "Canon in D; Here Comes the Sun" });
  assert.deepEqual(normalizeWeddingAnswer(map.get("first_dance_song"), "At Last - Etta James"), { status: "chosen", songTitle: "At Last - Etta James" });
  assert.equal(normalizeWeddingAnswer(map.get("partner_one_name"), "  Alex  "), "Alex");
});

test("Wedding Companion formats structured answers for print and staff review", () => {
  const map = weddingQuestionMap();
  const processional = [{ name: "Sam", role: "Officiant" }, { name: "Alex", role: "Bride", escortedBy: "Pat" }];
  assert.equal(formatWeddingAnswer(map.get("ceremony_participants"), processional), "1. Name or group name: Sam · Role: Officiant\n2. Name or group name: Alex · Role: Bride · Walking with / escorted by: Pat");
  assert.equal(formatWeddingAnswer(map.get("reception_timeline_known"), "unsure"), "We'll add this later");
  assert.ok(formatWeddingAnswer(map.get("booked_services"), [{ service: "DJ/MC", status: "booked", location: "Ballroom" }]).includes("Setup: Ballroom"));
});

test("Wedding Companion treats false as an answered yes-or-no value", () => {
  assert.equal(answerHasValue(false), true);
  assert.equal(answerHasValue([]), false);
  assert.equal(answerHasValue([{ name: "" }]), false);
  assert.equal(answerHasValue([{ name: "Alex" }]), true);
  assert.equal(answerHasValue("   "), false);
});
