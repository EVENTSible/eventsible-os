const DEFAULT_TIME_ZONE = "America/Indiana/Indianapolis";

export function eventTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function parsed(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function eventDateLabel(value, timeZone, fallback = "Date not provided") {
  const date = parsed(value);
  return date ? new Intl.DateTimeFormat("en-US", { timeZone: eventTimeZone(timeZone), dateStyle: "full" }).format(date) : fallback;
}

export function eventTimeLabel(value, timeZone, fallback = "Not provided") {
  const date = parsed(value);
  return date ? new Intl.DateTimeFormat("en-US", { timeZone: eventTimeZone(timeZone), hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date) : fallback;
}

export function eventDateTimeLabel(value, timeZone, fallback = "Date not provided") {
  const date = parsed(value);
  return date ? new Intl.DateTimeFormat("en-US", {
    timeZone: eventTimeZone(timeZone),
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date) : fallback;
}

export function eventLocalDateTimeInput(value, timeZone) {
  const date = parsed(value);
  if (!date) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: eventTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function eventWhenLabel(row) {
  if (row?.historical_date) return `${row.historical_date} · Time not provided`;
  return eventDateTimeLabel(row?.starts_at, row?.timezone);
}
