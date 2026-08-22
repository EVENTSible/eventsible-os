import { answerHasValue, formatWeddingAnswer, weddingQuestionMap } from "./wedding-companion.mjs";

const questionMap = weddingQuestionMap();

function text(value) {
  if (!answerHasValue(value)) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.map(String).filter(Boolean).join("\n") : String(value);
}

function answerText(key, value) {
  if (!answerHasValue(value)) return "";
  const formatted = formatWeddingAnswer(questionMap.get(key), value);
  return formatted === "Not answered" ? "" : formatted;
}

function join(values, separator = " · ") {
  return values.map(text).filter(Boolean).join(separator);
}

function formatDate(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [year, month, day] = raw.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(value) {
  const raw = text(value);
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = match[2];
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function item(label, value) {
  const formatted = text(value);
  return formatted ? { label, value: formatted } : null;
}

function answerItem(label, key, value) {
  const formatted = answerText(key, value);
  return formatted ? { label, value: formatted } : null;
}

function section(title, items) {
  return { title, items: items.filter(Boolean) };
}

function pendingDetail(gate, value) {
  if (gate === undefined || gate === null) return answerHasValue(value);
  return gate === "yes" && answerHasValue(value);
}

function songMomentReady(value) {
  if (typeof value === "string") return answerHasValue(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.status === "not_doing") return true;
  return value.status === "chosen" && answerHasValue(value.songTitle);
}

export function buildWeddingDaySheet(answers = {}) {
  const enteredCoupleName = join([answers.partner_one_name, answers.partner_two_name], " & ");
  const coupleName = enteredCoupleName || "Wedding Day Production Sheet";
  const eventDate = formatDate(answers.event_date);
  const dayOfContact = join([answers.day_of_contact, answers.day_of_contact_phone]);

  const sections = [
    section("Wedding at a glance", [
      item("Couple", enteredCoupleName),
      item("Wedding date", eventDate),
      item("Estimated guest count", answers.guest_count),
      item("Day-of contact", dayOfContact),
      item("Wedding colors", answers.wedding_colors),
      answerItem("Wedding theme or style", "wedding_theme_style", answers.wedding_theme_style),
      item("Theme notes", answers.wedding_theme_notes),
      item("Guest attire", answers.guest_attire),
      item("Wedding-party attire", answers.wedding_party_attire),
      item("EVENTSible staff attire", answers.eventsible_staff_attire),
      item("EVENTSible attire notes", answers.eventsible_staff_attire_notes),
      item("Wedding vision", answers.wedding_vision),
      answerItem("Sensitive details and special considerations", "special_considerations", answers.special_considerations),
    ]),
    section("Ceremony cues", [
      item("Ceremony location", answers.ceremony_location),
      item("Ceremony address/details", answers.ceremony_address),
      item("Guest arrival", formatTime(answers.guest_arrival_time)),
      item("Ceremony start", formatTime(answers.ceremony_start_time)),
      item("Wedding-party lineup", formatTime(answers.lineup_time)),
      item("Officiant", answers.officiant_name),
      item("Officiant microphone", answers.officiant_needs_mic),
      item("Rehearsal", answers.rehearsal_needed),
      item("Rehearsal date", formatDate(answers.rehearsal_date)),
      item("Rehearsal time", formatTime(answers.rehearsal_time)),
      item("Rehearsal notes", answers.rehearsal_notes),
      answerItem("Processional order", "ceremony_participants", answers.ceremony_participants),
      answerItem("Processional music", "ceremony_processional_music", answers.ceremony_processional_music),
      answerItem("Bride/couple entrance", "ceremony_main_entrance_song", answers.ceremony_main_entrance_song),
      answerItem("Recessional", "ceremony_recessional_song", answers.ceremony_recessional_song),
      item("Saved ceremony special music", answers.ceremony_special_music),
      item("Ceremony cues and instructions", answers.ceremony_notes),
    ]),
    section("Reception flow", [
      answerItem("Cocktail hour", "cocktail_hour_included", answers.cocktail_hour_included),
      item("Cocktail-hour location", answers.cocktail_hour_location),
      item("Cocktail-hour timing", join([formatTime(answers.cocktail_hour_start_time), formatTime(answers.cocktail_hour_end_time)])),
      answerItem("Cocktail-hour music", "cocktail_hour_sound", answers.cocktail_hour_sound),
      answerItem("Cocktail-hour flow", "cocktail_hour_plan", answers.cocktail_hour_plan),
      answerItem("Introduction order", "introduction_order", answers.introduction_order),
      answerItem("Wedding-party entrance song", "introduction_song", answers.introduction_song),
      answerItem("Couple grand entrance", "couple_entrance_song", answers.couple_entrance_song),
      answerItem("Timeline status", "reception_timeline_known", answers.reception_timeline_known),
      answerItem("Master timeline", "reception_timeline", answers.reception_timeline),
      answerItem("Meal service status", "meal_service_status", answers.meal_service_status),
      answerItem("Meal service", "meal_service_details", answers.meal_service_details),
      answerItem("Formal moments status", "formal_reception_moments_status", answers.formal_reception_moments_status),
      answerItem("Formal moments", "formal_moments", answers.formal_moments),
      answerItem("Blessing, welcome, and toast speakers", "blessing_and_toasts", answers.blessing_and_toasts),
      item("Other speaker notes", answers.speaker_other_notes),
      answerItem("MC instruction status", "mc_instructions_status", answers.mc_instructions_status),
      answerItem("Reception and MC instructions", "reception_notes", answers.reception_notes),
    ]),
    section("Music and special moments", [
      answerItem("First dance", "first_dance_song", answers.first_dance_song),
      answerItem("Parent and family dances", "parent_dances", answers.parent_dances),
      answerItem("Anniversary dance", "anniversary_dance_song", answers.anniversary_dance_song),
      answerItem("Cake cutting", "cake_cutting_song", answers.cake_cutting_song),
      answerItem("Bouquet or garter", "bouquet_toss_song", answers.bouquet_toss_song),
      item("Saved garter tradition song", answers.garter_toss_song),
      item("Saved private last dance", answers.private_last_dance_song),
      answerItem("Saved line and group dances", "line_dances", answers.line_dances),
      answerItem("Last dance or send-off", "last_dance_and_exit", answers.last_dance_and_exit),
      answerItem("Music styles", "music_styles", answers.music_styles),
      answerItem("Must-play highlights", "must_play_list", answers.must_play_list),
      answerItem("Do-not-play list", "do_not_play_list", answers.do_not_play_list),
      item("Other dedications and song notes", answers.special_dance_notes),
      item("Other dance-floor direction", answers.music_vibe),
      item("Guest requests", answers.guest_requests),
      item("Clean edits required", answers.clean_music_required),
      answerItem("Saved favorite genres and artists", "favorite_genres", answers.favorite_genres),
      answerItem("Saved genres and artists to avoid", "avoid_genres", answers.avoid_genres),
      item("Cultural or traditional music", answers.cultural_music),
    ]),
    section("Venue and production logistics", [
      answerItem("Venue contact status", "venue_contact_known", answers.venue_contact_known),
      answerItem("Venue coordinator", "venue_contact", answers.venue_contact),
      answerItem("Venue access status", "venue_access_known", answers.venue_access_known),
      item("EVENTSible venue access", formatTime(answers.venue_access_time)),
      answerItem("Parking and load-in", "load_in_instructions", answers.load_in_instructions),
      answerItem("Planner contact status", "planner_contact_known", answers.planner_contact_known),
      answerItem("Planner or coordinator", "planner_contact", answers.planner_contact),
      answerItem("Photo/video contact status", "photo_video_contact_known", answers.photo_video_contact_known),
      answerItem("Photo and video", "photo_video_contact", answers.photo_video_contact),
      answerItem("Sound restriction status", "sound_restrictions_known", answers.sound_restrictions_known),
      answerItem("Sound limits and venue rules", "venue_rules", answers.venue_rules),
      answerItem("Rain-plan status", "rain_plan_known", answers.rain_plan_known),
      answerItem("Outdoor backup plan", "weather_backup_plan", answers.weather_backup_plan),
      answerItem("Power/setup status", "power_setup_known", answers.power_setup_known),
      answerItem("Power and setup", "power_setup_details", answers.power_setup_details),
      item("Saved reliable power availability", answers.power_available),
      item("Saved venue Wi-Fi availability", answers.wifi_available),
      item("Vendor meals", answers.vendor_meals),
      answerItem("EVENTSible services", "booked_services", answers.booked_services),
      item("Saved Photo Booth plan", answers.photo_booth_plan),
      item("Saved uplighting plan", answers.uplighting_plan),
      item("Saved karaoke plan", answers.karaoke_plan),
      item("Saved games and guest interaction", answers.interactive_plan),
      item("Other service notes", answers.other_service_notes),
      item("Final questions", answers.final_questions),
    ]),
  ].filter((group) => group.items.length > 0);

  const critical = [
    ["Confirmed wedding date", answers.event_date_confirmed === true && answerHasValue(answers.event_date)],
    ["Couple's names", answerHasValue(answers.partner_one_name) && answerHasValue(answers.partner_two_name)],
    ["Day-of contact and phone", answerHasValue(answers.day_of_contact) && answerHasValue(answers.day_of_contact_phone)],
    ["Reception timeline", pendingDetail(answers.reception_timeline_known, answers.reception_timeline)],
    ["First dance decision", songMomentReady(answers.first_dance_song)],
    ["Venue coordinator", pendingDetail(answers.venue_contact_known, answers.venue_contact)],
    ["Venue access time", pendingDetail(answers.venue_access_known, answers.venue_access_time)],
    ["Parking and load-in instructions", pendingDetail(answers.venue_access_known, answers.load_in_instructions)],
  ];
  if (answers.ceremony_included === true) critical.push(["Ceremony start time", answerHasValue(answers.ceremony_start_time)]);
  if (answers.wedding_party_introductions === true) critical.push(["Introduction order and pronunciations", answerHasValue(answers.introduction_order)]);

  return { coupleName, eventDate, sections, missing: critical.filter(([, complete]) => !complete).map(([label]) => label) };
}
