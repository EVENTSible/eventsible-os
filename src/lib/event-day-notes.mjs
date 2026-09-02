const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EVENT_DAY_NOTE_BODY_LIMIT = 1500;

/** @param {unknown} value */
export function normalizeEventDayNoteBody(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {{eventId: unknown, noteId?: unknown, body: unknown, isPinned: unknown}} input
 */
export function eventDayNoteRpcArgs({ eventId, noteId = null, body, isPinned } = {}) {
  const canonicalEventId = String(eventId ?? "");
  const canonicalNoteId = String(noteId ?? "").trim();
  const normalizedBody = normalizeEventDayNoteBody(body);

  if (!UUID_PATTERN.test(canonicalEventId) || (canonicalNoteId && !UUID_PATTERN.test(canonicalNoteId))) {
    throw new Error("A canonical event and valid event-day note are required.");
  }
  if (!normalizedBody || normalizedBody.length > EVENT_DAY_NOTE_BODY_LIMIT) {
    throw new Error(`Event-day note must contain 1 to ${EVENT_DAY_NOTE_BODY_LIMIT.toLocaleString("en-US")} characters.`);
  }

  return {
    p_event_id: canonicalEventId,
    p_note_id: canonicalNoteId || null,
    p_body: normalizedBody,
    p_is_pinned: isPinned === true || isPinned === "true" || isPinned === "on",
  };
}

/** @param {Record<string, any>} error */
export function eventDayNoteRpcError(error) {
  const code = String(error?.code ?? "");
  if (code === "28000" || code === "42501") return "You are not authorized to update event-day notes for this event. Nothing was changed.";
  if (code === "22023") return "Check the event-day note. Nothing was saved.";
  if (code === "P0002") return "The canonical event or event-day note could not be found. Nothing was changed.";
  return "The event-day note could not be saved. Nothing was changed.";
}
