export const WEDDING_HERO_PHONE_DISPLAY = "+1 (574) 274-5213";
export const WEDDING_HERO_PHONE_TEL = "tel:+15742745213";
export const WEDDING_HERO_PHONE_SMS = "sms:+15742745213";
export const DEFAULT_WEDDING_HERO_SUPPORT_EMAIL = "firstfamdjs@gmail.com";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_CHANNELS = new Set(["email", "text", "call"]);
const PLANNER_MODES = new Set(["homepage", "guided", "form", "print"]);
const CONTACT_SOURCES = new Set(["weddinghero_homepage", "public_planner", "private_plan"]);

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value ?? "").trim().replace(/\r\n?/g, "\n").slice(0, maxLength);
}

export function isWeddingHeroEmail(value) {
  return EMAIL_PATTERN.test(cleanText(value, 254));
}

export function isWeddingHeroPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function validateWeddingHeroContactRequest(input = {}) {
  const honeypot = cleanText(input.company, 160);
  if (honeypot) return { ok: false, blocked: true, message: "Your request could not be accepted." };

  const name = cleanText(input.name, 120);
  const email = cleanText(input.email, 254).toLowerCase();
  const phone = cleanText(input.phone, 40);
  const preferredChannel = CONTACT_CHANNELS.has(input.preferredChannel) ? input.preferredChannel : "call";
  const bestTime = cleanText(input.bestTime, 160);
  const notes = cleanMultiline(input.notes, 1200);
  const coupleNames = cleanText(input.coupleNames, 180);
  const eventDate = cleanText(input.eventDate, 40);
  const rawEventId = cleanText(input.eventId, 80);
  const rawAssignmentId = cleanText(input.assignmentId, 80);
  const eventId = UUID_PATTERN.test(rawEventId) ? rawEventId : null;
  const assignmentId = UUID_PATTERN.test(rawAssignmentId) ? rawAssignmentId : null;
  const progressValue = Number(input.progress);
  const progress = Number.isFinite(progressValue) ? Math.min(100, Math.max(0, Math.round(progressValue))) : 0;
  const mode = PLANNER_MODES.has(input.mode) ? input.mode : "homepage";
  const source = CONTACT_SOURCES.has(input.source) ? input.source : "weddinghero_homepage";
  const errors = {};

  if (name.length < 2) errors.name = "Enter the best name for us to use.";
  if (email && !isWeddingHeroEmail(email)) errors.email = "Enter a valid email address.";
  if (phone && !isWeddingHeroPhone(phone)) errors.phone = "Enter a valid phone number.";
  if (!email && !phone) errors.contact = "Add an email address or phone number.";
  if (preferredChannel === "email" && !email) errors.email = "Add an email address for an email reply.";
  if ((preferredChannel === "text" || preferredChannel === "call") && !phone) errors.phone = `Add a phone number for a ${preferredChannel}.`;
  if ((rawEventId && !eventId) || (rawAssignmentId && !assignmentId) || Boolean(eventId) !== Boolean(assignmentId)) {
    errors.plan = "The private Wedding Hero plan connection was incomplete.";
  }

  if (Object.keys(errors).length) {
    return { ok: false, blocked: false, message: Object.values(errors)[0], errors };
  }

  return {
    ok: true,
    data: {
      name,
      email: email || null,
      phone: phone || null,
      preferredChannel,
      bestTime: bestTime || null,
      notes: notes || null,
      coupleNames: coupleNames || null,
      eventDate: eventDate || null,
      progress,
      mode,
      source,
      eventId,
      assignmentId,
    },
  };
}
