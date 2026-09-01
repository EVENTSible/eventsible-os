export const ACTIVE_LEAD_STATUSES = ["new", "qualifying", "quoted", "follow_up"];
export const BOOKED_STATUSES = ["pending", "pending_contract", "pending_deposit", "confirmed", "completed"];
export const MISSION_CONTROL_SELECTS = Object.freeze({
  leads: "id,event_id,contact_id,builder_submission_id,status,source,inquiry_summary,estimated_value,next_follow_up_at,created_at,metadata",
  quoteVersions: "id,lead_id,event_id,version_number,status,currency,subtotal,discount_amount,travel_amount,total_amount,deposit_amount,created_at,snapshot",
  builderSubmissions: "id,contact_id,normalized_payload,submitted_from,created_at",
});

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function coerceAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(amount) ? amount : null;
}

/**
 * @param {unknown} value
 * @param {string} [currency]
 */
export function formatMoney(value, currency = "USD") {
  const amount = coerceAmount(value);
  if (amount === null) return "Custom quote";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * @param {unknown} status
 */
export function isActiveLeadStatus(status) {
  return ACTIVE_LEAD_STATUSES.includes(String(status ?? ""));
}

/**
 * @param {unknown} status
 */
export function isBookedStatus(status) {
  return BOOKED_STATUSES.includes(String(status ?? ""));
}

function meaningful(value) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value.trim() || null : value;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstValue(...values) {
  return values.map(meaningful).find((value) => value !== null) ?? null;
}

function humanNote(value) {
  return typeof value === "string" && value.trim() && !/^\s*(?:\[CRM\]\s*)?[{[]/i.test(value) ? value.trim() : null;
}

/**
 * Keeps ordinary prose intact while ensuring a structured Builder CRM envelope
 * is never rendered as a note. Only allow-listed human note fields are used.
 * @param {unknown} value
 * @returns {string | null}
 */
export function humanizeInquirySummary(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const crmPrefixed = /^\[CRM\]\s*/i.test(trimmed);
  const candidate = trimmed.replace(/^\[CRM\]\s*/i, "").trim();
  if (!crmPrefixed && !/^[{[]/.test(candidate)) return trimmed;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return crmPrefixed ? null : trimmed;
  }

  const envelope = objectValue(parsed);
  const lead = objectValue(envelope.lead);
  const crm = objectValue(envelope.crm);
  const notes = [humanNote(lead.notes), humanNote(crm.notes), humanNote(envelope.notes), humanNote(envelope.additional_notes), humanNote(envelope.additionalNotes)].filter(Boolean);
  if (crmPrefixed || envelope.crm || envelope.lead || envelope.services || envelope.eventType) {
    return [...new Set(notes)].join(" · ") || null;
  }
  return trimmed;
}

/**
 * Builds the staff-facing lead view from canonical OS records and the normalized
 * Builder contract. Raw payloads are deliberately excluded.
 */
export function buildLeadSummary({ lead = {}, event = {}, contact = {}, submission = {}, quote = {}, quoteItems = /** @type {Array<Record<string, unknown>>} */ ([]) } = {}) {
  const normalized = objectValue(submission.normalized_payload);
  const normalizedContact = objectValue(normalized.contact);
  const normalizedEvent = objectValue(normalized.event);
  const venue = objectValue(normalized.venue);
  const pricing = objectValue(normalized.pricing);
  const recommendedPackage = objectValue(normalized.recommended_package);
  const services = quoteItems.length ? quoteItems : (Array.isArray(normalized.selected_services) ? normalized.selected_services : []);
  const serviceNames = services
    .map((service) => firstValue(service?.service_name, service?.name, service?.label, service?.service_code, service?.code))
    .filter(Boolean);
  const location = [
    firstValue(event.venue_name, venue.name),
    [firstValue(event.venue_city, venue.city), firstValue(event.venue_state, venue.state)].filter(Boolean).join(", ") || null,
  ].filter(Boolean).join(" · ") || null;

  return {
    clientName: firstValue(contact.display_name, normalizedContact.name, normalized.client_name),
    email: firstValue(contact.primary_email, normalizedContact.email),
    phone: firstValue(contact.primary_phone, normalizedContact.phone),
    preferredContact: firstValue(contact.preferred_channel, normalizedContact.preferred_contact_method, normalized.preferred_contact_method),
    eventType: firstValue(event.event_type, normalized.event_type, normalizedEvent.type),
    eventDate: firstValue(event.starts_at, normalized.event_date, normalized.date, normalizedEvent.date),
    timeframe: firstValue(normalized.timeframe, normalized.start_time, normalizedEvent.start_time, normalized.service_length ? `${normalized.service_length} hours` : null),
    location,
    guestCount: firstValue(event.guest_count, normalized.guest_count, normalizedEvent.guest_count),
    services: serviceNames,
    packageName: firstValue(recommendedPackage.name, recommendedPackage.tier, normalized.package_name),
    subtotal: firstValue(quote.subtotal, pricing.subtotal),
    savings: firstValue(quote.discount_amount, pricing.package_savings),
    travel: firstValue(quote.travel_amount, pricing.travel_fee),
    total: firstValue(quote.total_amount, pricing.estimated_total, lead.estimated_value),
    priorities: firstValue(normalized.planning_priorities, normalized.priorities, normalized.planning_stage),
    notes: firstValue(humanizeInquirySummary(lead.inquiry_summary), humanNote(normalized.notes), humanNote(normalized.additional_notes)),
    leadStatus: firstValue(lead.status, "new"),
    quoteStatus: firstValue(quote.status),
  };
}

export function nextLeadAction(summary = {}) {
  if (!summary.quoteStatus) return "Review lead and prepare a quote";
  if (summary.quoteStatus === "draft") return "Review and approve the draft quote";
  if (["ready", "approved"].includes(String(summary.quoteStatus))) return "Convert approved quote to a gig";
  if (["accepted", "converted"].includes(String(summary.quoteStatus)) || summary.leadStatus === "won") return "Open the booked Gig Workspace";
  return "Review lead status and follow-up";
}

/**
 * @param {Array<Record<string, unknown>>} quoteVersions
 * @returns {Map<string, Record<string, unknown>>}
 */
export function latestQuoteByLead(quoteVersions = []) {
  const byLead = new Map();
  for (const quote of quoteVersions) {
    const leadId = quote?.lead_id;
    if (!leadId) continue;
    const current = byLead.get(leadId);
    const quoteTime = Date.parse(quote.created_at ?? "") || 0;
    const currentTime = Date.parse(current?.created_at ?? "") || 0;
    const quoteVersion = Number(quote.version_number ?? 0);
    const currentVersion = Number(current?.version_number ?? 0);
    if (!current || quoteVersion > currentVersion || (quoteVersion === currentVersion && quoteTime > currentTime)) {
      byLead.set(leadId, quote);
    }
  }
  return byLead;
}

/**
 * @param {{
 *   quote: Record<string, unknown>,
 *   existingBooking?: Record<string, unknown> | null,
 *   now?: string
 * }} input
 */
export function buildBookingPayload({ quote, existingBooking, now = new Date().toISOString() }) {
  const total = coerceAmount(quote?.total_amount);
  const deposit = coerceAmount(quote?.deposit_amount);
  const balance = total === null ? null : Math.max(total - (deposit ?? 0), 0);
  const metadata = {
    ...(existingBooking?.metadata && typeof existingBooking.metadata === "object" ? existingBooking.metadata : {}),
    source: "mission_control_convert_to_gig",
    quote_version_id: quote?.id ?? null,
    lead_id: quote?.lead_id ?? null,
    converted_at: now,
  };

  return {
    event_id: quote?.event_id,
    status: "confirmed",
    booked_at: existingBooking?.booked_at ?? now,
    contract_status: existingBooking?.contract_status ?? "not_sent",
    payment_status: existingBooking?.payment_status ?? (deposit ? "deposit_due" : "unpaid"),
    total_amount: total,
    deposit_amount: deposit,
    balance_due: balance,
    metadata,
  };
}

/**
 * @param {{
 *   bookingId: string,
 *   quoteVersionId: string,
 *   event?: Record<string, unknown> | null,
 *   quoteItems?: Array<Record<string, unknown>>
 * }} input
 */
export function bookingServicesFromQuoteItems({ bookingId, quoteVersionId, event, quoteItems = [] }) {
  return quoteItems
    .filter((item) => item && (item.service_name || item.service_code || item.service_id))
    .map((item) => ({
      booking_id: bookingId,
      service_id: item.service_id ?? null,
      service_code: item.service_code ?? item.service_id ?? "custom_service",
      service_name: item.service_name ?? item.service_code ?? "Custom service",
      status: "planning",
      starts_at: event?.starts_at ?? null,
      ends_at: event?.ends_at ?? null,
      configuration: {
        source: "mission_control_convert_to_gig",
        quote_version_id: quoteVersionId,
        quote_item_id: item.id ?? null,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        line_total: item.line_total ?? null,
      },
    }));
}
