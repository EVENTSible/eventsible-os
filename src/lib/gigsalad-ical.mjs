import {
  EXISTING_GIG_CANDIDATE_VERSION,
  EXISTING_GIG_NOTES_LIMIT,
  EXISTING_GIG_PAYLOAD_LIMIT,
  eventLocalDateTimeToIso,
} from "./existing-gig-intake.mjs";

export const GIGSALAD_ICAL_SOURCE = "gigsalad_ical";
export const GIGSALAD_ICAL_FEED_LIMIT = 1_048_576;
export const GIGSALAD_ICAL_EVENT_LIMIT = 500;

const REVIEWED_STATUSES = new Set(["imported", "matched", "ignored"]);
const REFRESHABLE_STATUSES = new Set(["pending", "review_later"]);

function text(value) {
  return String(value ?? "").trim();
}

function bounded(value, maximum) {
  const normalized = text(value);
  return normalized && normalized.length <= maximum ? normalized : null;
}

function validTimeZone(value) {
  const zone = text(value);
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function splitOutsideQuotes(value, delimiter) {
  const output = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === delimiter && !quoted) {
      output.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  output.push(current);
  return output;
}

function parseContentLine(line) {
  let separator = -1;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (line[index] === ":" && !quoted) {
      separator = index;
      break;
    }
  }
  if (separator < 1) return null;
  const left = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const segments = splitOutsideQuotes(left, ";");
  const name = text(segments.shift()).toUpperCase();
  if (!name) return null;
  const params = {};
  for (const segment of segments) {
    const equals = segment.indexOf("=");
    if (equals < 1) continue;
    const key = text(segment.slice(0, equals)).toUpperCase();
    const parameterValue = text(segment.slice(equals + 1)).replace(/^"|"$/g, "");
    if (key) params[key] = parameterValue;
  }
  return { name, params, value };
}

function unescapeIcalText(value) {
  return String(value ?? "")
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function unfoldLines(feed) {
  const physical = feed.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const logical = [];
  for (const line of physical) {
    if (/^[ \t]/.test(line) && logical.length) logical[logical.length - 1] += line.slice(1);
    else logical.push(line);
  }
  return logical;
}

function compactDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function compactDateTime(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const time = `${match[4]}:${match[5]}`;
  return { date, time, seconds: match[6] ?? "00" };
}

function parseCalendarDate(property, defaultTimeZone) {
  if (!property) return { iso: null, date: null, timezone: null, kind: "missing", warnings: [] };
  const raw = text(property.value);
  const declaredDate = property.params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(raw);
  if (declaredDate) {
    const date = compactDate(raw);
    return date
      ? { iso: null, date, timezone: null, kind: "date", warnings: ["all_day_date_requires_staff_review"] }
      : { iso: null, date: null, timezone: null, kind: "invalid", warnings: ["invalid_calendar_date"] };
  }
  if (/^\d{8}T\d{4}(\d{2})?Z$/.test(raw)) {
    const local = compactDateTime(raw.slice(0, -1));
    if (!local) return { iso: null, date: null, timezone: null, kind: "invalid", warnings: ["invalid_utc_datetime"] };
    const iso = `${local.date}T${local.time}:${local.seconds}.000Z`;
    return Number.isFinite(Date.parse(iso))
      ? { iso: new Date(iso).toISOString(), date: local.date, timezone: "UTC", kind: "utc", warnings: [] }
      : { iso: null, date: null, timezone: null, kind: "invalid", warnings: ["invalid_utc_datetime"] };
  }
  const local = compactDateTime(raw);
  if (!local) return { iso: null, date: null, timezone: null, kind: "invalid", warnings: ["invalid_local_datetime"] };
  const declaredZone = text(property.params.TZID);
  const zone = declaredZone || text(defaultTimeZone);
  if (!zone) {
    return { iso: null, date: local.date, timezone: null, kind: "floating", warnings: ["floating_time_requires_timezone"] };
  }
  if (!validTimeZone(zone)) {
    return { iso: null, date: local.date, timezone: null, kind: declaredZone ? "tzid" : "floating", warnings: ["unresolved_timezone"] };
  }
  const iso = eventLocalDateTimeToIso(local.date, local.time, zone);
  return iso
    ? { iso, date: local.date, timezone: zone, kind: declaredZone ? "tzid" : "floating", warnings: declaredZone ? [] : ["floating_time_used_configured_timezone"] }
    : { iso: null, date: local.date, timezone: zone, kind: declaredZone ? "tzid" : "floating", warnings: ["invalid_or_ambiguous_local_time"] };
}

function first(properties, name) {
  return properties.find((property) => property.name === name) ?? null;
}

function safeHttpUrl(value) {
  const candidate = bounded(unescapeIcalText(value), 500);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? candidate : null;
  } catch {
    return null;
  }
}

function parseGigSaladDescription(value) {
  const lines = unescapeIcalText(value).split("\n").map(text).filter(Boolean);
  const warnings = [];
  const unknownLines = [];
  let bookingNumber = null;
  let clientName = null;
  let sourceLinkPresent = false;
  let bookingLabelSeen = false;
  let clientLabelSeen = false;

  for (const line of lines) {
    const bookingMatch = line.match(/^GigSalad Booking #(\d{1,20})$/);
    if (bookingMatch) {
      bookingLabelSeen = true;
      if (bookingNumber === null) bookingNumber = bookingMatch[1];
      else warnings.push("duplicate_gigsalad_booking_number");
      continue;
    }
    if (line.startsWith("GigSalad Booking #")) {
      bookingLabelSeen = true;
      warnings.push("malformed_gigsalad_booking_number");
      continue;
    }

    const clientMatch = line.match(/^Client name:\s*(\S(?:.{0,158}\S)?)$/);
    if (clientMatch) {
      clientLabelSeen = true;
      if (clientName === null) clientName = clientMatch[1];
      else warnings.push("duplicate_gigsalad_client_name");
      continue;
    }
    if (line.startsWith("Client name:")) {
      clientLabelSeen = true;
      warnings.push("missing_gigsalad_client_name");
      continue;
    }

    if (safeHttpUrl(line)) {
      sourceLinkPresent = true;
      continue;
    }
    unknownLines.push(line);
  }

  if (!bookingNumber && !bookingLabelSeen) warnings.push("missing_gigsalad_booking_number");
  if (!clientName && !clientLabelSeen) warnings.push("missing_gigsalad_client_name");
  const unknownText = unknownLines.join("\n");
  const notes = unknownText ? unknownText.slice(0, EXISTING_GIG_NOTES_LIMIT) : null;
  if (unknownText.length > EXISTING_GIG_NOTES_LIMIT) warnings.push("description_notes_truncated");
  return { bookingNumber, clientName, sourceLinkPresent, notes, warnings };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sameProposal(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function buildCandidate(properties, calendarContext, defaultTimeZone) {
  const uid = bounded(unescapeIcalText(first(properties, "UID")?.value), 255);
  if (!uid || /[\u0000-\u001f\u007f]/.test(uid) || uid.includes("://")) {
    return { candidate: null, warnings: ["event_skipped_missing_or_unsafe_uid"] };
  }
  const recurrenceId = bounded(unescapeIcalText(first(properties, "RECURRENCE-ID")?.value), 80);
  const externalReference = recurrenceId ? `${uid}#${recurrenceId}` : uid;
  if (externalReference.length > 255) {
    return { candidate: null, warnings: ["event_skipped_external_reference_too_long"] };
  }

  const summary = bounded(unescapeIcalText(first(properties, "SUMMARY")?.value), 180);
  const location = bounded(unescapeIcalText(first(properties, "LOCATION")?.value), 200);
  const description = parseGigSaladDescription(first(properties, "DESCRIPTION")?.value);
  const sourceUrl = safeHttpUrl(first(properties, "URL")?.value);
  const status = bounded(unescapeIcalText(first(properties, "STATUS")?.value), 32)?.toUpperCase() ?? null;
  const lastModified = parseCalendarDate(first(properties, "LAST-MODIFIED"), "UTC");
  const sourceTimestamp = parseCalendarDate(first(properties, "DTSTAMP"), "UTC");
  const starts = parseCalendarDate(first(properties, "DTSTART"), defaultTimeZone);
  const ends = parseCalendarDate(first(properties, "DTEND"), starts.timezone || defaultTimeZone);
  const hasRecurrenceRule = Boolean(first(properties, "RRULE"));
  const uidMatch = uid.match(/^BA-(\d{1,20})@gigsalad\.com$/);
  const warnings = [...description.warnings, ...starts.warnings, ...ends.warnings];
  if (!uidMatch) warnings.push("unexpected_gigsalad_uid_shape");
  if (uidMatch && description.bookingNumber && uidMatch[1] !== description.bookingNumber) warnings.push("gigsalad_booking_number_uid_mismatch");
  if (!summary) warnings.push("missing_summary");
  if (!starts.iso) warnings.push("missing_reviewable_start_time");
  if (!ends.iso) warnings.push("missing_end_time");
  if (!location) warnings.push("missing_location");
  if (starts.timezone && starts.timezone !== "UTC" && calendarContext.declaredTimeZones.length && !calendarContext.declaredTimeZones.includes(starts.timezone)) {
    warnings.push("timezone_not_declared_in_calendar");
  }
  if (status === "CANCELLED") warnings.push("source_marks_event_cancelled_review_only");
  if (hasRecurrenceRule || recurrenceId) warnings.push("recurrence_requires_source_verification");

  const proposal = {
    event: {
      title: summary,
      event_type: null,
      starts_at: starts.iso,
      ends_at: ends.iso,
      timezone: starts.timezone,
      venue_name: null,
      venue_address_1: location,
      venue_address_2: null,
      venue_city: null,
      venue_state: null,
      venue_postal_code: null,
      venue_country: null,
    },
    contact: {
      mode: "unresolved",
      display_name: description.clientName,
      primary_email: null,
      primary_phone: null,
    },
    service_ids: [],
    booked_amount: null,
    notes: description.notes,
    provenance: {
      summary: "Proposed from the verified GigSalad iCalendar VEVENT structure.",
      calendar_title: bounded(calendarContext.calendarTitle, 180),
      calendar_product_is_gigsalad: calendarContext.productIsGigSalad,
      calendar_timezone_declared: starts.timezone ? calendarContext.declaredTimeZones.includes(starts.timezone) : false,
      uid,
      gigsalad_booking_number: description.bookingNumber,
      recurrence_id: recurrenceId,
      calendar_start_kind: starts.kind,
      calendar_start_date: starts.date,
      calendar_end_kind: ends.kind,
      calendar_end_date: ends.date,
      source_status: status,
      source_link_present: description.sourceLinkPresent || Boolean(sourceUrl),
      source_timestamp: sourceTimestamp.iso,
      last_modified: lastModified.iso,
      recurrence_present: hasRecurrenceRule || Boolean(recurrenceId),
    },
    missing_fields: [
      !summary ? "event.title" : null,
      "event.event_type",
      !starts.iso ? "event.starts_at" : null,
      !ends.iso ? "event.ends_at" : null,
      !location ? "venue.address" : null,
      "contact.decision",
      !description.clientName ? "contact.display_name" : null,
      "service_ids",
      "booking.total_amount",
    ].filter(Boolean),
    match_warnings: [],
    date_conflicts: [],
    source_warnings: [...new Set(warnings)],
  };

  if (new TextEncoder().encode(JSON.stringify(proposal)).length > EXISTING_GIG_PAYLOAD_LIMIT) {
    return { candidate: null, warnings: ["event_skipped_candidate_payload_too_large"] };
  }
  return {
    candidate: {
      contract_version: EXISTING_GIG_CANDIDATE_VERSION,
      source: GIGSALAD_ICAL_SOURCE,
      external_reference: externalReference,
      proposed_data: proposal,
      review_status: "pending",
    },
    warnings: proposal.source_warnings,
  };
}

export function parseGigSaladIcal(feed, options = {}) {
  if (typeof feed !== "string") throw new TypeError("iCalendar input must be text.");
  if (new TextEncoder().encode(feed).length > GIGSALAD_ICAL_FEED_LIMIT) throw new RangeError("iCalendar input exceeds the bounded feed limit.");
  const defaultTimeZone = text(options.defaultTimeZone);
  if (defaultTimeZone && !validTimeZone(defaultTimeZone)) throw new RangeError("The configured fallback timezone is not valid.");
  const lines = unfoldLines(feed);
  const calendarProperties = lines.map(parseContentLine).filter(Boolean);
  const calendarProperty = calendarProperties.find((property) => property.name === "X-WR-CALNAME");
  const calendarTitle = calendarProperty ? unescapeIcalText(calendarProperty.value) : null;
  const productId = unescapeIcalText(calendarProperties.find((property) => property.name === "PRODID")?.value);
  const declaredTimeZones = [];
  let activeTimeZone = false;
  for (const line of lines) {
    if (line.toUpperCase() === "BEGIN:VTIMEZONE") activeTimeZone = true;
    else if (line.toUpperCase() === "END:VTIMEZONE") activeTimeZone = false;
    else if (activeTimeZone) {
      const property = parseContentLine(line);
      if (property?.name === "TZID") {
        const zone = bounded(unescapeIcalText(property.value), 80);
        if (zone && !declaredTimeZones.includes(zone)) declaredTimeZones.push(zone);
      }
    }
  }
  const calendarContext = {
    calendarTitle,
    productIsGigSalad: /gigsalad\.com/i.test(productId),
    declaredTimeZones,
  };
  const eventBlocks = [];
  let active = null;
  for (const line of lines) {
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      if (active) throw new SyntaxError("Nested VEVENT blocks are not supported.");
      active = [];
    } else if (line.toUpperCase() === "END:VEVENT") {
      if (!active) throw new SyntaxError("Unexpected VEVENT terminator.");
      eventBlocks.push(active);
      active = null;
      if (eventBlocks.length > GIGSALAD_ICAL_EVENT_LIMIT) throw new RangeError("iCalendar input exceeds the bounded VEVENT limit.");
    } else if (active) {
      const property = parseContentLine(line);
      if (property) active.push(property);
    }
  }
  if (active) throw new SyntaxError("Unterminated VEVENT block.");

  const candidates = [];
  const references = new Set();
  const warnings = [];
  let skipped = 0;
  for (const properties of eventBlocks) {
    const built = buildCandidate(properties, calendarContext, defaultTimeZone);
    if (built.candidate && references.has(built.candidate.external_reference)) {
      skipped += 1;
      warnings.push({ external_reference: built.candidate.external_reference, warning: "duplicate_external_reference_in_feed" });
    } else if (built.candidate) {
      references.add(built.candidate.external_reference);
      candidates.push(built.candidate);
    } else skipped += 1;
    for (const warning of built.warnings) warnings.push({ external_reference: built.candidate?.external_reference ?? null, warning });
  }
  return { discovered: eventBlocks.length, candidates, skipped, warnings };
}

export function planGigSaladCandidateSync(parsedCandidates, existingCandidates = []) {
  const existingByReference = new Map(
    existingCandidates
      .filter((candidate) => candidate?.source === GIGSALAD_ICAL_SOURCE)
      .map((candidate) => [text(candidate.external_reference), candidate]),
  );
  const create = [];
  const warnings = [];
  let unchanged = 0;
  let preserved = 0;
  let skipped = 0;
  for (const candidate of parsedCandidates) {
    const existing = existingByReference.get(candidate.external_reference);
    if (!existing) {
      create.push(candidate);
      continue;
    }
    const changed = !sameProposal(existing.proposed_data, candidate.proposed_data);
    const status = text(existing.review_status);
    if (!changed) {
      unchanged += 1;
      continue;
    }
    if (REFRESHABLE_STATUSES.has(status)) {
      preserved += 1;
      warnings.push({ external_reference: candidate.external_reference, warning: "source_changed_refresh_requires_approved_write_contract" });
      continue;
    }
    if (REVIEWED_STATUSES.has(status)) {
      preserved += 1;
      warnings.push({ external_reference: candidate.external_reference, warning: "reviewed_candidate_preserved_after_source_change" });
      continue;
    }
    skipped += 1;
    warnings.push({ external_reference: candidate.external_reference, warning: "candidate_status_not_syncable" });
  }
  return {
    discovered: parsedCandidates.length,
    new: create.length,
    refreshed: 0,
    unchanged,
    preserved,
    skipped,
    warning_count: warnings.length,
    create,
    warnings,
  };
}
