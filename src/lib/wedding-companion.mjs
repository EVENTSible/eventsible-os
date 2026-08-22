export const WEDDING_COMPANION_VERSION = "wedding-hero-v2";

export const WEDDING_SECTIONS = [
  {
    key: "event_basics",
    title: "Your Wedding",
    description: "The people, priorities, and essentials behind the day.",
    questions: [
      question("event_date_confirmed", "Is your wedding date confirmed?", "yes_no", true),
      question("event_date", "Wedding date", "date", true, {
        condition: { answer: "event_date_confirmed", equals: true },
      }),
      question("partner_one_name", "Partner one name", "short_text", true),
      question("partner_two_name", "Partner two name", "short_text", true),
      question("guest_count", "Estimated guest count", "number", true),
      question("day_of_contact", "Best day-of contact and relationship to the couple", "short_text", true),
      question("day_of_contact_phone", "Day-of contact phone number", "phone", true),
      question("wedding_vision", "What should your wedding feel like?", "long_text", true, {
        helpText: "Tell us about the energy, style, and moments that matter most.",
        promptIdeas: ["Warm and intimate dinner party", "Elegant, classic, and polished", "Packed dance floor with throwbacks", "Relaxed garden party with family focus"],
      }),
      question("special_considerations", "Surprises, sensitive details, or special considerations", "long_text", false, {
        helpText: "Share anything we should protect, avoid, announce carefully, or coordinate quietly.",
        promptIdeas: ["Private surprise for the couple", "Family dynamics to handle gently", "Memorial moment or reserved seat", "Names or traditions to pronounce carefully"],
      }),
    ],
  },
  {
    key: "ceremony",
    title: "Ceremony",
    description: "Sound, music, people, and the order that gets everyone down the aisle.",
    questions: [
      question("ceremony_included", "Will EVENTSible provide ceremony sound or music?", "yes_no", true),
      question("ceremony_location", "Ceremony location or setup area", "short_text", false, ceremonyCondition()),
      question("ceremony_address", "Ceremony address or location details", "long_text", false, ceremonyCondition()),
      question("guest_arrival_time", "Guest arrival time", "time", false, ceremonyCondition()),
      question("ceremony_start_time", "Ceremony start time", "time", false, ceremonyCondition()),
      question("lineup_time", "Wedding-party lineup time", "time", false, ceremonyCondition()),
      question("officiant_name", "Officiant name", "short_text", false, ceremonyCondition()),
      question("officiant_needs_mic", "Will the officiant need a microphone?", "yes_no", false, ceremonyCondition()),
      question("rehearsal_needed", "Is there a rehearsal we should know about?", "yes_no", false, ceremonyCondition()),
      question("rehearsal_date", "Rehearsal date", "date", false, rehearsalCondition()),
      question("rehearsal_time", "Rehearsal time", "time", false, rehearsalCondition()),
      question("rehearsal_notes", "Rehearsal location, people, or notes", "long_text", false, rehearsalCondition()),
      question("ceremony_participants", "Processional order and names", "repeater", false, {
        ...ceremonyCondition(),
        helpText: "One person, couple, or group per line, in entrance order.",
      }),
      question("ceremony_notes", "Other ceremony cues or instructions", "long_text", false, ceremonyCondition()),
    ],
  },
  {
    key: "reception",
    title: "Reception Flow",
    description: "Introductions, formal moments, speeches, and the shape of the celebration.",
    questions: [
      question("cocktail_hour_included", "Will there be a cocktail hour?", "yes_no", true),
      question("cocktail_hour_location", "Cocktail-hour location", "short_text", false, cocktailHourCondition()),
      question("cocktail_hour_start_time", "Cocktail-hour start time", "time", false, cocktailHourCondition()),
      question("cocktail_hour_end_time", "Cocktail-hour end time", "time", false, cocktailHourCondition()),
      question("cocktail_hour_sound", "Cocktail-hour sound or music needs", "long_text", false, {
        ...cocktailHourCondition(),
        promptIdeas: ["Background playlist only", "Wireless speaker in a separate room", "DJ-curated upbeat mingling music", "Live musician handoff to reception"],
      }),
      question("cocktail_hour_plan", "Cocktail-hour notes", "long_text", false, cocktailHourCondition()),
      question("wedding_party_introductions", "Would you like formal wedding-party introductions?", "yes_no", true),
      question("introduction_order", "Introduction order, names, and pronunciations", "repeater", false, {
        condition: { answer: "wedding_party_introductions", equals: true },
        helpText: "One person, couple, or group per line.",
      }),
      question("blessing_and_toasts", "Blessing, welcome, and toast speakers", "repeater"),
      question("reception_timeline", "Known timeline, meal service, and formal-moment times", "long_text", true),
      question("reception_notes", "Other reception traditions, surprises, or MC instructions", "long_text"),
    ],
  },
  {
    key: "songs_and_dances",
    title: "Songs & Special Dances",
    description: "Every entrance, ceremony cue, special dance, and must-play in one easy-to-find place.",
    questions: [
      question("ceremony_processional_music", "Ceremony processional songs and who enters to each", "repeater", false, ceremonyCondition()),
      question("ceremony_special_music", "Unity ceremony, interlude, live performer, or other ceremony music", "long_text", false, ceremonyCondition()),
      question("ceremony_recessional_song", "Ceremony recessional song", "song", false, ceremonyCondition()),
      question("introduction_song", "Wedding-party introduction song", "song", false, {
        condition: { answer: "wedding_party_introductions", equals: true },
      }),
      question("couple_entrance_song", "Couple's grand entrance song", "song"),
      question("first_dance_song", "First dance song", "song", true),
      question("parent_dances", "Parent and family dances", "repeater", false, {
        helpText: "One dance per line. Include the people involved, relationship, song title, and artist.",
      }),
      question("formal_moments", "Special moments you want included", "multi_select", false, {
        options: ["Cake cutting", "Bouquet toss", "Garter tradition", "Anniversary dance", "Money dance", "Group photo", "Private last dance", "Grand exit"],
      }),
      question("cake_cutting_song", "Cake-cutting song", "song", false, momentCondition("Cake cutting")),
      question("bouquet_toss_song", "Bouquet-toss song", "song", false, momentCondition("Bouquet toss")),
      question("garter_toss_song", "Garter tradition song", "song", false, momentCondition("Garter tradition")),
      question("anniversary_dance_song", "Anniversary-dance song", "song", false, momentCondition("Anniversary dance")),
      question("private_last_dance_song", "Private last-dance song", "song", false, momentCondition("Private last dance")),
      question("last_dance_and_exit", "Public last dance, grand exit song, or exit instructions", "long_text"),
      question("line_dances", "Line dances and group dances", "multi_select", false, {
        options: ["Cupid Shuffle", "Cha Cha Slide", "Electric Slide", "Wobble", "Macarena", "YMCA", "Other", "None"],
      }),
      question("must_play_list", "Must-play songs or artists", "repeater", true),
      question("do_not_play_list", "Do-not-play songs or artists", "repeater"),
      question("special_dance_notes", "Other special dances, dedications, or song notes", "long_text"),
    ],
  },
  {
    key: "music",
    title: "Dance Floor & Requests",
    description: "The overall party energy, guest-request rules, favorite styles, and dance-floor direction.",
    questions: [
      question("music_vibe", "Describe the overall music vibe", "long_text", true),
      question("clean_music_required", "Are clean or radio-edit versions required?", "yes_no", true),
      question("favorite_genres", "Favorite genres, eras, and artists", "repeater", true),
      question("avoid_genres", "Genres, eras, or artists to avoid", "repeater"),
      question("guest_requests", "May guests make song requests?", "single_select", true, {
        options: ["Yes, use DJ judgment", "Yes, play most reasonable requests", "Only requests approved by us", "No guest requests"],
      }),
      question("cultural_music", "Cultural, traditional, religious, or language-specific music", "long_text"),
      question("dance_floor_balance", "Dance-floor balance", "single_select", true, {
        options: ["High-energy most of the night", "A balanced mix", "More relaxed and social", "Follow the crowd"],
      }),
    ],
  },
  {
    key: "logistics",
    title: "Venue & Vendor Logistics",
    description: "The practical details that keep event day from becoming an Olympic sport.",
    questions: [
      question("venue_contact", "Venue coordinator name, phone, and email", "long_text", true),
      question("planner_contact", "Planner or day-of coordinator contact information", "long_text"),
      question("venue_access_time", "What time can our team access the venue?", "time", true),
      question("load_in_instructions", "Parking, loading entrance, stairs, elevators, or access instructions", "long_text", true),
      question("power_available", "Is reliable power available near each setup area?", "yes_no", true),
      question("wifi_available", "Is venue Wi-Fi available if needed?", "yes_no"),
      question("weather_backup_plan", "Backup plan for outdoor portions", "long_text"),
      question("venue_rules", "Noise limits, curfew, fog restrictions, or other venue rules", "long_text"),
      question("vendor_meals", "Vendor meal plan or meal timing", "long_text"),
    ],
  },
  {
    key: "services",
    title: "Booked Services",
    description: "Preferences for the extra EVENTSible experiences included in your booking.",
    questions: [
      question("photo_booth_plan", "Photo Booth timing, location, backdrop, and overlay ideas", "long_text"),
      question("uplighting_plan", "Uplighting colors and room-lighting preferences", "long_text"),
      question("karaoke_plan", "Karaoke timing, song-screen placement, or special instructions", "long_text"),
      question("interactive_plan", "Games, challenges, or guest-interaction preferences", "long_text"),
      question("other_service_notes", "Other booked-service preferences or requests", "long_text"),
      question("final_questions", "Questions or anything else you want the EVENTSible team to know", "long_text"),
    ],
  },
];

function question(key, label, fieldType, required = false, extras = {}) {
  return {
    key,
    label,
    fieldType,
    required,
    helpText: null,
    options: [],
    condition: {},
    promptIdeas: [],
    ...extras,
  };
}

function ceremonyCondition() {
  return { condition: { answer: "ceremony_included", equals: true } };
}

function rehearsalCondition() {
  return { condition: { answer: "rehearsal_needed", equals: true } };
}

function cocktailHourCondition() {
  return { condition: { answer: "cocktail_hour_included", equals: true } };
}

function momentCondition(moment) {
  return { condition: { answer: "formal_moments", includes: moment } };
}

export function weddingQuestionMap() {
  return new Map(WEDDING_SECTIONS.flatMap((section) => section.questions.map((questionItem) => [questionItem.key, questionItem])));
}

export function answerHasValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.some((item) => String(item ?? "").trim());
  if (typeof value === "string") return Boolean(value.trim());
  return true;
}

export function isQuestionVisible(questionItem, answers = {}) {
  const condition = questionItem?.condition ?? {};
  if (!condition.answer) return true;
  if (condition.includes) {
    const selected = Array.isArray(answers[condition.answer]) ? answers[condition.answer] : [];
    return selected.includes(condition.includes);
  }
  return answers[condition.answer] === condition.equals;
}

export function requiredQuestionKeys(answers = {}) {
  return WEDDING_SECTIONS.flatMap((section) => section.questions)
    .filter((questionItem) => questionItem.required && isQuestionVisible(questionItem, answers))
    .map((questionItem) => questionItem.key);
}

export function isSectionComplete(section, answers = {}) {
  const requiredQuestions = section.questions.filter((questionItem) => questionItem.required && isQuestionVisible(questionItem, answers));
  return requiredQuestions.length > 0 && requiredQuestions.every((questionItem) => answerHasValue(answers[questionItem.key]));
}

/**
 * @param {Record<string, unknown>} answers
 * @param {string | null} [lastSectionKey]
 */
export function guidedResumeSectionKey(answers = {}, lastSectionKey = null) {
  const lastIndex = WEDDING_SECTIONS.findIndex((section) => section.key === lastSectionKey);
  if (lastIndex >= 0 && !isSectionComplete(WEDDING_SECTIONS[lastIndex], answers)) return WEDDING_SECTIONS[lastIndex].key;

  const searchStart = Math.max(0, lastIndex);
  const orderedSections = [
    ...WEDDING_SECTIONS.slice(searchStart),
    ...WEDDING_SECTIONS.slice(0, searchStart),
  ];
  return orderedSections.find((section) => !isSectionComplete(section, answers))?.key ?? WEDDING_SECTIONS.at(-1)?.key ?? WEDDING_SECTIONS[0].key;
}

/**
 * @param {string} questionKey
 */
export function guidedPromptIdeas(questionKey) {
  const questionItem = weddingQuestionMap().get(questionKey);
  return Array.isArray(questionItem?.promptIdeas) ? questionItem.promptIdeas : [];
}

export function weddingProgress(answers = {}) {
  const requiredKeys = requiredQuestionKeys(answers);
  if (!requiredKeys.length) return 0;
  const complete = requiredKeys.filter((key) => answerHasValue(answers[key])).length;
  return Math.round((complete / requiredKeys.length) * 100);
}

export function normalizeWeddingAnswer(questionItem, value) {
  if (!questionItem) return null;
  const fieldType = questionItem.fieldType;

  if (fieldType === "yes_no") {
    if (value === true || value === "true" || value === "yes") return true;
    if (value === false || value === "false" || value === "no") return false;
    return null;
  }

  if (fieldType === "number") {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(number, 100000)) : null;
  }

  if (fieldType === "multi_select" || fieldType === "repeater") {
    const items = Array.isArray(value) ? value : String(value ?? "").split("\n");
    return items.map((item) => String(item).trim().slice(0, 240)).filter(Boolean).slice(0, 100);
  }

  const maxLength = fieldType === "long_text" ? 8000 : 500;
  const textValue = String(value ?? "").trim().slice(0, maxLength);
  return textValue || null;
}

export function formatWeddingAnswer(questionItem, value) {
  if (!answerHasValue(value)) return "Not answered";
  if (questionItem?.fieldType === "yes_no") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}
