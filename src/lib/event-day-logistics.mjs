import { normalizeClockTime } from "./operational-timing.mjs";

export const EVENT_DAY_LOGISTICS_LIMITS = Object.freeze({
  roomArea: 160,
  loadInDetails: 1500,
});

/** @typedef {{staff_call_time: string, setup_start: string, room_area: string, load_in_details: string}} EventDayLogisticsFormValues */

function scalar(value) {
  return ["string", "number"].includes(typeof value) && String(value).trim() ? String(value).trim() : "";
}

/** @param {Record<string, any>} operational @returns {EventDayLogisticsFormValues} */
export function eventDayLogisticsFormValues(operational = {}) {
  return {
    staff_call_time: normalizeClockTime(operational.staffCallTime) ?? scalar(operational.staffCallTime),
    setup_start: normalizeClockTime(operational.setupStart) ?? scalar(operational.setupStart),
    room_area: scalar(operational.roomArea),
    load_in_details: scalar(operational.loadInDetails),
  };
}

function canonicalValue(settings, key) {
  return settings && typeof settings === "object" && !Array.isArray(settings) ? scalar(settings[key]) : "";
}

/**
 * @param {{submitted?: Record<string, string>, currentSettings?: Record<string, any>}} input
 */
export function buildEventDayLogisticsMutation({ submitted = {}, currentSettings = {} } = {}) {
  /** @type {Record<string, string>} */
  const errors = {};
  const args = {
    p_staff_call_time: null,
    p_setup_start: null,
    p_room_area: null,
    p_load_in_details: null,
  };
  const changedLabels = [];

  for (const [field, label, argument] of [
    ["staff_call_time", "Staff call", "p_staff_call_time"],
    ["setup_start", "Setup start", "p_setup_start"],
  ]) {
    const input = scalar(submitted[field]);
    if (!input) continue;
    const normalized = normalizeClockTime(input);
    if (!normalized) {
      errors[field] = `${label} must be a valid time.`;
      continue;
    }
    if (normalized !== canonicalValue(currentSettings, field)) {
      args[argument] = normalized;
      changedLabels.push(label);
    }
  }

  for (const [field, label, argument, limit] of [
    ["room_area", "Room / area", "p_room_area", EVENT_DAY_LOGISTICS_LIMITS.roomArea],
    ["load_in_details", "Load-in / access notes", "p_load_in_details", EVENT_DAY_LOGISTICS_LIMITS.loadInDetails],
  ]) {
    const input = scalar(submitted[field]);
    if (!input) continue;
    if (input.length > limit) {
      errors[field] = `${label} must be ${limit.toLocaleString("en-US")} characters or fewer.`;
      continue;
    }
    if (input !== canonicalValue(currentSettings, field)) {
      args[argument] = input;
      changedLabels.push(label);
    }
  }

  if (Object.keys(errors).length) {
    for (const key of Object.keys(args)) args[key] = null;
    return { errors, args, changedLabels: [] };
  }

  return { errors, args, changedLabels };
}

export function eventDayLogisticsRpcArgs(eventId, args = {}) {
  return {
    p_event_id: eventId,
    p_staff_call_time: args.p_staff_call_time ?? null,
    p_setup_start: args.p_setup_start ?? null,
    p_room_area: args.p_room_area ?? null,
    p_load_in_details: args.p_load_in_details ?? null,
  };
}

export function eventDayLogisticsHasChanges(args = {}) {
  return Object.values(args).some((value) => value !== null && value !== undefined);
}

export function eventDayLogisticsRpcError(error) {
  const code = String(error?.code ?? "");
  if (code === "28000" || code === "42501") return "You are not authorized to update this event. Nothing was changed.";
  if (code === "22023") return "Check the event-day logistics fields. Nothing was saved.";
  if (code === "P0002") return "The canonical event could not be found. Nothing was changed.";
  return "Event-day logistics could not be saved. Nothing was changed.";
}
