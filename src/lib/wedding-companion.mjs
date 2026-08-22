export const WEDDING_COMPANION_VERSION = "wedding-hero-v3";

function field(key, label, type = "text", extras = {}) {
  return { key, label, type, options: [], placeholder: "", ...extras };
}

function question(key, label, fieldType, required = false, extras = {}) {
  return { key, label, fieldType, required, helpText: null, options: [], condition: {}, promptIdeas: [], itemFields: [], fields: [], ...extras };
}

function legacyQuestion(key, label, fieldType = "long_text", extras = {}) {
  return question(key, label, fieldType, false, {
    helpText: "Preserved from an earlier Wedding Hero draft.",
    condition: { answer: key, hasValue: true },
    ...extras,
  });
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

function contactFields(label) {
  return [field("name", `${label} name`), field("phone", "Phone", "tel"), field("email", "Email", "email"), field("notes", "Notes", "textarea")];
}

const SONG_FIELDS = [
  field("songTitle", "Song title"),
  field("artist", "Artist"),
  field("version", "Exact version or link", "url", { placeholder: "Optional" }),
  field("cue", "Start point or cue", "text", { placeholder: "Start at 0:42 or from the beginning" }),
  field("fade", "Fade or stop instruction", "text", { placeholder: "Play through, fade after entrance, or hard stop" }),
];

function songQuestion(key, label, required = false, extras = {}) {
  return question(key, label, "song_moment", required, { fields: SONG_FIELDS, ...extras });
}

const PROCESSIONAL_HELPER = {
  title: "Need help?",
  body: "A traditional wedding processional order begins with the officiant and family elders, moves through the wedding party, and ends with the couple or the bride. Spacing should be six to eight feet between each person or pair at a slow-march pace.",
  expandableTitle: "Ceremony Entry Sequence",
  items: [
    ["Officiant", "Walks first to the altar to signal the start."],
    ["Grandparents", "Groom's grandparents walk first, followed by the bride's grandparents."],
    ["Parents of the groom", "Walk together or are seated in the front row."],
    ["Mother of the bride", "Escorted by a son, relative, or usher to her seat."],
    ["Groom", "Walks solo, with parents, or enters from the side with the officiant."],
    ["Groomsmen", "Walk down individually or in pairs, or pair up with bridesmaids."],
    ["Bridesmaids", "Walk down individually or paired with groomsmen."],
    ["Best man and maid/matron of honor", "Walk last among the adult attendants."],
    ["Ring bearer and flower girl", "The final young attendants before the main entrance."],
    ["The bride or couple", "Walk last, traditionally escorted by a father or both parents."],
  ],
};

const PROCESSIONAL_FIELDS = [
  field("name", "Name or group name", "text", { placeholder: "Morgan and Taylor" }),
  field("role", "Role", "select", { options: ["Officiant", "Grandparent", "Parent", "Groom", "Bridesmaid", "Groomsman", "Maid/Matron of Honor", "Best Man", "Ring Bearer", "Flower Girl", "Bride", "Couple", "Other"] }),
  field("pronunciation", "Pronunciation note", "text", { placeholder: "Optional" }),
  field("escortedBy", "Walking with / escorted by", "text", { placeholder: "Optional" }),
  field("cue", "Song or cue note", "text", { placeholder: "Optional" }),
];

const INTRO_FIELDS = [
  field("name", "Name, couple, or pair", "text", { placeholder: "Jordan and Casey" }),
  field("role", "Role or relationship", "text", { placeholder: "Best friends of the couple" }),
  field("pronunciation", "Pronunciation", "text", { placeholder: "Optional" }),
  field("cue", "Intro song or cue", "text", { placeholder: "If different" }),
  field("hypeNote", "Hype note or fun fact", "text", { placeholder: "Optional" }),
];

const SPEAKER_FIELDS = [
  field("name", "Speaker name"),
  field("moment", "Moment type", "select", { options: ["Welcome", "Blessing", "Toast", "Prayer", "Speech", "Other"] }),
  field("role", "Relationship or role", "text", { placeholder: "Parent of the bride" }),
  field("timing", "Approximate timing", "text", { placeholder: "After dinner" }),
  field("microphone", "Microphone needed", "select", { options: ["Yes", "No", "Unsure"] }),
  field("pronunciation", "Pronunciation note", "text", { placeholder: "Optional" }),
  field("notes", "Notes", "textarea", { placeholder: "Length, handoff, or sensitive context" }),
];

const TIMELINE_FIELDS = [
  field("moment", "Moment name", "text", { placeholder: "Grand entrance" }),
  field("time", "Estimated time", "time"),
  field("people", "Who is involved", "text", { placeholder: "Couple and wedding party" }),
  field("cue", "Music or audio cue", "text", { placeholder: "Song, microphone, or announcement cue" }),
  field("notes", "Notes", "textarea", { placeholder: "Optional production notes" }),
];

const TIMELINE_STARTERS = ["Cocktail hour", "Grand entrance", "First dance", "Blessing", "Dinner", "Toasts", "Parent dances", "Cake cutting", "Bouquet/garter", "Open dance floor", "Last song/send-off"];
const SONG_LIST_FIELDS = [field("songTitle", "Song or artist", "text", { placeholder: "Song title, artist, or both" }), field("artist", "Artist", "text", { placeholder: "Optional" }), field("notes", "Note", "text", { placeholder: "Version, reason, or instruction" })];
const PARENT_DANCE_FIELDS = [field("people", "Who is dancing", "text", { placeholder: "Partner one and parent" }), ...SONG_FIELDS];
const MUSIC_STYLE_OPTIONS = ["Clean radio edits", "Old school", "New hits", "Hip hop", "R&B", "Pop", "Country", "Latin", "Motown", "Disco/funk", "Line dances", "Slow jams", "Guest requests welcome", "No explicit music"];
const SERVICE_OPTIONS = ["DJ/MC", "Ceremony audio", "Cocktail hour audio", "Reception sound", "Karaoke", "Photo Booth", "360 Booth", "Uplighting", "Dance floor lighting", "Games/trivia", "Kids activities", "Rentals", "Other"];

export const WEDDING_SECTIONS = [
  {
    key: "event_basics",
    title: "Your Wedding",
    description: "The people, priorities, look, and essentials behind the day.",
    questions: [
      question("event_date_confirmed", "Is your wedding date confirmed?", "yes_no", true),
      question("event_date", "Wedding date", "date", true, { condition: { answer: "event_date_confirmed", equals: true } }),
      question("partner_one_name", "Partner one name", "short_text", true),
      question("partner_two_name", "Partner two name", "short_text", true),
      question("guest_count", "Estimated guest count", "number", true),
      question("day_of_contact", "Best day-of contact and relationship to the couple", "short_text", true),
      question("day_of_contact_phone", "Day-of contact phone number", "phone", true),
      question("wedding_colors", "Wedding colors", "short_text", false, { helpText: "List the main colors and any accent colors." }),
      question("wedding_theme_style", "Wedding theme or style", "multi_select", false, { options: ["Classic", "Modern", "Romantic", "Garden", "Rustic", "Glamorous", "Minimal", "Vintage", "Cultural/traditional", "Themed", "Other"] }),
      question("wedding_theme_notes", "Theme or style notes", "short_text", false, { helpText: "Optional details, references, or an 'other' style." }),
      question("guest_attire", "Expected guest attire or dress code", "single_select", false, { options: ["Black tie", "Formal", "Cocktail", "Semi-formal", "Dressy casual", "Casual", "Themed", "No preference", "Other"] }),
      question("wedding_party_attire", "Wedding-party attire style", "short_text", false),
      question("eventsible_staff_attire", "Preferred EVENTSible staff or DJ attire", "single_select", false, { options: ["Formal black", "Suit/dressy", "Semi-formal", "Match wedding colors if possible", "Themed attire", "EVENTSible branded", "No preference", "Other notes"] }),
      question("eventsible_staff_attire_notes", "EVENTSible attire notes", "short_text", false, { condition: { answer: "eventsible_staff_attire", equals: "Other notes" } }),
      question("wedding_vision", "What should your wedding feel like?", "long_text", true, { helpText: "Tell us about the energy, style, and moments that matter most.", promptIdeas: ["Warm and intimate dinner party", "Elegant, classic, and polished", "Packed dance floor with throwbacks", "Relaxed garden party with family focus"] }),
      question("special_considerations", "Surprises, sensitive details, or special considerations", "sensitive_checklist", false, { helpText: "Choose only what applies. Notes stay with the production plan so the team can handle details discreetly.", options: ["Private surprise", "Family dynamics", "Memorial or reserved seat", "Pronunciation or naming care", "Accessibility need", "Announcement sensitivity", "Cultural or religious tradition", "Other sensitive detail"] }),
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
      question("ceremony_participants", "Processional order and names", "reorderable_people_list", false, { ...ceremonyCondition(), helpText: "Add each person, pair, or group in entrance order. Three empty places are ready to start.", itemFields: PROCESSIONAL_FIELDS, legacyField: "name", defaultRows: 3, addLabel: "Add person/group", helperInfo: PROCESSIONAL_HELPER, additionalFieldKeys: ["pronunciation", "escortedBy", "cue"], additionalFieldsLabel: "Additional details" }),
      question("ceremony_notes", "Other ceremony cues or instructions", "long_text", false, ceremonyCondition()),
    ],
  },
  {
    key: "reception",
    title: "Reception Flow",
    description: "Introductions, formal moments, speakers, and the shape of the celebration.",
    questions: [
      question("cocktail_hour_included", "Will there be a cocktail hour?", "yes_no", true),
      question("cocktail_hour_location", "Cocktail-hour location", "short_text", false, cocktailHourCondition()),
      question("cocktail_hour_start_time", "Cocktail-hour start time", "time", false, cocktailHourCondition()),
      question("cocktail_hour_end_time", "Cocktail-hour end time", "time", false, cocktailHourCondition()),
      question("cocktail_hour_plan", "Cocktail-hour flow", "details_group", false, { ...cocktailHourCondition(), fields: [field("flow", "Guest flow"), field("sound", "Sound coverage"), field("notes", "Other notes", "textarea")] }),
      question("wedding_party_introductions", "Would you like formal wedding-party introductions?", "yes_no", true),
      question("introduction_order", "Wedding-party introduction order", "introduction_list", false, { condition: { answer: "wedding_party_introductions", equals: true }, helpText: "Build the exact order the MC should announce, including pronunciation and any special cue.", itemFields: INTRO_FIELDS, legacyField: "name", defaultRows: 2, addLabel: "Add intro" }),
      question("blessing_and_toasts", "Blessing, welcome, and toast speakers", "speaker_list", false, { helpText: "Examples: a parent welcomes guests before dinner, an officiant gives a blessing, or the best person gives a toast after dinner.", itemFields: SPEAKER_FIELDS, legacyField: "name", defaultRows: 1, addLabel: "Add speaker" }),
      question("speaker_other_notes", "Other speaker notes", "long_text"),
      question("reception_timeline_known", "Do you already know your reception timeline?", "tri_state", true),
      question("reception_timeline", "Reception timeline", "timeline_list", false, { condition: { answer: "reception_timeline_known", equals: "yes" }, helpText: "Add only what you know. Times can stay estimated until the venue and catering plans are final.", itemFields: TIMELINE_FIELDS, legacyField: "moment", starterItems: TIMELINE_STARTERS, addLabel: "Add timeline moment" }),
      question("meal_service_status", "Will there be a meal service?", "tri_state", true),
      question("meal_service_details", "Meal service details", "details_group", false, { condition: { answer: "meal_service_status", equals: "yes" }, fields: [field("style", "Service style", "select", { options: ["Plated", "Buffet", "Family style", "Stations", "Cocktail-style", "Food trucks", "Other"] }), field("time", "Estimated meal time", "time"), field("caterer", "Caterer or contact"), field("notes", "Announcements or notes", "textarea")] }),
      question("formal_reception_moments_status", "Will there be formal moments we should announce or cue?", "tri_state", true),
      question("formal_moments", "Formal moments to announce or cue", "multi_select", false, { condition: { answer: "formal_reception_moments_status", equals: "yes" }, options: ["First dance", "Blessing", "Toasts", "Parent dances", "Cake cutting", "Bouquet toss", "Garter tradition", "Anniversary dance", "Money dance", "Group photo", "Private last dance", "Grand exit", "Other"] }),
      question("mc_instructions_status", "Are there special traditions, surprises, or MC instructions?", "tri_state", true),
      question("reception_notes", "Tradition or MC instructions", "details_group", false, { condition: { answer: "mc_instructions_status", equals: "yes" }, fields: [field("moment", "Tradition or moment"), field("people", "Who is involved"), field("timing", "When it happens"), field("mcCue", "What the MC should say or cue", "textarea"), field("notes", "Other notes", "textarea")] }),
    ],
  },
  {
    key: "songs_and_dances",
    title: "Songs & Special Dances",
    description: "Choose a status first, then add exact song details only for the moments you are planning.",
    questions: [
      songQuestion("ceremony_processional_music", "Ceremony processional", false, ceremonyCondition()),
      songQuestion("ceremony_main_entrance_song", "Bride or couple ceremony entrance", false, ceremonyCondition()),
      songQuestion("ceremony_recessional_song", "Ceremony recessional", false, ceremonyCondition()),
      legacyQuestion("ceremony_special_music", "Saved ceremony special music"),
      songQuestion("cocktail_hour_sound", "Cocktail-hour vibe or featured music", false, cocktailHourCondition()),
      songQuestion("introduction_song", "Wedding-party entrance", false, { condition: { answer: "wedding_party_introductions", equals: true } }),
      songQuestion("couple_entrance_song", "Couple grand entrance"),
      songQuestion("first_dance_song", "First dance", true),
      question("parent_dances", "Parent and family dances", "song_list", false, { helpText: "Add one card per dance.", itemFields: PARENT_DANCE_FIELDS, legacyField: "songTitle", addLabel: "Add parent/family dance" }),
      songQuestion("anniversary_dance_song", "Anniversary dance"),
      songQuestion("cake_cutting_song", "Cake cutting"),
      songQuestion("bouquet_toss_song", "Bouquet or garter moment"),
      legacyQuestion("garter_toss_song", "Saved garter tradition song", "song"),
      legacyQuestion("private_last_dance_song", "Saved private last-dance song", "song"),
      legacyQuestion("line_dances", "Saved line and group dances", "multi_select"),
      songQuestion("last_dance_and_exit", "Last dance or send-off"),
      question("special_dance_notes", "Other music, dedications, or special-dance notes", "long_text"),
    ],
  },
  {
    key: "music",
    title: "Dance Floor & Requests",
    description: "Give the DJ useful boundaries, favorites, and permission to read the room.",
    questions: [
      question("music_styles", "Music styles and preferences", "multi_select", true, { options: MUSIC_STYLE_OPTIONS }),
      question("must_play_list", "Songs or artists we love and must play", "song_list", true, { itemFields: SONG_LIST_FIELDS, legacyField: "songTitle", defaultRows: 2, addLabel: "Add must-play" }),
      question("do_not_play_list", "Songs or artists to avoid", "song_list", false, { itemFields: SONG_LIST_FIELDS, legacyField: "songTitle", defaultRows: 1, addLabel: "Add do-not-play" }),
      question("guest_requests", "Guest-request preference", "single_select", true, { options: ["Yes, take requests", "Ask us first", "Wedding party only", "No requests"] }),
      question("dance_floor_balance", "Dance-floor balance", "single_select", true, { options: ["High-energy most of the night", "A balanced mix", "More relaxed and social", "Follow the crowd"] }),
      question("cultural_music", "Cultural, traditional, religious, or language-specific music", "long_text"),
      question("music_vibe", "Other dance-floor direction", "long_text", false, { helpText: "Optional. Use this for context the chips and song lists do not capture." }),
      legacyQuestion("clean_music_required", "Saved clean-music preference", "yes_no"),
      legacyQuestion("favorite_genres", "Saved favorite genres, eras, or artists", "repeater"),
      legacyQuestion("avoid_genres", "Saved genres, eras, or artists to avoid", "repeater"),
    ],
  },
  {
    key: "logistics",
    title: "Venue & Vendor Logistics",
    description: "Answer what you know now. Choosing 'We'll add this later' keeps the plan moving and marks the detail as pending.",
    questions: [
      question("venue_contact_known", "Do you have venue coordinator contact information?", "tri_state", true),
      question("venue_contact", "Venue coordinator contact", "details_group", false, { condition: { answer: "venue_contact_known", equals: "yes" }, fields: contactFields("Venue coordinator") }),
      question("venue_access_known", "Do you know venue access and load-in details?", "tri_state", true),
      question("venue_access_time", "What time can our team access the venue?", "time", false, { condition: { answer: "venue_access_known", equals: "yes" } }),
      question("load_in_instructions", "Parking and load-in instructions", "details_group", false, { condition: { answer: "venue_access_known", equals: "yes" }, fields: [field("entrance", "Loading entrance or parking"), field("stairs", "Stairs, elevators, or distance"), field("contact", "Access contact"), field("notes", "Other access notes", "textarea")] }),
      question("planner_contact_known", "Do you have planner or coordinator contact information?", "tri_state", true),
      question("planner_contact", "Planner or coordinator contact", "details_group", false, { condition: { answer: "planner_contact_known", equals: "yes" }, fields: contactFields("Planner/coordinator") }),
      question("photo_video_contact_known", "Do you have photographer or videographer contact information?", "tri_state"),
      question("photo_video_contact", "Photo and video contacts", "details_group", false, { condition: { answer: "photo_video_contact_known", equals: "yes" }, fields: [field("photographer", "Photographer"), field("videographer", "Videographer"), field("phone", "Best phone", "tel"), field("notes", "Coordination notes", "textarea")] }),
      question("sound_restrictions_known", "Are there venue sound limits or restrictions?", "tri_state", true),
      question("venue_rules", "Sound limits and venue rules", "details_group", false, { condition: { answer: "sound_restrictions_known", equals: "yes" }, fields: [field("soundLimit", "Sound limit"), field("curfew", "Music or venue curfew", "time"), field("effects", "Fog, haze, lighting, or power restrictions"), field("notes", "Other rules", "textarea")] }),
      question("rain_plan_known", "Is there a rain or backup plan?", "tri_state", true),
      question("weather_backup_plan", "Rain or backup plan", "details_group", false, { condition: { answer: "rain_plan_known", equals: "yes" }, fields: [field("location", "Backup location"), field("decisionTime", "Decision deadline"), field("decisionMaker", "Who makes the call"), field("notes", "Setup or transition notes", "textarea")] }),
      question("power_setup_known", "Are there power or setup notes?", "tri_state", true),
      question("power_setup_details", "Power and setup details", "details_group", false, { condition: { answer: "power_setup_known", equals: "yes" }, fields: [field("power", "Available power"), field("setup", "Setup areas or placement"), field("wifi", "Wi-Fi availability"), field("notes", "Other production notes", "textarea")] }),
      legacyQuestion("power_available", "Saved power availability", "yes_no"),
      legacyQuestion("wifi_available", "Saved venue Wi-Fi availability", "yes_no"),
      question("vendor_meals", "Vendor meal plan or timing", "short_text"),
    ],
  },
  {
    key: "services",
    title: "Booked Services",
    description: "Mark what is included, what you are considering, or where you want an EVENTSible recommendation.",
    questions: [
      question("booked_services", "EVENTSible services", "service_checklist", false, { options: SERVICE_OPTIONS }),
      legacyQuestion("photo_booth_plan", "Saved Photo Booth plan"),
      legacyQuestion("uplighting_plan", "Saved uplighting plan"),
      legacyQuestion("karaoke_plan", "Saved karaoke plan"),
      legacyQuestion("interactive_plan", "Saved games and guest-interaction plan"),
      question("other_service_notes", "Other service notes", "long_text"),
      question("final_questions", "Questions or anything else you want the EVENTSible team to know", "long_text"),
    ],
  },
];

export function weddingQuestionMap() {
  return new Map(WEDDING_SECTIONS.flatMap((section) => section.questions.map((questionItem) => [questionItem.key, questionItem])));
}

export function answerHasValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(answerHasValue);
  if (typeof value === "object") return Object.entries(value).some(([key, item]) => key !== "id" && answerHasValue(item));
  return true;
}

export function isQuestionVisible(questionItem, answers = {}) {
  const condition = questionItem?.condition ?? {};
  if (!condition.answer) return true;
  if (condition.hasValue) return answerHasValue(answers[condition.answer]);
  if (condition.includes) {
    const selected = Array.isArray(answers[condition.answer]) ? answers[condition.answer] : [];
    return selected.some((item) => item === condition.includes || (item && typeof item === "object" && (item.service === condition.includes || item.value === condition.includes)));
  }
  return answers[condition.answer] === condition.equals;
}

export function requiredQuestionKeys(answers = {}) {
  return WEDDING_SECTIONS.flatMap((section) => section.questions).filter((questionItem) => questionItem.required && isQuestionVisible(questionItem, answers)).map((questionItem) => questionItem.key);
}

export function isSectionComplete(section, answers = {}) {
  const requiredQuestions = section.questions.filter((questionItem) => questionItem.required && isQuestionVisible(questionItem, answers));
  return requiredQuestions.length > 0 && requiredQuestions.every((questionItem) => answerHasValue(answers[questionItem.key]));
}

/**
 * @param {Record<string, unknown>} answers
 * @param {string | null} [lastSectionKey]
 * @returns {string}
 */
export function guidedResumeSectionKey(answers = {}, lastSectionKey = null) {
  const lastIndex = WEDDING_SECTIONS.findIndex((section) => section.key === lastSectionKey);
  if (lastIndex >= 0 && !isSectionComplete(WEDDING_SECTIONS[lastIndex], answers)) return WEDDING_SECTIONS[lastIndex].key;
  const searchStart = Math.max(0, lastIndex);
  const orderedSections = [...WEDDING_SECTIONS.slice(searchStart), ...WEDDING_SECTIONS.slice(0, searchStart)];
  return orderedSections.find((section) => !isSectionComplete(section, answers))?.key ?? WEDDING_SECTIONS.at(-1)?.key ?? WEDDING_SECTIONS[0].key;
}

export function guidedPromptIdeas(questionKey) {
  const questionItem = weddingQuestionMap().get(questionKey);
  return Array.isArray(questionItem?.promptIdeas) ? questionItem.promptIdeas : [];
}

export function weddingProgress(answers = {}) {
  const requiredKeys = requiredQuestionKeys(answers);
  if (!requiredKeys.length) return 0;
  return Math.round((requiredKeys.filter((key) => answerHasValue(answers[key])).length / requiredKeys.length) * 100);
}

const LIST_FIELD_TYPES = new Set(["reorderable_people_list", "introduction_list", "speaker_list", "timeline_list", "song_list"]);

function cleanText(value, maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeObject(value, fields = []) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(fields.map((item) => [item.key, cleanText(source[item.key], item.type === "textarea" ? 4000 : 1000)]).filter(([, item]) => item));
}

function normalizeList(questionItem, value) {
  const legacyField = questionItem.legacyField ?? questionItem.itemFields?.[0]?.key ?? "name";
  const sourceItems = Array.isArray(value) ? value : cleanText(value, 12000).split("\n");
  return sourceItems.map((item) => typeof item === "string" ? { [legacyField]: cleanText(item) } : normalizeObject(item, questionItem.itemFields)).filter(answerHasValue).slice(0, 100);
}

export function normalizeWeddingAnswer(questionItem, value) {
  if (!questionItem) return null;
  const fieldType = questionItem.fieldType;
  if (fieldType === "yes_no") {
    if (value === true || value === "true" || value === "yes") return true;
    if (value === false || value === "false" || value === "no") return false;
    return null;
  }
  if (fieldType === "tri_state") {
    if (value === true) return "yes";
    if (value === false) return "no";
    return ["yes", "no", "unsure"].includes(value) ? value : null;
  }
  if (fieldType === "number") {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(number, 100000)) : null;
  }
  if (fieldType === "multi_select" || fieldType === "repeater") {
    const items = Array.isArray(value) ? value : String(value ?? "").split("\n");
    return items.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 100);
  }
  if (LIST_FIELD_TYPES.has(fieldType)) return normalizeList(questionItem, value);
  if (fieldType === "song_moment") {
    if (Array.isArray(value)) {
      const songTitle = value.map((item) => cleanText(item)).filter(Boolean).join("; ");
      return songTitle ? { status: "chosen", songTitle } : null;
    }
    if (typeof value === "string") return value.trim() ? { status: "chosen", songTitle: cleanText(value) } : null;
    const normalized = normalizeObject(value, [{ key: "status" }, ...(questionItem.fields ?? [])]);
    return answerHasValue(normalized) ? normalized : null;
  }
  if (fieldType === "details_group") {
    if (typeof value === "string") return value.trim() ? { notes: cleanText(value, 4000) } : null;
    const normalized = normalizeObject(value, questionItem.fields);
    return answerHasValue(normalized) ? normalized : null;
  }
  if (fieldType === "sensitive_checklist") {
    if (typeof value === "string") return value.trim() ? { items: [], otherNotes: cleanText(value, 4000) } : null;
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const items = Array.isArray(source.items) ? source.items.map((item) => normalizeObject(item, [{ key: "topic" }, { key: "notes", type: "textarea" }])).filter(answerHasValue).slice(0, 30) : [];
    const otherNotes = cleanText(source.otherNotes, 4000);
    return items.length || otherNotes ? { items, otherNotes } : null;
  }
  if (fieldType === "service_checklist") {
    const items = Array.isArray(value) ? value : [];
    return items.map((item) => typeof item === "string" ? { service: cleanText(item), status: "booked" } : normalizeObject(item, [{ key: "service" }, { key: "status" }, { key: "location" }, { key: "time" }, { key: "notes", type: "textarea" }])).filter((item) => item.service && item.status).slice(0, 30);
  }
  const maxLength = fieldType === "long_text" ? 8000 : 500;
  const textValue = cleanText(value, maxLength);
  return textValue || null;
}

function fieldLabel(questionItem, key) {
  return [...(questionItem.itemFields ?? []), ...(questionItem.fields ?? [])].find((item) => item.key === key)?.label ?? key.replaceAll(/([A-Z_])/g, " $1").trim();
}

function formatObject(questionItem, value) {
  return Object.entries(value ?? {}).filter(([key, item]) => key !== "status" && answerHasValue(item)).map(([key, item]) => `${fieldLabel(questionItem, key)}: ${item}`).join(" · ");
}

function formatList(questionItem, value) {
  return normalizeList(questionItem, value).map((item, index) => `${index + 1}. ${formatObject(questionItem, item)}`).join("\n");
}

/**
 * @param {Record<string, any> | undefined} questionItem
 * @param {unknown} value
 * @returns {string}
 */
export function formatWeddingAnswer(questionItem, value) {
  if (!answerHasValue(value)) return "Not answered";
  if (questionItem?.fieldType === "yes_no") return value ? "Yes" : "No";
  if (questionItem?.fieldType === "tri_state") return value === "yes" ? "Yes" : value === "no" ? "No" : "We'll add this later";
  if (LIST_FIELD_TYPES.has(questionItem?.fieldType)) return formatList(questionItem, value);
  if (questionItem?.fieldType === "song_moment") {
    const normalized = normalizeWeddingAnswer(questionItem, value);
    if (normalized?.status === "not_doing") return "Not doing this";
    if (normalized?.status === "not_sure") return "Not sure yet - help us choose";
    return formatObject(questionItem, normalized);
  }
  if (questionItem?.fieldType === "details_group") return formatObject(questionItem, normalizeWeddingAnswer(questionItem, value));
  if (questionItem?.fieldType === "sensitive_checklist") {
    const normalized = normalizeWeddingAnswer(questionItem, value);
    const lines = (normalized?.items ?? []).map((item) => `${item.topic}${item.notes ? `: ${item.notes}` : ""}`);
    if (normalized?.otherNotes) lines.push(`Other details: ${normalized.otherNotes}`);
    return lines.join("\n") || "Not answered";
  }
  if (questionItem?.fieldType === "service_checklist") {
    const items = normalizeWeddingAnswer(questionItem, value) ?? [];
    return items.map((item) => {
      const status = item.status === "booked" ? "Booked/included" : item.status === "recommendation" ? "Needs recommendation" : "Not sure yet";
      const details = [item.location && `Setup: ${item.location}`, item.time && `Time: ${item.time}`, item.notes].filter(Boolean).join(" · ");
      return `${item.service} - ${status}${details ? ` · ${details}` : ""}`;
    }).join("\n");
  }
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join("\n");
  if (typeof value === "object") return formatObject(questionItem ?? {}, value);
  return String(value);
}
