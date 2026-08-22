export const BUILDER_LEAD_NOTIFICATION_TYPE = "builder_lead_internal_email";
export const BUILDER_SUBMISSION_EVENT_TYPE = "builder.submission_received";
export const DEFAULT_NOTIFICATION_RECIPIENT = "firstfamdjs@gmail.com";
export const DEFAULT_TEMPORARY_SENDER = "EVENTSible Leads <thepartys@updates.eventsible.info>";
export const DEFAULT_ADMIN_LEADS_URL = "https://build.eventsible.info/admin";

const SECRET_PATTERN = /service[_-]?role|api[_-]?key|password|token|jwt|authorization|secret|host[_-]?pin/i;
const RAW_JSON_PATTERN = /raw_payload|full contact record|outbox payload|^\s*[{[]/i;

export function createNotificationKey(builderSubmissionId) {
  if (!builderSubmissionId) throw new Error("builder_submission_id is required for notification idempotency.");
  return `builder-lead-email:${builderSubmissionId}`;
}

export function resolveNotificationConfig(env = process.env) {
  const dryRun =
    env.EVENTSIBLE_LEAD_NOTIFICATION_DRY_RUN === "true" ||
    (!env.RESEND_API_KEY && env.VERCEL_ENV !== "production");

  return {
    recipient: env.EVENTSIBLE_LEAD_NOTIFICATION_TO || DEFAULT_NOTIFICATION_RECIPIENT,
    from: env.EVENTSIBLE_LEAD_NOTIFICATION_FROM || DEFAULT_TEMPORARY_SENDER,
    adminUrl: env.EVENTSIBLE_ADMIN_LEADS_URL || DEFAULT_ADMIN_LEADS_URL,
    maxAttempts: Number.parseInt(env.EVENTSIBLE_LEAD_NOTIFICATION_MAX_ATTEMPTS || "5", 10),
    dryRun,
    resendApiKey: env.RESEND_API_KEY,
  };
}

export function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function formatCurrencyFromCents(cents) {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function coalesce(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function centsFromValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

const QUOTE_AMOUNT_ALIASES = {
  subtotal_cents: ["subtotal"],
  package_savings_cents: ["package_savings", "discount_amount"],
  travel_cents: ["travel", "travel_amount"],
  total_cents: ["total", "total_amount"],
};

function quoteCents(quoteVersion, outboxPayload, name) {
  if (Number.isFinite(outboxPayload?.[name])) return outboxPayload[name];
  if (Number.isFinite(quoteVersion?.[name])) return quoteVersion[name];

  for (const alias of QUOTE_AMOUNT_ALIASES[name] ?? [name.replace("_cents", "")]) {
    if (quoteVersion?.[alias] !== undefined && quoteVersion?.[alias] !== null) {
      return centsFromValue(quoteVersion[alias]);
    }
  }

  return 0;
}

function serviceLabel(item, customQuoteCodes = new Set()) {
  const label = coalesce(item.service_name, item.name, item.label, item.service_code, item.code, "Custom service");
  const serviceCode = coalesce(item.service_code, item.code, item.id);
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const customQuote = item.custom_quote || metadata.custom_quote || customQuoteCodes.has(serviceCode);
  return customQuote ? `${label} (Custom Quote)` : label;
}

export function buildBuilderLeadEmail({ chain, outboxEvent, config = resolveNotificationConfig() }) {
  const normalized = chain?.submission?.normalized_payload ?? {};
  const contactPayload = normalized.contact ?? {};
  const pricing = normalized.pricing ?? {};
  const venue = normalized.venue ?? {};
  const outboxPayload = outboxEvent?.payload ?? {};
  const contact = chain?.contact ?? {};
  const event = chain?.event ?? {};
  const lead = chain?.lead ?? {};
  const quoteVersion = chain?.quoteVersion ?? {};
  const quoteItems = asArray(chain?.quoteItems);

  const clientName = coalesce(contact.display_name, contactPayload.name, normalized.client_name, "Unnamed lead");
  const clientEmail = coalesce(contact.primary_email, contactPayload.email);
  const clientPhone = coalesce(contact.primary_phone, contactPayload.phone);
  const eventType = coalesce(event.event_type, normalized.event_type, "Event");
  const eventDate = coalesce(normalized.event_date, normalized.date, event.starts_at?.slice?.(0, 10), "Date TBD");
  const dateConfidence = coalesce(normalized.date_confidence, outboxPayload.date_confidence, "not specified");
  const startTime = coalesce(normalized.start_time, normalized.starts_at, event.starts_at, "");
  const endTime = coalesce(normalized.end_time, normalized.ends_at, event.ends_at, "");
  const duration = coalesce(normalized.service_length, normalized.duration_hours, "");
  const city = coalesce(venue.city, event.venue_city, normalized.city, "");
  const state = coalesce(venue.state, event.venue_state, normalized.state, "");
  const planningStage = coalesce(normalized.planning_stage, outboxPayload.planning_stage, lead.status, "Not specified");
  const packageTier = coalesce(normalized.recommended_package?.tier, outboxPayload.selected_package_tier, "Not selected");
  const subtotalCents = quoteCents(quoteVersion, outboxPayload, "subtotal_cents") || centsFromValue(pricing.subtotal);
  const packageSavingsCents = quoteCents(quoteVersion, outboxPayload, "package_savings_cents") || centsFromValue(pricing.package_savings);
  const travelCents = quoteCents(quoteVersion, outboxPayload, "travel_cents") || centsFromValue(pricing.travel_fee);
  const totalCents = quoteCents(quoteVersion, outboxPayload, "total_cents") || centsFromValue(pricing.estimated_total);
  const customQuoteCodes = new Set(asArray(outboxPayload.custom_quote_service_codes).map(String));
  const selectedServices = quoteItems.length
    ? quoteItems.map((item) => serviceLabel(item, customQuoteCodes))
    : asArray(normalized.selected_services).map((item) => serviceLabel(item, customQuoteCodes));
  const customQuoteItems = selectedServices.filter((label) => /custom quote/i.test(label));
  const preferredContact = coalesce(contact.preferred_channel, contactPayload.preferred_contact_method, "Not specified");
  const bestContactTime = coalesce(contactPayload.best_contact_time, normalized.best_contact_time, "Not specified");
  const sourceLabel = coalesce(outboxEvent?.source_application, chain?.submission?.submitted_from, "eventsible-event-builder");

  const subject = `New EVENTSible Lead: ${eventType} - ${clientName} - ${eventDate || "Date TBD"}`;
  const replyTo = isValidEmail(clientEmail) ? clientEmail : undefined;
  const rows = [
    ["Client", clientName],
    ["Email", clientEmail || "Not provided"],
    ["Phone", clientPhone || "Not provided"],
    ["Preferred contact", preferredContact],
    ["Best contact time", bestContactTime],
    ["Event type", eventType],
    ["Event date", `${eventDate || "Date TBD"} (${dateConfidence})`],
    ["Time", startTime && endTime ? `${startTime} to ${endTime}` : duration ? `${duration} hours` : "Not specified"],
    ["Location", [city, state].filter(Boolean).join(", ") || "Not specified"],
    ["Planning stage", planningStage],
    ["Selected services", selectedServices.join(", ") || "Not specified"],
    ["Recommended package", packageTier],
    ["Subtotal", formatCurrencyFromCents(subtotalCents)],
    ["Package savings", `-${formatCurrencyFromCents(packageSavingsCents)}`],
    ["Travel", formatCurrencyFromCents(travelCents)],
    ["Final estimate", formatCurrencyFromCents(totalCents)],
    ["Custom Quote items", customQuoteItems.join(", ") || "None"],
    ["Lead source", sourceLabel],
  ];

  const text = [
    subject,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Open Admin Leads: ${config.adminUrl}`,
  ].join("\n");

  const htmlRows = rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6f2ea;color:#1b1b1b;font-family:Arial,sans-serif;">
    <main style="max-width:680px;margin:0 auto;padding:24px;">
      <h1 style="font-size:24px;margin:0 0 8px;">New EVENTSible Lead</h1>
      <p style="margin:0 0 20px;">${escapeHtml(eventType)} request from ${escapeHtml(clientName)}</p>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #ddd;">
        ${htmlRows}
      </table>
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(config.adminUrl)}" style="color:#0f766e;font-weight:bold;">Open protected Admin Leads</a>
      </p>
    </main>
  </body>
</html>`;

  assertSafeEmailOutput({ subject, text, html });

  return {
    to: config.recipient,
    from: config.from,
    replyTo,
    subject,
    text,
    html,
  };
}

export function assertSafeEmailOutput(email) {
  for (const [key, value] of Object.entries(email)) {
    if (key === "replyTo" || key === "to" || key === "from") continue;
    if (SECRET_PATTERN.test(String(value))) {
      throw new Error(`Unsafe secret-like content detected in email ${key}.`);
    }
    if (RAW_JSON_PATTERN.test(String(value))) {
      throw new Error(`Raw JSON-like content detected in email ${key}.`);
    }
  }
}

export function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown notification error");
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[REDACTED]")
    .slice(0, 500);
}

export function nextRetryAt(attemptCount, now = new Date()) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1) * 5);
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

export async function sendWithResend(email, config = resolveNotificationConfig()) {
  if (config.dryRun) {
    return { id: `dry-run:${Date.now()}`, dryRun: true };
  }
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is required when notification dry-run is disabled.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: email.from,
      to: [email.to],
      reply_to: email.replyTo ? [email.replyTo] : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend send failed with status ${response.status}: ${body?.message || body?.error || "safe provider error"}`);
  }
  return { id: body?.id || body?.message_id || "resend-accepted", dryRun: false };
}

export async function processBuilderLeadOutboxEvent({
  outboxEvent,
  chain,
  existingDelivery,
  recordDelivery,
  sendEmail = sendWithResend,
  config = resolveNotificationConfig(),
  now = new Date(),
}) {
  const builderSubmissionId = outboxEvent?.related_record_ids?.builder_submission_id;
  const notificationKey = createNotificationKey(builderSubmissionId);

  if (existingDelivery?.status === "sent" || existingDelivery?.status === "dry_run") {
    return { status: "skipped", notificationKey, sent: false };
  }

  const nextAttempt = Number(existingDelivery?.attempt_count || 0) + 1;
  const maxAttempts = Number(existingDelivery?.max_attempts || config.maxAttempts || 5);
  const email = buildBuilderLeadEmail({ chain, outboxEvent, config });

  try {
    const providerResult = await sendEmail(email, config);
    const status = providerResult.dryRun ? "dry_run" : "sent";
    await recordDelivery({
      notification_key: notificationKey,
      notification_type: BUILDER_LEAD_NOTIFICATION_TYPE,
      source_event_id: outboxEvent.id,
      builder_submission_id: builderSubmissionId,
      recipient_email: config.recipient,
      provider: providerResult.dryRun ? "resend-dry-run" : "resend",
      provider_message_id: providerResult.id,
      status,
      attempt_count: nextAttempt,
      max_attempts: maxAttempts,
      last_safe_error: null,
      next_attempt_at: null,
      sent_at: now.toISOString(),
    });
    return { status, notificationKey, sent: !providerResult.dryRun, email };
  } catch (error) {
    const finalFailure = nextAttempt >= maxAttempts;
    await recordDelivery({
      notification_key: notificationKey,
      notification_type: BUILDER_LEAD_NOTIFICATION_TYPE,
      source_event_id: outboxEvent.id,
      builder_submission_id: builderSubmissionId,
      recipient_email: config.recipient,
      provider: "resend",
      status: finalFailure ? "failed" : "retry",
      attempt_count: nextAttempt,
      max_attempts: maxAttempts,
      last_safe_error: safeErrorMessage(error),
      next_attempt_at: finalFailure ? null : nextRetryAt(nextAttempt, now),
      sent_at: null,
    });
    return { status: finalFailure ? "failed" : "retry", notificationKey, sent: false, error: safeErrorMessage(error) };
  }
}
