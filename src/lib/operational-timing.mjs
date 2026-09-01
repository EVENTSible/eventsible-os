export const OPERATIONAL_TIMING_FACT_KEYS = Object.freeze({
  arrivalTime: "event.arrival_time",
  loadInWindow: "event.load_in_window",
  setupComplete: "event.setup_complete_by",
  breakdownStart: "event.breakdown_start",
  mustBeOut: "event.must_be_out",
});

export const OPERATIONAL_TIMING_FACT_KEY_LIST = Object.freeze(Object.values(OPERATIONAL_TIMING_FACT_KEYS));

/** @typedef {{arrival_time: string, load_in_start: string, load_in_end: string, setup_complete_by: string, breakdown_start: string, must_be_out: string}} OperationalTimingFormValues */

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DISPLAY_TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i;

export function normalizeClockTime(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (TIME_PATTERN.test(trimmed)) return trimmed;
  const displayMatch = trimmed.match(DISPLAY_TIME_PATTERN);
  if (!displayMatch) return null;
  let hour = Number(displayMatch[1]);
  const minute = Number(displayMatch[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (displayMatch[3].toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (displayMatch[3].toLowerCase() === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatClockTime(value, fallback = "Not provided") {
  const normalized = normalizeClockTime(value);
  if (!normalized) return typeof value === "string" && value.trim() ? value.trim() : fallback;
  const [hourText, minute] = normalized.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function normalizeLoadInWindow(value) {
  if (typeof value === "string") {
    const normalized = normalizeClockTime(value);
    return normalized ? { start: normalized, end: null } : { start: null, end: null };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { start: null, end: null };
  return {
    start: normalizeClockTime(value.start),
    end: normalizeClockTime(value.end),
  };
}

export function formatLoadInWindow(value, fallback = "Not provided") {
  const window = normalizeLoadInWindow(value);
  if (!window.start) return typeof value === "string" && value.trim() ? value.trim() : fallback;
  return window.end
    ? `${formatClockTime(window.start)} – ${formatClockTime(window.end)}`
    : formatClockTime(window.start);
}

export function operationalTimingFacts(facts = []) {
  const factMap = new Map(facts.map((fact) => [fact?.fact_key, fact?.value]));
  return {
    arrivalTime: normalizeClockTime(factMap.get(OPERATIONAL_TIMING_FACT_KEYS.arrivalTime)),
    loadInWindow: normalizeLoadInWindow(factMap.get(OPERATIONAL_TIMING_FACT_KEYS.loadInWindow)),
    setupComplete: normalizeClockTime(factMap.get(OPERATIONAL_TIMING_FACT_KEYS.setupComplete)),
    breakdownStart: normalizeClockTime(factMap.get(OPERATIONAL_TIMING_FACT_KEYS.breakdownStart)),
    mustBeOut: normalizeClockTime(factMap.get(OPERATIONAL_TIMING_FACT_KEYS.mustBeOut)),
  };
}

/** @param {Record<string, any>} operational @returns {OperationalTimingFormValues} */
export function operationalTimingFormValues(operational = {}) {
  const loadIn = normalizeLoadInWindow(operational.loadInWindow);
  return {
    arrival_time: normalizeClockTime(operational.arrivalTime) ?? "",
    load_in_start: loadIn.start ?? "",
    load_in_end: loadIn.end ?? "",
    setup_complete_by: normalizeClockTime(operational.setupComplete) ?? "",
    breakdown_start: normalizeClockTime(operational.breakdownStart) ?? "",
    must_be_out: normalizeClockTime(operational.mustBeOut) ?? "",
  };
}

const FIELD_DEFINITIONS = Object.freeze([
  ["arrival_time", "Arrival time", OPERATIONAL_TIMING_FACT_KEYS.arrivalTime],
  ["setup_complete_by", "Setup complete by", OPERATIONAL_TIMING_FACT_KEYS.setupComplete],
  ["breakdown_start", "Breakdown", OPERATIONAL_TIMING_FACT_KEYS.breakdownStart],
  ["must_be_out", "Must be out by", OPERATIONAL_TIMING_FACT_KEYS.mustBeOut],
]);

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * @param {{eventId: string, userId: string, submitted?: Record<string, string>, current?: Record<string, any>}} input
 */
export function buildOperationalTimingMutation({ eventId, userId, submitted = {}, current = {} }) {
  /** @type {Record<string, string>} */
  const errors = {};
  const rows = [];
  const changedLabels = [];
  const currentForm = operationalTimingFormValues(current);

  for (const [field, label, factKey] of FIELD_DEFINITIONS) {
    const input = typeof submitted[field] === "string" ? submitted[field].trim() : "";
    if (!input) continue;
    const normalized = normalizeClockTime(input);
    if (!normalized) {
      errors[field] = `${label} must be a valid time.`;
      continue;
    }
    if (normalized === currentForm[field]) continue;
    rows.push({ event_id: eventId, fact_key: factKey, value: normalized, source: "staff", is_confirmed: true, updated_by: userId });
    changedLabels.push(label);
  }

  const loadStartInput = typeof submitted.load_in_start === "string" ? submitted.load_in_start.trim() : "";
  const loadEndInput = typeof submitted.load_in_end === "string" ? submitted.load_in_end.trim() : "";
  if (loadEndInput && !loadStartInput) errors.load_in_start = "Add the load-in start before an end time.";
  const loadStart = loadStartInput ? normalizeClockTime(loadStartInput) : null;
  const loadEnd = loadEndInput ? normalizeClockTime(loadEndInput) : null;
  if (loadStartInput && !loadStart) errors.load_in_start = "Load-in start must be a valid time.";
  if (loadEndInput && !loadEnd) errors.load_in_end = "Load-in end must be a valid time.";
  if (loadStart && !Object.keys(errors).some((key) => key.startsWith("load_in_"))) {
    const nextWindow = { start: loadStart, end: loadEnd };
    const currentWindow = { start: currentForm.load_in_start || null, end: currentForm.load_in_end || null };
    if (!sameValue(nextWindow, currentWindow)) {
      rows.push({ event_id: eventId, fact_key: OPERATIONAL_TIMING_FACT_KEYS.loadInWindow, value: nextWindow, source: "staff", is_confirmed: true, updated_by: userId });
      changedLabels.push("Load-in");
    }
  }

  return { errors, rows: Object.keys(errors).length ? [] : rows, changedLabels: Object.keys(errors).length ? [] : changedLabels };
}

export function operationalTimingRpcArgs(eventId, rows = []) {
  const args = {
    p_event_id: eventId,
    p_arrival_time: null,
    p_load_in_window: null,
    p_setup_complete_by: null,
    p_breakdown_start: null,
    p_must_be_out: null,
  };

  const argumentByFactKey = {
    [OPERATIONAL_TIMING_FACT_KEYS.arrivalTime]: "p_arrival_time",
    [OPERATIONAL_TIMING_FACT_KEYS.loadInWindow]: "p_load_in_window",
    [OPERATIONAL_TIMING_FACT_KEYS.setupComplete]: "p_setup_complete_by",
    [OPERATIONAL_TIMING_FACT_KEYS.breakdownStart]: "p_breakdown_start",
    [OPERATIONAL_TIMING_FACT_KEYS.mustBeOut]: "p_must_be_out",
  };

  for (const row of rows) {
    const argument = argumentByFactKey[row?.fact_key];
    if (!argument) throw new Error("Unsupported operational timing fact key.");
    args[argument] = row.value;
  }
  return args;
}

export function operationalTimingRpcError(error) {
  const code = String(error?.code ?? "");
  if (code === "28000" || code === "42501") return "Your staff session is not authorized to update this event.";
  if (code === "22023") return "Check the timing values. Nothing was saved.";
  if (code === "P0002") return "The canonical event could not be found. Nothing was saved.";
  return "Operational times could not be saved. Nothing was changed.";
}
