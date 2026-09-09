import { createHash } from "node:crypto";

export const INTAKE_MANIFEST_VERSION = "intake_manifest_v1";
export const INTAKE_ITEM_TYPES = Object.freeze([
  "contact", "inquiry", "event", "staff_assignment", "payment_fact", "operational_note", "calendar_fact",
]);
export const CONTACT_STATUSES = Object.freeze(["active", "inactive", "archived"]);
export const EVENT_STATUSES = Object.freeze(["draft", "inquiry", "quoted", "pending", "booked", "planning", "ready", "active", "completed", "cancelled", "archived"]);
export const LEAD_STATUSES = Object.freeze(["new", "qualifying", "quoted", "follow_up", "won", "lost", "archived"]);

const ITEM_KEY = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function manifestHash(manifest) {
  return createHash("sha256").update(stable(manifest)).digest("hex");
}

export function validateIntakeManifest(input) {
  const errors = [];
  const manifest = object(input);
  if (!manifest || manifest.contractVersion !== INTAKE_MANIFEST_VERSION) errors.push("contractVersion must be intake_manifest_v1");
  if (!manifest || typeof manifest.sourceLabel !== "string" || !manifest.sourceLabel.trim() || manifest.sourceLabel.length > 120) errors.push("sourceLabel is required and limited to 120 characters");
  if (!manifest || !Array.isArray(manifest.items) || manifest.items.length < 1 || manifest.items.length > 250) errors.push("items must contain 1 to 250 candidates");
  const keys = new Set();
  for (const [index, raw] of (Array.isArray(manifest?.items) ? manifest.items : []).entries()) {
    const item = object(raw);
    if (!item) { errors.push(`items[${index}] must be an object`); continue; }
    if (!ITEM_KEY.test(String(item.key ?? ""))) errors.push(`items[${index}].key is invalid`);
    else if (keys.has(item.key)) errors.push(`items[${index}].key is duplicated`);
    else keys.add(item.key);
    if (!INTAKE_ITEM_TYPES.includes(item.type)) errors.push(`items[${index}].type is unsupported`);
    if (!object(item.data)) errors.push(`items[${index}].data must be an object`);
    if (!SHA256.test(String(item.sourceHash ?? ""))) errors.push(`items[${index}].sourceHash must be SHA-256`);
    if (item.sourceRef != null && (typeof item.sourceRef !== "string" || item.sourceRef.length > 240)) errors.push(`items[${index}].sourceRef is invalid`);
    if (item.uncertainFields != null && (!Array.isArray(item.uncertainFields) || item.uncertainFields.length > 30 || item.uncertainFields.some((field) => typeof field !== "string" || field.length > 80))) errors.push(`items[${index}].uncertainFields is invalid`);
    if (JSON.stringify(item.data ?? {}).length > 32768) errors.push(`items[${index}].data is too large`);
    for (const required of requiredFields(item?.type)) {
      if (item?.uncertainFields?.includes(required) || item?.data?.[required] == null || item.data[required] === "") errors.push(`items[${index}].${required} must be certain and supplied`);
    }
    const certain = (field) => item.data?.[field] != null && item.data[field] !== "" && !item.uncertainFields?.includes(field);
    if (item.type === "contact" && !certain("primaryEmail") && !certain("primaryPhone")) errors.push(`items[${index}] contact requires a certain email or phone`);
    if (item.type === "event" && !certain("primaryContactId") && !certain("primaryContactItemKey")) errors.push(`items[${index}] event requires a canonical contact or prior contact item key`);
    if (item.type === "inquiry" && ((!certain("contactId") && !certain("contactItemKey")) || (!certain("eventId") && !certain("eventItemKey")))) errors.push(`items[${index}] inquiry requires canonical or prior-item contact and event references`);
    if (item.type === "inquiry" && !LEAD_STATUSES.includes(item.data?.status)) errors.push(`items[${index}].status is unsupported`);
    if (item.type === "event" && item.data?.status != null && !EVENT_STATUSES.includes(item.data.status)) errors.push(`items[${index}].status is unsupported`);
    if (item.type === "staff_assignment" && !["dj", "mc", "vocalist", "assistant", "activity_helper", "operator", "other"].includes(item.data?.assignmentRole)) errors.push(`items[${index}].assignmentRole is unsupported`);
    if (item.type === "payment_fact" && !["unpaid", "deposit_due", "deposit_paid", "partially_paid", "paid", "refunded"].includes(item.data?.paymentStatus)) errors.push(`items[${index}].paymentStatus is unsupported`);
    if (item.type === "calendar_fact" && !["available", "unavailable", "outside_booking", "vacation", "reminder", "note"].includes(item.data?.entryType)) errors.push(`items[${index}].entryType is unsupported`);
  }
  return { ok: errors.length === 0, errors, manifest: errors.length ? null : manifest, hash: errors.length ? null : manifestHash(manifest) };
}

function requiredFields(type) {
  return {
    contact: ["displayName"], inquiry: ["status"], event: ["title", "eventType"],
    staff_assignment: ["eventId", "teamMemberId", "assignmentRole"], payment_fact: ["bookingId", "paymentStatus"],
    operational_note: ["eventId", "body"], calendar_fact: ["teamMemberId", "entryType"],
  }[type] ?? [];
}

function normalizePhone(value) { return String(value ?? "").replace(/\D/g, ""); }
function normalizeText(value) { return String(value ?? "").trim().toLowerCase(); }

export function duplicateWarnings(candidate, records) {
  const warnings = [];
  const data = candidate?.data ?? {};
  if (candidate?.type === "contact") {
    const email = normalizeText(data.primaryEmail);
    const phone = normalizePhone(data.primaryPhone);
    for (const row of records.contacts ?? []) {
      if (email && normalizeText(row.primaryEmail) === email) warnings.push({ kind: "exact_email", recordId: row.id });
      if (phone && normalizePhone(row.primaryPhone) === phone) warnings.push({ kind: "exact_phone", recordId: row.id });
    }
  }
  if (candidate?.type === "event") {
    for (const row of records.events ?? []) {
      if (data.sourceId && row.sourceId === data.sourceId) warnings.push({ kind: "exact_source_id", recordId: row.id });
      else if (normalizeText(data.title) && normalizeText(row.title) === normalizeText(data.title) && data.startsAt && row.startsAt === data.startsAt) warnings.push({ kind: "same_title_and_start", recordId: row.id });
    }
  }
  return warnings;
}
