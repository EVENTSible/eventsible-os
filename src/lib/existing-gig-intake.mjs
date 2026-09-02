export const EXISTING_GIG_CANDIDATE_VERSION = "existing_gig_candidate_v1";
export const EXISTING_GIG_PAYLOAD_LIMIT = 65_536;
export const EXISTING_GIG_NOTES_LIMIT = 2_000;
export const EXISTING_GIG_SERVICE_LIMIT = 20;
export const EXISTING_GIG_REVIEW_STATUSES = Object.freeze(["pending", "review_later", "ignored", "matched", "imported"]);
export const EXISTING_GIG_TIME_ZONES = Object.freeze([
  "America/Indiana/Indianapolis",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
]);

function text(value) {
  return String(value ?? "").trim();
}

function bounded(value, maximum) {
  const normalized = text(value);
  return normalized && normalized.length <= maximum ? normalized : null;
}

function localParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const result = {};
  for (const part of parts) if (part.type !== "literal") result[part.type] = part.value;
  return result;
}

export function eventLocalDateTimeToIso(dateValue, timeValue, timeZone) {
  const date = text(dateValue);
  const time = text(timeValue);
  const zone = text(timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !zone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    let guess = wanted;
    for (let pass = 0; pass < 4; pass += 1) {
      const observed = localParts(new Date(guess), zone);
      const observedUtc = Date.UTC(Number(observed.year), Number(observed.month) - 1, Number(observed.day), Number(observed.hour), Number(observed.minute));
      guess += wanted - observedUtc;
    }
    const resolved = localParts(new Date(guess), zone);
    if (`${resolved.year}-${resolved.month}-${resolved.day}` !== date || `${resolved.hour}:${resolved.minute}` !== time) return null;
    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}

function dateKey(value, timeZone) {
  if (!value) return null;
  try {
    const parts = localParts(new Date(String(value)), timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return null;
  }
}

function sameInstant(left, right) {
  const leftTime = Date.parse(String(left ?? ""));
  const rightTime = Date.parse(String(right ?? ""));
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

export function buildExistingGigMatchEvidence(proposal, existingEvents = []) {
  const warnings = [];
  const conflicts = [];
  const event = proposal.event;
  const contact = proposal.contact;
  const proposalDate = dateKey(event.starts_at, event.timezone);
  for (const existing of existingEvents) {
    const existingId = text(existing.event_id ?? existing.id);
    if (!existingId) continue;
    const existingDate = dateKey(existing.starts_at, text(existing.timezone) || event.timezone);
    const sameStart = sameInstant(existing.starts_at, event.starts_at);
    const sameSelectedContact = contact.mode === "reuse" && text(existing.primary_contact_id) === contact.contact_id;
    const sameEmail = contact.primary_email && text(existing.primary_email).toLowerCase() === contact.primary_email.toLowerCase();
    const sameTitle = text(existing.title).toLowerCase() === event.title.toLowerCase();
    const sameVenue = Boolean(event.venue_name) && text(existing.venue_name).toLowerCase() === event.venue_name.toLowerCase();
    const match = {
      event_id: existingId,
      title: text(existing.title) || "Untitled event",
      starts_at: existing.starts_at ?? null,
      reason: "",
    };
    if (sameSelectedContact && sameStart) match.reason = "Selected contact and start time match an existing event.";
    else if (sameEmail && sameStart) match.reason = "Contact email and start time match an existing event.";
    else if (sameTitle && sameStart && sameVenue) match.reason = "Title, start time, and venue match an existing event.";
    if (match.reason) warnings.push(match);
    if (proposalDate && proposalDate === existingDate && ["booked", "planning", "ready", "active", "completed"].includes(text(existing.event_status ?? existing.status).toLowerCase())) {
      conflicts.push({ event_id: existingId, title: match.title, starts_at: existing.starts_at ?? null });
    }
  }
  return { match_warnings: warnings, date_conflicts: conflicts };
}

export function buildManualExistingGigProposal(input, existingEvents = []) {
  const errors = {};
  const title = bounded(input.event_title, 180);
  const eventType = bounded(input.event_type, 80);
  const timezone = EXISTING_GIG_TIME_ZONES.includes(text(input.timezone)) ? text(input.timezone) : null;
  const startsAt = timezone ? eventLocalDateTimeToIso(input.event_date, input.start_time, timezone) : null;
  const endsAt = text(input.end_time) && timezone ? eventLocalDateTimeToIso(input.event_date, input.end_time, timezone) : null;
  if (!title) errors.event_title = "Enter an event title up to 180 characters.";
  if (!eventType) errors.event_type = "Enter an event type up to 80 characters.";
  if (!timezone) errors.timezone = "Choose a supported event timezone.";
  if (!startsAt) errors.start_time = "Enter a valid event-local date and start time.";
  if (text(input.end_time) && !endsAt) errors.end_time = "Enter a valid event-local end time.";
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.end_time = "End time must be after the start time.";

  const contactMode = text(input.contact_mode);
  const contactId = text(input.contact_id);
  const displayName = bounded(input.contact_display_name, 160);
  const email = bounded(input.contact_email, 254);
  const phone = bounded(input.contact_phone, 40);
  if (contactMode === "reuse") {
    if (!/^[0-9a-f-]{36}$/i.test(contactId)) errors.contact_id = "Choose an existing canonical contact.";
  } else if (contactMode === "create") {
    if (!displayName) errors.contact_display_name = "Enter a new contact name up to 160 characters.";
    if (!email && !phone) errors.contact_email = "Enter an email or phone number for the new contact.";
  } else {
    errors.contact_mode = "Choose an existing contact or create a reviewed new contact.";
  }

  const serviceIds = [...new Set((input.service_ids ?? []).map(text).filter(Boolean))];
  if (!serviceIds.length || serviceIds.length > EXISTING_GIG_SERVICE_LIMIT || serviceIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    errors.service_ids = `Choose 1 to ${EXISTING_GIG_SERVICE_LIMIT} canonical services.`;
  }

  let bookedAmount = null;
  if (text(input.booked_amount)) {
    bookedAmount = Number(text(input.booked_amount));
    if (!Number.isFinite(bookedAmount) || bookedAmount < 0 || bookedAmount > 1_000_000) errors.booked_amount = "Enter a booked amount from 0 to 1,000,000.";
  }
  const notes = bounded(input.notes, EXISTING_GIG_NOTES_LIMIT);
  if (text(input.notes) && !notes) errors.notes = `Keep intake notes to ${EXISTING_GIG_NOTES_LIMIT.toLocaleString("en-US")} characters.`;
  const venueName = bounded(input.venue_name, 180);
  const address1 = bounded(input.venue_address_1, 200);
  const address2 = bounded(input.venue_address_2, 160);
  const city = bounded(input.venue_city, 120);
  const state = bounded(input.venue_state, 80);
  const postalCode = bounded(input.venue_postal_code, 24);

  if (Object.keys(errors).length) return { errors, proposal: null };

  const proposal = {
    event: {
      title,
      event_type: eventType,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone,
      venue_name: venueName,
      venue_address_1: address1,
      venue_address_2: address2,
      venue_city: city,
      venue_state: state,
      venue_postal_code: postalCode,
      venue_country: "US",
    },
    contact: contactMode === "reuse"
      ? { mode: "reuse", contact_id: contactId }
      : { mode: "create", display_name: displayName, primary_email: email, primary_phone: phone },
    service_ids: serviceIds,
    booked_amount: bookedAmount,
    notes,
    provenance: { summary: "Staff-entered existing booked gig." },
    missing_fields: [
      !endsAt ? "event.ends_at" : null,
      !venueName ? "venue.name" : null,
      bookedAmount === null ? "booking.total_amount" : null,
    ].filter(Boolean),
    match_warnings: [],
    date_conflicts: [],
  };
  Object.assign(proposal, buildExistingGigMatchEvidence(proposal, existingEvents));
  if (new TextEncoder().encode(JSON.stringify(proposal)).length > EXISTING_GIG_PAYLOAD_LIMIT) {
    return { errors: { form: "The reviewed proposal is too large to save safely." }, proposal: null };
  }
  return { errors: {}, proposal };
}

export function existingGigImportRpcError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  if (message.includes("authentication") || message.includes("staff access")) return "Your staff session is not authorized to import this candidate.";
  if (message.includes("only a pending")) return "Return this candidate to Pending before importing it.";
  if (message.includes("service")) return "One or more selected services are no longer valid. Nothing was imported.";
  if (message.includes("contact")) return "The selected contact could not be verified. Nothing was imported.";
  if (message.includes("template")) return "The canonical planning template is unavailable. Nothing was imported.";
  return "The reviewed gig could not be imported atomically. Nothing was created.";
}
