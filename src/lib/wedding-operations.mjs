import { createHash } from "node:crypto";
import { buildWeddingDaySheet } from "./wedding-day-sheet.mjs";

const text = value => typeof value === "string" ? value.trim() : "";
const list = value => Array.isArray(value) ? value : [];
const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(text(value)) ? text(value) : null;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const digest = value => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

export function weddingMusicRequests(answers = {}) {
  const rows = [];
  function song(value, group, moment, sourceKey) {
    if (!value || (value.status && value.status !== "chosen")) return;
    const item = typeof value === "string" ? { songTitle: value } : value;
    if (!text(item.songTitle)) return;
    rows.push({ group, moment, sourceKey, title: text(item.songTitle), artist: text(item.artist), version: text(item.version), cue: text(item.cue), fade: text(item.fade), notes: text(item.notes), people: text(item.people), approval: group === "DO NOT PLAY" ? "CLIENT DO-NOT-PLAY" : "CLIENT SELECTED", localAvailability: "NOT VERIFIED" });
  }
  for (const [key, moment] of [["ceremony_processional_music", "Processional"], ["ceremony_main_entrance_song", "Main ceremony entrance"], ["ceremony_recessional_song", "Recessional"]]) song(answers[key], "Ceremony", moment, key);
  for (const [key, moment] of [["introduction_song", "Wedding-party introductions"], ["couple_entrance_song", "Couple entrance"], ["first_dance_song", "First dance"], ["cake_cutting_song", "Cake cutting"], ["anniversary_dance_song", "Anniversary dance"], ["bouquet_toss_song", "Bouquet toss"], ["last_dance_and_exit", "Last dance / exit"]]) song(answers[key], "Reception", moment, key);
  list(answers.parent_dances).forEach((item, i) => song(item, "Special dances", `Parent / family dance ${i + 1}`, `parent_dances.${i}`));
  for (const [key, group] of [["must_play_list", "Must play"], ["do_not_play_list", "DO NOT PLAY"]]) {
    if (typeof answers[key] === "string") song(answers[key], group, group, key);
    else list(answers[key]).forEach((item, i) => song(item, group, group, `${key}.${i}`));
  }
  return rows;
}

export function weddingTimeline(answers = {}) {
  const rows = [];
  const add = (time, moment, sourceKey, notes = "", people = "") => rows.push({ time: clock(time), submittedTime: text(time), moment, sourceKey, notes: text(notes), people: text(people), timeStatus: clock(time) ? "CLIENT SUBMITTED; TIMEZONE NEEDS CONFIRMATION" : "NEEDS CONFIRMATION" });
  add(answers.venue_access_time, "Venue access / load-in", "venue_access_time", answers.load_in_instructions);
  if (answers.ceremony_included === true) {
    add(answers.guest_arrival_time, "Ceremony guest arrival", "guest_arrival_time");
    add(answers.lineup_time, "Ceremony lineup", "lineup_time");
    add(answers.ceremony_start_time, "Ceremony start", "ceremony_start_time");
  }
  if (answers.cocktail_hour_included === true) {
    add(answers.cocktail_hour_start_time, "Cocktail hour begins", "cocktail_hour_start_time", answers.cocktail_hour_plan?.notes);
    add(answers.cocktail_hour_end_time, "Cocktail hour ends", "cocktail_hour_end_time");
  }
  list(answers.reception_timeline).forEach((item, i) => add(item.time, text(item.moment) || "Reception moment", `reception_timeline.${i}`, item.notes, item.people));
  if (answers.meal_service_status !== "not_doing") add(answers.meal_service_details?.time, "Meal service", "meal_service_details.time", answers.meal_service_details?.notes);
  add(answers.last_dance_time, "Final song / exit time", "last_dance_time");
  add(answers.breakdown_time, "Breakdown / must-be-out", "breakdown_time");
  return rows.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}

/** Client clock times are interpreted only in the event's explicitly verified timezone.
 * @param {Array<{time: string|null, sourceKey: string, moment: string}>} timeline
 * @param {{starts_at: unknown, ends_at: unknown, timezone: unknown}} coverage
 * @param {string|null} planningZone
 */
export function weddingScheduleReview(timeline, coverage, planningZone = null) {
  const start = Date.parse(coverage?.starts_at ?? "");
  const end = Date.parse(coverage?.ends_at ?? "");
  const zone = planningZone;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !zone) {
    return { status: "PENDING REVIEW", reason: "Confirm booked coverage and the client's clock timezone before comparing times.", outside: [], coverage };
  }
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(start));
  const datePart = type => dateParts.find(part => part.type === type)?.value;
  const day = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date(start));
  const offset = parts.find(part => part.type === "timeZoneName")?.value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!offset) return { status: "PENDING REVIEW", reason: "Timezone offset could not be verified.", outside: [], coverage };
  const minutes = (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0));
  const outside = timeline.filter(row => row.time).map(row => {
    const [hour, minute] = row.time.split(":").map(Number);
    const instant = Date.parse(`${day}T00:00:00Z`) + ((hour * 60 + minute) - minutes) * 60_000;
    return { ...row, instant, position: instant < start ? "BEFORE BOOKED COVERAGE" : instant > end ? "AFTER BOOKED COVERAGE" : "WITHIN BOOKED COVERAGE" };
  }).filter(row => row.position !== "WITHIN BOOKED COVERAGE");
  return { status: outside.length ? "PENDING REVIEW" : "NO OUTSIDE TIMES DETECTED", reason: outside.length ? "Client planning includes activities outside signed coverage." : "Clock times compared in the verified event timezone; confirm all missing times separately.", outside, coverage };
}

/** Read-only, deterministic suggestions. These are never task-creation commands. */
export function weddingTaskProposals(eventId, answers = {}, services = [], existingTasks = []) {
  if (!eventId) throw new Error("A canonical event ID is required.");
  const definitions = [
    ["confirm-plan", "Confirm event linkage, coverage, timezone and final timeline"],
    ["venue-access", "Confirm venue access, power, load-in and sound limits"],
    ["music", "Verify requested recordings, edits, cue points and offline backups"],
    ["staff", "Approve operator roles, call times and staff briefing"],
    ["sound", "Prepare and test DJ/MC sound, microphones and backup playback"],
  ];
  if (answers.ceremony_included === true) definitions.push(["ceremony", "Confirm ceremony coverage, sound and processional cues"]);
  if (services.some(s => /karaoke/i.test(s.service_code))) definitions.push(["karaoke", "Confirm karaoke use, microphones and licensed offline song catalog"]);
  if (services.some(s => /uplight/i.test(s.service_code))) definitions.push(["uplighting", "Confirm uplighting quantity, color, power and safe placement"]);
  if (services.some(s => /booth|prints/i.test(s.service_code))) definitions.push(["booth", "Confirm booth operator, print supplies, template and backup plan"]);
  return definitions.map(([code, title]) => {
    const key = `wedding-operations:v1:${eventId}:${code}`;
    const existing = existingTasks.find(t => t.metadata?.wedding_operations_key === key);
    return { key, eventId, title, status: existing ? "EXISTING" : "PROPOSED — OWNER REVIEW", existingTaskId: existing?.id ?? null };
  });
}

/**
 * Never combine answers with another event by matching names or dates.
 * @param {{event: {id: string, status?: string}, assignment: {id: string, event_id: string, submitted_at?: string|null}, answers?: Record<string, unknown>, services?: Array<{service_code?: string}>, tasks?: Array<{id: string, metadata?: Record<string, unknown>}>}} input
 */
export function buildWeddingOperations({ event, assignment, answers = {}, services = [], tasks = [] }) {
  if (!event?.id || !assignment?.id || assignment.event_id !== event.id) throw new Error("Wedding plan must be linked to this canonical event.");
  const sheet = buildWeddingDaySheet(answers);
  return {
    version: 1, eventId: event.id, assignmentId: assignment.id,
    sourceDigest: digest({ eventId: event.id, assignmentId: assignment.id, submittedAt: assignment.submitted_at, answers }),
    submittedAt: assignment.submitted_at ?? null,
    provenance: "Current saved answers; submission history is not an immutable answer archive.",
    sheet, music: weddingMusicRequests(answers), timeline: weddingTimeline(answers),
    tasks: weddingTaskProposals(event.id, answers, services, tasks),
    reviewWarnings: [
      ...(event.status === "inquiry" ? ["Planning submission is an inquiry, not a confirmed booking."] : []),
      ...(!list(answers.do_not_play_list).length && !text(answers.do_not_play_list) ? ["Do-not-play instructions need confirmation; absence is not permission."] : []),
      ...(!list(answers.music_styles).some(x => /clean|explicit/i.test(String(x))) ? ["Explicit-content / clean-edit policy needs confirmation."] : []),
      ...sheet.missing.map(label => `${label}: NEEDS CONFIRMATION`),
    ],
  };
}

/** Spreadsheet-safe RFC 4180 CSV; no formulas or local-file availability claims. */
export function weddingMusicCsv(rows) {
  const fields = ["approval", "group", "moment", "people", "title", "artist", "version", "cue", "fade", "notes", "localAvailability"];
  const cell = value => {
    const raw = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(raw) ? "'" : "") + raw.replaceAll('"', '""')}"`;
  };
  return [fields.map(cell).join(","), ...rows.map(row => fields.map(key => cell(row[key])).join(","))].join("\r\n") + "\r\n";
}
