import { answerHasValue } from "./wedding-companion.mjs";

function text(value) {
  if (!answerHasValue(value)) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.map(String).filter(Boolean).join("\n") : String(value);
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

function section(title, items) {
  return { title, items: items.filter(Boolean) };
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
      item("Wedding vision", answers.wedding_vision),
      item("Sensitive details and special considerations", answers.special_considerations),
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
      item("Processional order", answers.ceremony_participants),
      item("Processional music", answers.ceremony_processional_music),
      item("Special ceremony music", answers.ceremony_special_music),
      item("Recessional", answers.ceremony_recessional_song),
      item("Ceremony cues and instructions", answers.ceremony_notes),
    ]),
    section("Reception flow", [
      item("Cocktail hour", answers.cocktail_hour_included),
      item("Cocktail-hour location", answers.cocktail_hour_location),
      item("Cocktail-hour timing", join([formatTime(answers.cocktail_hour_start_time), formatTime(answers.cocktail_hour_end_time)])),
      item("Cocktail-hour sound", answers.cocktail_hour_sound),
      item("Cocktail-hour notes", answers.cocktail_hour_plan),
      item("Introduction order and pronunciations", answers.introduction_order),
      item("Wedding-party introduction song", answers.introduction_song),
      item("Couple's grand entrance song", answers.couple_entrance_song),
      item("Master timeline", answers.reception_timeline),
      item("Blessing, welcome, and toast speakers", answers.blessing_and_toasts),
      item("Reception and MC instructions", answers.reception_notes),
    ]),
    section("Music and special moments", [
      item("First dance", answers.first_dance_song),
      item("Parent and family dances", answers.parent_dances),
      item("Special moments", answers.formal_moments),
      item("Cake cutting", answers.cake_cutting_song),
      item("Bouquet toss", answers.bouquet_toss_song),
      item("Garter tradition", answers.garter_toss_song),
      item("Anniversary dance", answers.anniversary_dance_song),
      item("Private last dance", answers.private_last_dance_song),
      item("Last dance and exit", answers.last_dance_and_exit),
      item("Must-play highlights", answers.must_play_list),
      item("Do-not-play list", answers.do_not_play_list),
      item("Other dedications and song notes", answers.special_dance_notes),
      item("Overall music direction", answers.music_vibe),
      item("Guest requests", answers.guest_requests),
      item("Clean edits required", answers.clean_music_required),
      item("Cultural or traditional music", answers.cultural_music),
    ]),
    section("Venue and production logistics", [
      item("Venue coordinator", answers.venue_contact),
      item("Planner or coordinator", answers.planner_contact),
      item("EVENTSible venue access", formatTime(answers.venue_access_time)),
      item("Parking and load-in", answers.load_in_instructions),
      item("Reliable power available", answers.power_available),
      item("Venue Wi-Fi available", answers.wifi_available),
      item("Outdoor backup plan", answers.weather_backup_plan),
      item("Venue rules and curfew", answers.venue_rules),
      item("Vendor meals", answers.vendor_meals),
      item("Photo Booth plan", answers.photo_booth_plan),
      item("Uplighting plan", answers.uplighting_plan),
      item("Karaoke plan", answers.karaoke_plan),
      item("Games and guest interaction", answers.interactive_plan),
      item("Other service notes", answers.other_service_notes),
      item("Final questions", answers.final_questions),
    ]),
  ].filter((group) => group.items.length > 0);

  const critical = [
    ["Confirmed wedding date", answers.event_date_confirmed === true && answerHasValue(answers.event_date)],
    ["Couple's names", answerHasValue(answers.partner_one_name) && answerHasValue(answers.partner_two_name)],
    ["Day-of contact and phone", answerHasValue(answers.day_of_contact) && answerHasValue(answers.day_of_contact_phone)],
    ["Reception timeline", answerHasValue(answers.reception_timeline)],
    ["First dance song", answerHasValue(answers.first_dance_song)],
    ["Venue coordinator", answerHasValue(answers.venue_contact)],
    ["Venue access time", answerHasValue(answers.venue_access_time)],
    ["Parking and load-in instructions", answerHasValue(answers.load_in_instructions)],
  ];
  if (answers.ceremony_included === true) critical.push(["Ceremony start time", answerHasValue(answers.ceremony_start_time)]);
  if (answers.wedding_party_introductions === true) critical.push(["Introduction order and pronunciations", answerHasValue(answers.introduction_order)]);

  return {
    coupleName,
    eventDate,
    sections,
    missing: critical.filter(([, complete]) => !complete).map(([label]) => label),
  };
}
