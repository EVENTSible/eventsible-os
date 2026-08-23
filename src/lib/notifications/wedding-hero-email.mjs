import {
  assertSafeEmailOutput,
  isValidEmail,
  sendWithResend,
} from "./builder-lead-email.mjs";
import { DEFAULT_WEDDING_HERO_SUPPORT_EMAIL } from "../wedding-hero-contact.mjs";

export const WEDDING_HERO_CALLBACK_NOTIFICATION = "wedding_hero_callback_request";
export const WEDDING_HERO_SUBMITTED_NOTIFICATION = "wedding_hero_submitted";
export const DEFAULT_WEDDING_HERO_SENDER = "EVENTSible Wedding Hero <thepartys@updates.eventsible.info>";
export const DEFAULT_WEDDING_HERO_SITE_URL = "https://eventsible.biz";

function configuredEmail(value, fallback) {
  const email = String(value ?? "").trim().toLowerCase();
  return isValidEmail(email) ? email : fallback;
}

function siteUrl(env) {
  const configured = String(env.WEDDING_HERO_SITE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (env.VERCEL_ENV === "production") {
    return String(env.NEXT_PUBLIC_SITE_URL || DEFAULT_WEDDING_HERO_SITE_URL).trim().replace(/\/$/, "");
  }
  if (env.VERCEL_URL) return `https://${String(env.VERCEL_URL).replace(/\/$/, "")}`;
  return String(env.NEXT_PUBLIC_SITE_URL || DEFAULT_WEDDING_HERO_SITE_URL).trim().replace(/\/$/, "");
}

export function resolveWeddingHeroNotificationConfig(env = process.env) {
  const configuredRecipient = env.WEDDING_HERO_NOTIFY_EMAIL || env.EVENTSIBLE_LEAD_NOTIFICATION_TO;
  const recipient = configuredEmail(
    configuredRecipient,
    DEFAULT_WEDDING_HERO_SUPPORT_EMAIL,
  );
  const supportEmail = configuredEmail(env.WEDDING_HERO_SUPPORT_EMAIL, recipient);
  return {
    recipient,
    supportEmail,
    from: String(env.WEDDING_HERO_NOTIFICATION_FROM || env.EVENTSIBLE_LEAD_NOTIFICATION_FROM || DEFAULT_WEDDING_HERO_SENDER).trim(),
    siteUrl: siteUrl(env),
    resendApiKey: env.RESEND_API_KEY,
    dryRun: env.WEDDING_HERO_NOTIFICATION_DRY_RUN === "true" || !env.RESEND_API_KEY || !isValidEmail(configuredRecipient),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function display(value, fallback = "Not provided") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

export function buildWeddingHeroOwnerNotification({ kind, context = {}, request = {}, requestId, createdAt, config = resolveWeddingHeroNotificationConfig() }) {
  const callback = kind === WEDDING_HERO_CALLBACK_NOTIFICATION;
  const coupleNames = display(context.coupleNames, "Wedding Hero couple");
  const eventDate = display(context.eventDate, "Date not entered");
  const progress = `${Number.isFinite(context.progress) ? context.progress : 0}%`;
  const eventId = context.eventId || null;
  const adminUrl = eventId ? `${config.siteUrl}/admin/wedding/${eventId}` : null;
  const privatePlanUrl = eventId && context.privatePlanAvailable !== false ? `${config.siteUrl}/client/wedding/${eventId}` : null;
  const subject = callback
    ? `Wedding Hero callback request: ${coupleNames}`
    : `Wedding Hero submitted: ${coupleNames} - ${progress}`;
  const rows = [
    ["Couple", coupleNames],
    ["Wedding date", eventDate],
    ["Progress", progress],
    ["Mode", display(context.mode, "Not provided")],
    ["Source", display(context.source, "Wedding Hero")],
    ["Contact name", display(request.name || context.contactName)],
    ["Email", display(request.email || context.email)],
    ["Phone", display(request.phone || context.phone)],
  ];

  if (callback) {
    rows.push(
      ["Preferred reply", display(request.preferredChannel)],
      ["Best time", display(request.bestTime)],
      ["Request notes", display(request.notes)],
      ["Request ID", display(requestId)],
    );
  } else {
    rows.push(
      ["Missing critical fields", Array.isArray(context.missingCritical) && context.missingCritical.length ? context.missingCritical.join(", ") : "None identified"],
      ["Ceremony summary", display(context.ceremonySummary)],
      ["Reception summary", display(context.receptionSummary)],
      ["Timeline", display(context.timelineSummary)],
      ["Music summary", display(context.musicSummary)],
      ["Services", display(context.serviceSummary)],
    );
  }
  if (adminUrl) rows.push(["Admin plan", adminUrl]);
  if (privatePlanUrl) rows.push(["Private plan", privatePlanUrl]);
  rows.push([callback ? "Requested" : "Submitted", display(createdAt)]);

  const text = [
    subject,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlRows = rows.map(([label, value]) => `<tr><th style="padding:8px;text-align:left;border-bottom:1px solid #e3e8eb;">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e3e8eb;">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f8;color:#17324d;font-family:Arial,sans-serif;"><main style="max-width:680px;margin:0 auto;padding:24px;"><h1 style="font-size:24px;margin:0 0 8px;">${callback ? "Wedding Hero callback request" : "Wedding Hero submitted"}</h1><p style="margin:0 0 20px;">${escapeHtml(coupleNames)}</p><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #dbe3e7;">${htmlRows}</table></main></body></html>`;
  const replyTo = isValidEmail(request.email || context.email) ? request.email || context.email : undefined;
  const email = {
    to: config.recipient,
    from: config.from,
    replyTo,
    subject,
    text,
    html,
    idempotencyKey: `${kind}:${requestId || context.assignmentId || createdAt}`,
  };
  assertSafeEmailOutput(email);
  return email;
}

export async function sendWeddingHeroOwnerNotification(input, config = resolveWeddingHeroNotificationConfig()) {
  const email = buildWeddingHeroOwnerNotification({ ...input, config });
  const result = await sendWithResend(email, config);
  return { ...result, email };
}
