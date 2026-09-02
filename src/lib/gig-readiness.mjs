import { operationalTimingFacts } from "./operational-timing.mjs";

export const READINESS_STATES = Object.freeze({
  READY: "ready",
  NEEDS_ATTENTION: "needs_attention",
  NOT_READY: "not_ready",
  NOT_APPLICABLE: "not_applicable",
  UNKNOWN: "unknown",
});

const COMPLETE_TASK_STATUSES = new Set(["complete", "completed", "done", "cancelled"]);
const PAID_STATUSES = new Set(["paid", "settled", "complete", "completed"]);
const SIGNED_CONTRACT_STATUSES = new Set(["signed", "executed", "complete", "completed"]);

function present(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalized(value) {
  return present(value) ? String(value).trim().toLowerCase() : "";
}

function item(id, category, label, state, message, target) {
  return { id, category, label, state, message, target };
}

/** @param {Array<Record<string, any>>} tasks */
export function openTasks(tasks = []) {
  return tasks.filter((task) => !COMPLETE_TASK_STATUSES.has(normalized(task?.status)));
}

/**
 * @param {{
 * event?: Record<string, any>, contact?: Record<string, any> | null,
 * booking?: Record<string, any> | null, services?: Array<Record<string, any>>,
 * tasks?: Array<Record<string, any>>, files?: Array<Record<string, any>>,
 * planning?: Record<string, any> | null, operational?: Record<string, any>,
 * loadWarnings?: string[], now?: Date
 * }} input
 */
export function buildGigReadiness({ event = {}, contact = null, booking = null, services = [], tasks = [], files = [], planning = null, operational = {}, loadWarnings = [], now = new Date() } = {}) {
  const checks = [];
  const hasContact = Boolean(contact?.id);
  const hasContactRoute = present(contact?.primary_email) || present(contact?.primary_phone);
  const venueParts = [event?.venue_name, event?.venue_address_1, event?.venue_city, event?.venue_state].filter(present);
  const hasRouteableAddress = present(event?.venue_address_1) && present(event?.venue_city);
  const outstanding = openTasks(tasks);
  const overdue = outstanding.filter((task) => task?.due_at && new Date(task.due_at) < now);
  const paymentStatus = normalized(booking?.payment_status);
  const contractStatus = normalized(booking?.contract_status);
  const balanceDueAt = booking?.balance_due_at ? new Date(booking.balance_due_at) : null;
  const balanceKnown = present(booking?.balance_due);
  const balance = balanceKnown ? Number(booking?.balance_due) : null;

  checks.push(hasContact
    ? item("client", "Client", "Primary client", READINESS_STATES.READY, "Canonical contact is linked.", "client")
    : item("client", "Client", "Primary client", READINESS_STATES.NOT_READY, "No canonical contact is linked.", "client"));
  checks.push(hasContactRoute
    ? item("contact-route", "Client", "Contact route", READINESS_STATES.READY, "A usable phone or email is available.", "client")
    : item("contact-route", "Client", "Contact route", hasContact ? READINESS_STATES.NEEDS_ATTENTION : READINESS_STATES.NOT_READY, "Phone and email are missing.", "client"));
  checks.push(present(contact?.preferred_channel)
    ? item("preferred-channel", "Client", "Preferred contact method", READINESS_STATES.READY, `Use ${contact.preferred_channel}.`, "client")
    : item("preferred-channel", "Client", "Preferred contact method", READINESS_STATES.UNKNOWN, "Not recorded.", "client"));
  checks.push(present(operational?.dayOfContactId) || present(operational?.dayOfContact)
    ? item("day-of-contact", "Client", "Day-of contact", READINESS_STATES.READY, "Day-of contact is recorded.", "client")
    : item("day-of-contact", "Client", "Day-of contact", READINESS_STATES.UNKNOWN, "Not recorded; it may be the primary client.", "client"));

  checks.push(present(event?.starts_at)
    ? item("event-start", "Schedule", "Event start", READINESS_STATES.READY, "Start date and time are recorded.", "overview")
    : item("event-start", "Schedule", "Event start", READINESS_STATES.NOT_READY, "Event start is missing.", "overview"));
  checks.push(present(event?.ends_at)
    ? item("event-end", "Schedule", "Event end", READINESS_STATES.READY, "End time is recorded.", "overview")
    : item("event-end", "Schedule", "Event end", READINESS_STATES.NEEDS_ATTENTION, "Event end is missing.", "overview"));
  checks.push(hasRouteableAddress
    ? item("venue", "Venue", "Venue and address", READINESS_STATES.READY, "Venue and routeable address are recorded.", "overview")
    : item("venue", "Venue", "Venue and address", venueParts.length ? READINESS_STATES.NEEDS_ATTENTION : READINESS_STATES.NOT_READY, "Venue or address details are incomplete.", "overview"));
  checks.push(present(operational?.arrivalTime) || present(operational?.loadInWindow) || present(operational?.setupComplete)
    ? item("operations-times", "Schedule", "Arrival / load-in", READINESS_STATES.READY, "At least one operational time is recorded.", "operations")
    : item("operations-times", "Schedule", "Arrival / load-in", READINESS_STATES.UNKNOWN, "Operational arrival, load-in, and setup times are not recorded.", "operations"));

  checks.push(services.length
    ? item("services", "Services", "Booked services", READINESS_STATES.READY, `${services.length} canonical service record${services.length === 1 ? " is" : "s are"} linked.`, "services")
    : item("services", "Services", "Booked services", booking ? READINESS_STATES.NOT_READY : READINESS_STATES.UNKNOWN, "No booked service records are linked.", "services"));

  if (!tasks.length) checks.push(item("tasks", "Planning", "Event tasks", READINESS_STATES.UNKNOWN, "No event-linked tasks are recorded; this does not prove planning is complete.", "tasks"));
  else if (overdue.length) checks.push(item("tasks", "Planning", "Event tasks", READINESS_STATES.NOT_READY, `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}; ${outstanding.length} open.`, "tasks"));
  else if (outstanding.length) checks.push(item("tasks", "Planning", "Event tasks", READINESS_STATES.NEEDS_ATTENTION, `${outstanding.length} task${outstanding.length === 1 ? " remains" : "s remain"} open.`, "tasks"));
  else checks.push(item("tasks", "Planning", "Event tasks", READINESS_STATES.READY, "All recorded event tasks are complete.", "tasks"));

  if (!planning) checks.push(item("planning", "Planning", "Client planning", READINESS_STATES.UNKNOWN, "No planning assignment is linked.", "tasks"));
  else if (normalized(planning.status) === "submitted") checks.push(item("planning", "Planning", "Client planning", READINESS_STATES.READY, "Planning assignment is submitted.", "tasks"));
  else checks.push(item("planning", "Planning", "Client planning", READINESS_STATES.NEEDS_ATTENTION, `Planning is ${normalized(planning.status) || "not started"}.`, "tasks"));

  checks.push(item("staffing", "Staff", "Staffing", READINESS_STATES.UNKNOWN, "No verified event staffing relationship exists in the current schema.", "staff"));
  checks.push(item("equipment", "Equipment", "Equipment", READINESS_STATES.UNKNOWN, "No verified event equipment relationship exists in the current schema.", "equipment"));

  if (!booking) checks.push(item("money", "Money", "Payment state", READINESS_STATES.UNKNOWN, "No canonical booking payment state is available.", "money"));
  else if (PAID_STATUSES.has(paymentStatus) || (balanceKnown && balance !== null && balance <= 0)) checks.push(item("money", "Money", "Payment state", READINESS_STATES.READY, "Canonical booking shows no remaining balance.", "money"));
  else if (!balanceKnown) checks.push(item("money", "Money", "Payment state", READINESS_STATES.UNKNOWN, "The canonical booking does not record a remaining balance.", "money"));
  else if (balanceDueAt && balanceDueAt < now && balance !== null && balance > 0) checks.push(item("money", "Money", "Payment state", READINESS_STATES.NOT_READY, "A remaining balance is past its recorded due date.", "money"));
  else checks.push(item("money", "Money", "Payment state", READINESS_STATES.NEEDS_ATTENTION, "A balance remains; confirm the recorded payment terms and due date.", "money"));

  if (!booking || !contractStatus) checks.push(item("contract", "Documents", "Contract", READINESS_STATES.UNKNOWN, "Contract state is not available.", "documents"));
  else if (contractStatus === "not_required") checks.push(item("contract", "Documents", "Contract", READINESS_STATES.NOT_APPLICABLE, "Contract is explicitly not required.", "documents"));
  else if (SIGNED_CONTRACT_STATUSES.has(contractStatus)) checks.push(item("contract", "Documents", "Contract", READINESS_STATES.READY, "Contract is recorded as signed/executed.", "documents"));
  else checks.push(item("contract", "Documents", "Contract", READINESS_STATES.NEEDS_ATTENTION, `Contract is ${contractStatus.replaceAll("_", " ")}.`, "documents"));
  checks.push(files.length
    ? item("files", "Documents", "Event files", READINESS_STATES.READY, `${files.length} canonical event file${files.length === 1 ? " is" : "s are"} linked.`, "documents")
    : item("files", "Documents", "Event files", READINESS_STATES.UNKNOWN, "No event-linked files are recorded.", "documents"));

  for (const warning of loadWarnings) checks.push(item(`load-${warning}`, "System", "Workspace data", READINESS_STATES.UNKNOWN, `${warning} could not be loaded and is not treated as complete.`, "readiness"));

  const critical = checks.filter((check) => check.state === READINESS_STATES.NOT_READY);
  const attention = checks.filter((check) => check.state === READINESS_STATES.NEEDS_ATTENTION);
  const ready = checks.filter((check) => check.state === READINESS_STATES.READY);
  const unknown = checks.filter((check) => check.state === READINESS_STATES.UNKNOWN);
  const notApplicable = checks.filter((check) => check.state === READINESS_STATES.NOT_APPLICABLE);
  return { checks, critical, attention, ready, unknown, notApplicable };
}

/**
 * @param {{event?: Record<string, any>, contact?: Record<string, any> | null,
 * booking?: Record<string, any> | null, facts?: Array<Record<string, any>>}} input
 */
export function extractOperationalDetails({ event = {}, contact = null, booking = null, facts = [] } = {}) {
  const settings = event?.settings && typeof event.settings === "object" && !Array.isArray(event.settings) ? event.settings : {};
  const contactMetadata = contact?.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata : {};
  const bookingMetadata = booking?.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata) ? booking.metadata : {};
  const factMap = new Map(facts.map((fact) => [fact?.fact_key, fact?.value]));
  const timingFacts = operationalTimingFacts(facts);
  const scalar = (...values) => values.find((value) => ["string", "number"].includes(typeof value) && String(value).trim()) ?? null;
  return {
    dayOfContactId: scalar(event?.day_of_contact_id),
    staffCallTime: scalar(settings.staff_call_time, bookingMetadata.staff_call_time),
    arrivalTime: scalar(timingFacts.arrivalTime, settings.arrival_time, bookingMetadata.arrival_time),
    loadInWindow: timingFacts.loadInWindow.start ? timingFacts.loadInWindow : scalar(settings.load_in_window, bookingMetadata.load_in_window),
    setupStart: scalar(settings.setup_start, bookingMetadata.setup_start),
    setupComplete: scalar(timingFacts.setupComplete, settings.setup_complete_by, bookingMetadata.setup_complete_by),
    breakdownStart: scalar(timingFacts.breakdownStart, settings.breakdown_start, bookingMetadata.breakdown_start),
    mustBeOut: scalar(timingFacts.mustBeOut, settings.must_be_out, bookingMetadata.must_be_out),
    roomArea: scalar(settings.room_area, settings.room, bookingMetadata.room_area),
    environment: scalar(settings.environment, bookingMetadata.environment),
    dayOfContact: scalar(contactMetadata.day_of_contact_name, bookingMetadata.day_of_contact_name),
    dayOfPhone: scalar(contactMetadata.day_of_contact_phone, bookingMetadata.day_of_contact_phone),
    loadInDetails: scalar(settings.load_in_details, bookingMetadata.load_in_details),
    specialInstructions: scalar(settings.special_instructions, bookingMetadata.special_instructions),
    experienceGoal: scalar(factMap.get("experience.goal")),
    requestedStart: scalar(factMap.get("event.requested_start_time")),
    requestedEnd: scalar(factMap.get("event.requested_end_time")),
  };
}
