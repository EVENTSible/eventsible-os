export const ACTIVE_LEAD_STATUSES = ["new", "qualifying", "quoted", "follow_up"];
export const BOOKED_STATUSES = ["pending", "pending_contract", "pending_deposit", "confirmed", "completed"];

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
