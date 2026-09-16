import { createHash } from "node:crypto";

export const INTAKE_MANIFEST_VERSION = "intake_manifest_v1";
export const COMPLETE_INTAKE_MANIFEST_VERSION = "intake_manifest_v2";
export const COMPLETE_INTAKE_SOURCE_BASELINE = "c9b2f167f8ea2ac2255e01ba52891a9e23df9f09646918cd8468cc1c22cff643";
export const COMPLETE_INTAKE_ITEM_TYPES = Object.freeze([
  "contact", "inquiry", "event", "booking", "booking_service", "payment_fact", "staff_assignment", "operational_note", "source_provenance",
]);
export const INTAKE_ITEM_TYPES = Object.freeze([
  "contact", "inquiry", "event", "staff_assignment", "payment_fact", "operational_note", "calendar_fact",
]);
export const CONTACT_STATUSES = Object.freeze(["active", "inactive", "archived"]);
export const EVENT_STATUSES = Object.freeze(["draft", "inquiry", "quoted", "pending", "booked", "planning", "ready", "active", "completed", "cancelled", "archived"]);
export const LEAD_STATUSES = Object.freeze(["new", "qualifying", "quoted", "follow_up", "won", "lost", "archived"]);
export const CONTACTLESS_OPERATIONAL_DISPOSITIONS = Object.freeze(["vendor_appearance", "operational_event"]);

const ITEM_KEY = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

export function manifestFileHash(raw) {
  return createHash("sha256").update(String(raw), "utf8").digest("hex");
}

export function completeItemCounts(items) {
  return Object.fromEntries(COMPLETE_INTAKE_ITEM_TYPES.map((type) => [type, items.filter((item) => item?.type === type).length]));
}

export function validateCompleteIntakeManifest(input, expectedFileHash = null) {
  const errors = [];
  const manifest = object(input);
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  if (!manifest || manifest.contractVersion !== COMPLETE_INTAKE_MANIFEST_VERSION) errors.push("contractVersion must be intake_manifest_v2");
  if (String(manifest?.sourceBaselineHash ?? "").toLowerCase() !== COMPLETE_INTAKE_SOURCE_BASELINE) errors.push("sourceBaselineHash must match the accepted preview v3 baseline");
  if (manifest?.recordCount !== 24) errors.push("recordCount must be exactly 24");
  if (!manifest || typeof manifest.sourceLabel !== "string" || !manifest.sourceLabel.trim() || manifest.sourceLabel.length > 120) errors.push("sourceLabel is required and limited to 120 characters");
  if (items.length < 1 || items.length > 250) errors.push("items must contain 1 to 250 candidates");
  const counts = completeItemCounts(items);
  if (!object(manifest?.itemCounts) || JSON.stringify(manifest.itemCounts) !== JSON.stringify(counts)) errors.push("itemCounts must exactly match every supported item type");
  if (counts.event !== 24) errors.push("the manifest must contain exactly 24 canonical event records");
  const keys = new Set();
  const byKey = new Map();
  for (const [index, item] of items.entries()) {
    if (!object(item)) { errors.push(`items[${index}] must be an object`); continue; }
    if (!ITEM_KEY.test(String(item.key ?? ""))) errors.push(`items[${index}].key is invalid`);
    else if (keys.has(item.key)) errors.push(`items[${index}].key is duplicated`);
    else { keys.add(item.key); byKey.set(item.key, item); }
    if (!COMPLETE_INTAKE_ITEM_TYPES.includes(item.type)) errors.push(`items[${index}].type is unsupported`);
    if (!object(item.data)) errors.push(`items[${index}].data must be an object`);
    if (!SHA256.test(String(item.sourceHash ?? ""))) errors.push(`items[${index}].sourceHash must be SHA-256`);
    if (item.sourceRef != null && (typeof item.sourceRef !== "string" || item.sourceRef.length > 240)) errors.push(`items[${index}].sourceRef is invalid`);
    if (item.uncertainFields != null && (!Array.isArray(item.uncertainFields) || item.uncertainFields.length > 30)) errors.push(`items[${index}].uncertainFields is invalid`);
    if (JSON.stringify(item.data ?? {}).length > 32768) errors.push(`items[${index}].data is too large`);
    const recordMode = item.data?.recordMode ?? "create";
    if (!["create", "link_existing"].includes(recordMode)) errors.push(`items[${index}].recordMode is unsupported`);
    if (recordMode === "link_existing") {
      if (!["contact", "event", "inquiry", "booking"].includes(item.type)) errors.push(`items[${index}] cannot link this item type to an existing record`);
      if (!UUID.test(String(item.data?.existingRecordId ?? ""))) errors.push(`items[${index}].existingRecordId must be UUID`);
      if (!SHA256.test(String(item.data?.expectedRecordHash ?? ""))) errors.push(`items[${index}].expectedRecordHash must be SHA-256`);
      if (item.data?.sourcePrecedence !== "preserve_existing_native") errors.push(`items[${index}].sourcePrecedence must preserve existing native data`);
    }
    for (const required of completeRequiredFields(item.type)) if (item?.uncertainFields?.includes(required) || item?.data?.[required] == null || item.data[required] === "") errors.push(`items[${index}].${required} must be certain and supplied`);
    if (item.type === "contact" && recordMode === "create" && !item.data?.primaryEmail && !item.data?.primaryPhone) errors.push(`items[${index}] contact requires email or phone`);
    if (item.type === "event" && !EVENT_STATUSES.filter((value) => value !== "archived").includes(item.data?.status)) errors.push(`items[${index}].status is unsupported`);
    if (item.type === "event" && !["confirmed", "lower_confidence_review", "pending_unbooked", ...CONTACTLESS_OPERATIONAL_DISPOSITIONS].includes(item.data?.recordDisposition)) errors.push(`items[${index}].recordDisposition is unsupported`);
    if (item.type === "event" && item.data?.recordDisposition === "lower_confidence_review" && item.data?.status !== "inquiry") errors.push(`items[${index}] lower-confidence records must remain inquiries`);
    if (item.type === "event" && item.data?.recordDisposition === "pending_unbooked" && item.data?.status !== "pending") errors.push(`items[${index}] pending-unbooked records must remain pending`);
    if (item.type === "event" && item.data?.historicalDate != null && item.data.historicalDate !== "") {
      const historicalDate = String(item.data.historicalDate);
      const parsedDate = new Date(`${historicalDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(historicalDate) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0,10) !== historicalDate) errors.push(`items[${index}].historicalDate must be an ISO calendar date`);
      if (item.data?.startsAt || item.data?.endsAt) errors.push(`items[${index}] date-only events cannot include start or end timestamps`);
    }
    if (item.type === "event" && isContactlessOperational(item)) {
      if (recordMode !== "create") errors.push(`items[${index}] contactless operational records must be newly created`);
      if (item.data?.primaryContactItemKey) errors.push(`items[${index}] contactless operational records cannot reference a client contact`);
      if (!["draft", "planning", "ready", "active", "completed", "cancelled"].includes(item.data?.status)) errors.push(`items[${index}] contactless operational status is unsupported`);
    } else if (item.type === "event" && !item.data?.primaryContactItemKey) {
      errors.push(`items[${index}] client events require a verified contact item`);
    }
    if (item.type === "booking" && !["pending", "pending_contract", "pending_deposit", "confirmed", "cancelled", "completed"].includes(item.data?.status)) errors.push(`items[${index}].status is unsupported`);
    if (item.type === "payment_fact" && !["cash", "check", "card", "bank_transfer", "gigsalad", "invoice", "other", "unknown"].includes(item.data?.paymentMethod)) errors.push(`items[${index}].paymentMethod is unsupported`);
    if (item.type === "payment_fact" && !["unpaid", "deposit_due", "deposit_paid", "partially_paid", "paid", "refunded"].includes(item.data?.paymentStatus)) errors.push(`items[${index}].paymentStatus is unsupported`);
    if (item.type === "payment_fact" && !["not_applicable", "pending", "paid", "refunded", "unknown"].includes(item.data?.payoutStatus)) errors.push(`items[${index}].payoutStatus is unsupported`);
    const amountKeys = ["contractedOrQuotedValue", "grossClientAmount", "depositAmount", "tipAmount", "overtimeAmount", "platformFeeAmount", "netPayoutAmount", "balanceDue"];
    const amounts = amountKeys.map((key) => item.data?.[key]).filter((value) => value != null && value !== "").map(Number);
    if (amounts.some((value) => !Number.isFinite(value) || value < 0)) errors.push(`items[${index}] financial amounts must be non-negative numbers`);
    if (item.type === "payment_fact") {
      const amount = (key) => item.data?.[key] == null || item.data[key] === "" ? null : Number(item.data[key]);
      const contract = amount("contractedOrQuotedValue"), gross = amount("grossClientAmount"), deposit = amount("depositAmount"), fee = amount("platformFeeAmount"), net = amount("netPayoutAmount");
      if (contract != null && deposit != null && deposit > contract) errors.push(`items[${index}] deposit cannot exceed the reviewed contract value`);
      if (gross != null && deposit != null && deposit > gross) errors.push(`items[${index}] deposit cannot exceed reviewed gross receipts`);
      if (gross != null && fee != null && net != null && Math.abs(gross - fee - net) > 0.01) errors.push(`items[${index}] gross less platform fee must equal net payout`);
    }
  }
  for (const [index, item] of items.entries()) {
    if (!object(item)) continue;
    for (const reference of completeReferences(item)) if (!byKey.has(reference)) errors.push(`items[${index}] references missing item ${reference}`);
    if (item.type === "booking") {
      const event = byKey.get(item.data?.eventItemKey);
      if (event?.type !== "event") errors.push(`items[${index}] booking must reference an event item`);
      if (["lower_confidence_review", "pending_unbooked", ...CONTACTLESS_OPERATIONAL_DISPOSITIONS].includes(event?.data?.recordDisposition)) errors.push(`items[${index}] cannot book a review-only, pending-unbooked, or contactless operational event`);
    }
    if (item.type === "inquiry") {
      const event = byKey.get(item.data?.eventItemKey);
      if (isContactlessOperational(event)) errors.push(`items[${index}] contactless operational events cannot create client inquiries`);
    }
  }
  if (expectedFileHash != null && !SHA256.test(String(expectedFileHash).toLowerCase())) errors.push("expected manifest file hash must be SHA-256");
  return { ok: errors.length === 0, errors, manifest: errors.length ? null : manifest, itemCounts: errors.length ? null : counts };
}

function completeReferences(item) {
  const data = item.data ?? {};
  return ({ event: isContactlessOperational(item) ? [] : [data.primaryContactItemKey], inquiry: [data.contactItemKey, data.eventItemKey], booking: [data.eventItemKey], booking_service: [data.bookingItemKey], payment_fact: [data.bookingItemKey], staff_assignment: [data.eventItemKey], operational_note: [data.eventItemKey], source_provenance: [data.targetItemKey] }[item.type] ?? []).filter(Boolean);
}

function isContactlessOperational(item) {
  return item?.type === "event" && CONTACTLESS_OPERATIONAL_DISPOSITIONS.includes(item.data?.recordDisposition);
}

function completeRequiredFields(type) {
  return {
    contact: ["displayName"], inquiry: ["contactItemKey", "eventItemKey", "status"], event: ["title", "eventType", "status", "recordDisposition"],
    booking: ["eventItemKey", "status", "contractStatus"], booking_service: ["bookingItemKey", "serviceCode", "serviceName", "status"],
    payment_fact: ["bookingItemKey", "paymentMethod", "paymentStatus", "payoutStatus"], staff_assignment: ["eventItemKey", "teamMemberId", "assignmentRole"],
    operational_note: ["eventItemKey", "body"], source_provenance: ["targetItemKey", "evidenceKind", "confidence"],
  }[type] ?? [];
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
      else if (normalizeText(data.title) && normalizeText(row.title) === normalizeText(data.title) && data.historicalDate && row.historicalDate === data.historicalDate) warnings.push({ kind: "same_title_and_historical_date", recordId: row.id });
    }
  }
  return warnings;
}
