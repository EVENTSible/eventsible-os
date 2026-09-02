export const HQ_CALENDAR_TIME_ZONE = "America/Indiana/Indianapolis";

export const CONFIRMED_BOOKING_STATUSES = Object.freeze(["confirmed", "completed"]);
export const BOOKED_EVENT_STATUSES = Object.freeze(["booked", "planning", "ready", "active", "completed"]);
export const BLOCKED_EVENT_STATUSES = Object.freeze(["cancelled", "archived"]);
export const INQUIRY_BOOKING_STATUSES = Object.freeze(["pending", "pending_contract", "pending_deposit"]);
export const INQUIRY_EVENT_STATUSES = Object.freeze(["draft", "inquiry", "quoted", "pending"]);

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function localDateKey(value, timeZone = HQ_CALENDAR_TIME_ZONE) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type) => parts.find((candidate) => candidate.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

export function localTimeLabel(value, timeZone = HQ_CALENDAR_TIME_ZONE) {
  if (!value) return "Time not provided";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) return "Time not provided";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    return "Time not provided";
  }
}

export function isConfirmedBooked(event) {
  const eventStatus = normalized(event?.eventStatus ?? event?.event_status ?? event?.status);
  const bookingStatus = normalized(event?.bookingStatus ?? event?.booking_status);
  if (BLOCKED_EVENT_STATUSES.includes(eventStatus) || bookingStatus === "cancelled") return false;
  return CONFIRMED_BOOKING_STATUSES.includes(bookingStatus) || BOOKED_EVENT_STATUSES.includes(eventStatus);
}

export function isInquiryOrHold(event) {
  if (isConfirmedBooked(event)) return false;
  const eventStatus = normalized(event?.eventStatus ?? event?.event_status ?? event?.status);
  const bookingStatus = normalized(event?.bookingStatus ?? event?.booking_status);
  return INQUIRY_BOOKING_STATUSES.includes(bookingStatus) || INQUIRY_EVENT_STATUSES.includes(eventStatus);
}

export function availabilityForDate(events, dateKey) {
  const scheduled = events.filter((event) => event.dateKey === dateKey);
  const booked = scheduled.filter(isConfirmedBooked);
  const inquiries = scheduled.filter(isInquiryOrHold);
  return {
    state: booked.length > 1 ? "multiple" : booked.length === 1 ? "booked" : "open",
    label: booked.length > 1 ? "Multiple events" : booked.length === 1 ? "Booked" : "Open",
    booked,
    inquiries,
    scheduled,
  };
}

export function shapeCalendarEvent(row) {
  const timezone = String(row?.timezone || HQ_CALENDAR_TIME_ZONE);
  const startsAt = row?.starts_at ? String(row.starts_at) : null;
  const endsAt = row?.ends_at ? String(row.ends_at) : null;
  const services = Array.isArray(row?.booked_services)
    ? row.booked_services.map((service) => String(service?.service_name ?? service?.service_code ?? "").trim()).filter(Boolean)
    : [];
  return {
    id: String(row?.event_id ?? row?.id ?? ""),
    title: String(row?.title ?? "Untitled event"),
    eventType: String(row?.event_type ?? "Event"),
    eventStatus: normalized(row?.event_status ?? row?.status),
    bookingStatus: normalized(row?.booking_status),
    startsAt,
    endsAt,
    timezone,
    dateKey: localDateKey(startsAt, timezone),
    startLabel: localTimeLabel(startsAt, timezone),
    endLabel: endsAt ? localTimeLabel(endsAt, timezone) : null,
    venue: String(row?.venue_name ?? row?.venue_summary ?? "").trim() || null,
    services,
    classification: isConfirmedBooked(row) ? "booked" : isInquiryOrHold(row) ? "inquiry" : "other",
  };
}

export function monthGrid(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey ?? ""))) return [];
  const [year, month] = monthKey.split("-").map(Number);
  if (month < 1 || month > 12) return [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { key, day: date.getUTCDate(), inMonth: date.getUTCMonth() === month - 1 };
  });
}

export function agendaEvents(events, fromDateKey, days) {
  const start = new Date(`${fromDateKey}T00:00:00Z`);
  if (Number.isNaN(start.valueOf())) return [];
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days);
  const endKey = end.toISOString().slice(0, 10);
  return events
    .filter((event) => event.dateKey && event.dateKey >= fromDateKey && event.dateKey < endKey)
    .sort((left, right) => String(left.startsAt ?? "").localeCompare(String(right.startsAt ?? "")));
}
