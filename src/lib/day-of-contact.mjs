const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function scalar(value) {
  return ["string", "number"].includes(typeof value) && String(value).trim() ? String(value).trim() : null;
}

/** @param {Record<string, any> | null} contact */
export function contactDisplayName(contact = null) {
  if (!contact || typeof contact !== "object") return null;
  return scalar(contact.display_name)
    ?? scalar([contact.first_name, contact.last_name].filter(Boolean).join(" "))
    ?? scalar(contact.organization_name);
}

/**
 * Resolve the canonical event relationship first, with legacy metadata retained
 * only as a read-only compatibility fallback when no canonical ID is assigned.
 */
/**
 * @param {{event?: Record<string, any>, primaryContact?: Record<string, any> | null,
 * dayOfContact?: Record<string, any> | null, legacyName?: unknown, legacyPhone?: unknown}} input
 */
export function resolveDayOfContact({ event = {}, primaryContact = null, dayOfContact = null, legacyName = null, legacyPhone = null } = {}) {
  const canonicalId = scalar(event?.day_of_contact_id);
  const primaryId = scalar(event?.primary_contact_id ?? primaryContact?.id);

  if (canonicalId) {
    const resolvedId = scalar(dayOfContact?.id);
    const resolved = resolvedId === canonicalId;
    return {
      id: canonicalId,
      name: resolved ? contactDisplayName(dayOfContact) : null,
      phone: resolved ? scalar(dayOfContact?.primary_phone) : null,
      relationship: primaryId && canonicalId === primaryId ? "same" : "different",
      source: resolved ? "canonical" : "canonical_unavailable",
      isCanonical: true,
    };
  }

  return {
    id: null,
    name: scalar(legacyName),
    phone: scalar(legacyPhone),
    relationship: "not_provided",
    source: scalar(legacyName) || scalar(legacyPhone) ? "legacy" : "missing",
    isCanonical: false,
  };
}

/** @param {unknown} relationship */
export function dayOfContactRelationshipLabel(relationship) {
  if (relationship === "same") return "Same as primary client";
  if (relationship === "different") return "Different from primary client";
  return "Not provided";
}

/** @param {Record<string, any>} contact @param {unknown} primaryContactId */
export function dayOfContactOption(contact = {}, primaryContactId = null) {
  const id = scalar(contact.id);
  if (!id) return null;
  const name = contactDisplayName(contact) ?? "Unnamed contact";
  const organization = scalar(contact.organization_name);
  const primary = id === scalar(primaryContactId);
  return {
    id,
    label: `${name}${organization && organization !== name ? ` · ${organization}` : ""}${primary ? " · Primary client" : ""}`,
    isPrimary: primary,
  };
}

/** @param {unknown} eventId @param {unknown} contactId */
export function dayOfContactRpcArgs(eventId, contactId) {
  if (!UUID_PATTERN.test(String(eventId ?? "")) || !UUID_PATTERN.test(String(contactId ?? ""))) {
    throw new Error("A canonical event and existing contact are required.");
  }
  return { p_event_id: eventId, p_day_of_contact_id: contactId };
}

/** @param {Record<string, any>} error */
export function dayOfContactRpcError(error) {
  const code = String(error?.code ?? "");
  if (code === "28000" || code === "42501") return "You are not authorized to update this event. Nothing was changed.";
  if (code === "22023" || code === "23503") return "Select an active existing contact. Nothing was changed.";
  if (code === "P0002") return "The canonical event could not be found. Nothing was changed.";
  return "The day-of contact could not be saved. Nothing was changed.";
}
