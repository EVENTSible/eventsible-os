export const TEAM_AVAILABILITY_TYPES = Object.freeze(["available", "unavailable", "outside_booking", "vacation", "reminder", "note"]);
export const TEAM_AVAILABILITY_PRIVACY = Object.freeze(["busy_only", "team_details", "private"]);
export const STAFF_ASSIGNMENT_ROLES = Object.freeze(["dj", "mc", "vocalist", "assistant", "activity_helper", "operator", "other"]);
export const BLOCKING_TEAM_AVAILABILITY_TYPES = Object.freeze(["unavailable", "outside_booking", "vacation"]);

export function isBlockingAvailability(entry) {
  return BLOCKING_TEAM_AVAILABILITY_TYPES.includes(entry?.entryType);
}

export function availabilityPrivacyDefault(entryType) {
  if (entryType === "available") return "team_details";
  if (entryType === "reminder" || entryType === "note") return "private";
  return "busy_only";
}

export function availabilityTypeLabel(entryType) {
  return ({
    available: "Available",
    unavailable: "Unavailable",
    outside_booking: "Outside booking",
    vacation: "Vacation / time off",
    reminder: "Reminder",
    note: "Note / idea",
  })[entryType] ?? "Schedule entry";
}

export function dateRangeKeys(startKey, endKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startKey)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endKey))) return [];
  const start = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${endKey}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) return [];
  const values = [];
  for (const date = new Date(start); date <= end && values.length <= 400; date.setUTCDate(date.getUTCDate() + 1)) {
    values.push(date.toISOString().slice(0, 10));
  }
  return values;
}

export function availabilityDateKeys(entry) {
  if (entry?.allDay) return dateRangeKeys(entry.startsOn, entry.endsOn);
  const start = String(entry?.startsAt ?? "").slice(0, 10);
  const end = String(entry?.endsAt ?? entry?.startsAt ?? "").slice(0, 10);
  return dateRangeKeys(start, end);
}

export function scheduleInterval(item, eventsById = new Map()) {
  if (item?.kind === "availability" || item?.entryType || (!item?.eventId && (item?.allDay || item?.startsAt))) {
    if (item.allDay) {
      const start = Date.parse(`${item.startsOn}T00:00:00Z`);
      const inclusiveEnd = Date.parse(`${item.endsOn}T00:00:00Z`);
      if (!Number.isFinite(start) || !Number.isFinite(inclusiveEnd)) return null;
      return { start, end: inclusiveEnd + 86_400_000 };
    }
    const start = Date.parse(item.startsAt);
    const end = Date.parse(item.endsAt);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
  }

  const event = eventsById.get(item?.eventId);
  if (!event?.startsAt || !(event?.conflictEndsAt || event?.endsAt)) return null;
  const eventStart = Date.parse(event.conflictStartsAt || event.startsAt);
  const callTime = item?.callTime ? Date.parse(item.callTime) : Number.NaN;
  const end = Date.parse(event.conflictEndsAt || event.endsAt);
  const start = Number.isFinite(callTime) ? Math.min(callTime, eventStart) : eventStart;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/** @param {{availability?: any[], assignments?: any[], events?: any[], visibleTeamMemberId?: string | null, canViewAll?: boolean}} input */
export function detectScheduleConflicts({ availability = [], assignments = [], events = [], visibleTeamMemberId = null, canViewAll = false } = {}) {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const occupiedByMember = new Map();
  for (const entry of availability) {
    if (!isBlockingAvailability(entry)) continue;
    const interval = scheduleInterval(entry, eventsById);
    if (!interval) continue;
    const item = { id: entry.id, kind: "availability", teamMemberId: entry.teamMemberId, ...interval };
    occupiedByMember.set(entry.teamMemberId, [...(occupiedByMember.get(entry.teamMemberId) ?? []), item]);
  }
  for (const assignment of assignments) {
    const interval = scheduleInterval(assignment, eventsById);
    if (!interval) continue;
    const item = { id: assignment.id, kind: "assignment", eventId: assignment.eventId, teamMemberId: assignment.teamMemberId, ...interval };
    occupiedByMember.set(assignment.teamMemberId, [...(occupiedByMember.get(assignment.teamMemberId) ?? []), item]);
  }

  const conflicts = [];
  for (const [teamMemberId, occupied] of occupiedByMember) {
    if (!canViewAll && teamMemberId !== visibleTeamMemberId) continue;
    occupied.sort((left, right) => left.start - right.start);
    for (let leftIndex = 0; leftIndex < occupied.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < occupied.length; rightIndex += 1) {
        const left = occupied[leftIndex];
        const right = occupied[rightIndex];
        if (right.start >= left.end) break;
        if (left.start < right.end && left.end > right.start) {
          conflicts.push({
            id: `${teamMemberId}:${left.id}:${right.id}`,
            teamMemberId,
            leftId: left.id,
            rightId: right.id,
            startsAt: new Date(Math.max(left.start, right.start)).toISOString(),
            endsAt: new Date(Math.min(left.end, right.end)).toISOString(),
          });
        }
      }
    }
  }
  return conflicts;
}

export function conflictIds(conflicts = []) {
  return new Set(conflicts.flatMap((conflict) => [conflict.leftId, conflict.rightId]));
}

export function teamAvailabilityLabel(entry) {
  if (entry?.title) return entry.title;
  if (entry?.entryType === "available") return "Available";
  if (entry?.entryType === "reminder") return "Reminder";
  if (entry?.entryType === "note") return "Note / idea";
  if (entry?.entryType === "outside_booking") return "Busy";
  if (entry?.entryType === "vacation") return "Unavailable";
  return "Unavailable";
}

export function assignmentRoleLabel(value) {
  return String(value ?? "other").split("_").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}

export function localDateTimeToIso(value, timeZone) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let candidate = desired;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(candidate));
      const part = (type) => Number(parts.find((item) => item.type === type)?.value);
      const rendered = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
      candidate += desired - rendered;
    }
    return new Date(candidate).toISOString();
  } catch {
    return null;
  }
}

function clock(value) {
  const match = String(value ?? "").match(/(?:^|T)([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function operationalConflictWindow(event, settings = {}, facts = []) {
  if (!event?.dateKey || !event?.startsAt) return { conflictStartsAt: event?.startsAt ?? null, conflictEndsAt: event?.endsAt ?? null };
  const factMap = new Map(facts.filter((fact) => String(fact?.event_id) === String(event.id)).map((fact) => [fact.fact_key, fact.value]));
  const loadWindow = factMap.get("event.load_in_window");
  const loadStart = loadWindow && typeof loadWindow === "object" ? loadWindow.start : loadWindow;
  const startClocks = [
    factMap.get("event.arrival_time"),
    loadStart,
    settings.arrival_time,
    settings.setup_start,
    settings.setup_complete_by,
  ].map(clock).filter(Boolean);
  const endClocks = [
    factMap.get("event.breakdown_start"),
    factMap.get("event.must_be_out"),
    settings.breakdown_start,
    settings.must_be_out,
  ].map(clock).filter(Boolean);

  const canonicalStart = Date.parse(event.startsAt);
  const canonicalEnd = event.endsAt ? Date.parse(event.endsAt) : Number.NaN;
  const startCandidates = startClocks.map((value) => localDateTimeToIso(`${event.dateKey}T${value}`, event.timezone)).filter(Boolean).map(Date.parse);
  const conflictStart = Math.min(canonicalStart, ...startCandidates);
  const endCandidates = endClocks.map((value) => localDateTimeToIso(`${event.dateKey}T${value}`, event.timezone)).filter(Boolean).map(Date.parse).map((value) => value <= canonicalStart ? value + 86_400_000 : value);
  const validEnds = [canonicalEnd, ...endCandidates].filter(Number.isFinite);
  return {
    conflictStartsAt: Number.isFinite(conflictStart) ? new Date(conflictStart).toISOString() : event.startsAt,
    conflictEndsAt: validEnds.length ? new Date(Math.max(...validEnds)).toISOString() : null,
  };
}
