import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { updateDayOfContactAction, updateEventDayLogisticsAction, updateOperationalTimingAction, upsertEventDayNoteAction } from "@/app/admin/actions";
import { DayOfContactEditor } from "@/components/day-of-contact-editor";
import { EventDayLogisticsEditor } from "@/components/event-day-logistics-editor";
import { EventDayNotesEditor, type EventDayNote } from "@/components/event-day-notes-editor";
import { OperationalTimingEditor } from "@/components/operational-timing-editor";
import { Wordmark } from "@/components/wordmark";
import { buildGigReadiness, extractOperationalDetails } from "@/lib/gig-readiness.mjs";
import { formatMoney } from "@/lib/mission-control.mjs";
import { contactDisplayName, dayOfContactOption, dayOfContactRelationshipLabel, resolveDayOfContact } from "@/lib/day-of-contact.mjs";
import { eventDayLogisticsFormValues } from "@/lib/event-day-logistics.mjs";
import { formatClockTime, formatLoadInWindow, operationalTimingFormValues, OPERATIONAL_TIMING_FACT_KEY_LIST } from "@/lib/operational-timing.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Gig Workspace | EVENTSible HQ" };
type PageProps = { params: Promise<{ eventId: string }> };
type AnyRow = Record<string, unknown>;
type ReadinessCheck = { id: string; state: string; target: string; label: string; message: string };
const WORKSPACE_FACT_KEYS = [...OPERATIONAL_TIMING_FACT_KEY_LIST, "event.requested_start_time", "event.requested_end_time", "experience.goal"];

function text(value: unknown, fallback = "Not provided") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function status(value: unknown, fallback = "Unknown") { return text(value, fallback).replaceAll("_", " "); }
function dateTime(value: unknown, fallback = "Not provided") {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.valueOf())) return text(value, fallback);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
function dateOnly(value: unknown) { return value ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "full" }).format(new Date(String(value))) : "Date not provided"; }
function timeOnly(value: unknown, fallback = "Not provided") {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? text(value, fallback) : new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", timeStyle: "short" }).format(parsed);
}
function duration(start: unknown, end: unknown) {
  if (!start || !end) return null;
  const hours = (new Date(String(end)).valueOf() - new Date(String(start)).valueOf()) / 3_600_000;
  return Number.isFinite(hours) && hours > 0 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours` : null;
}
function safePhone(value: unknown) { return typeof value === "string" ? value.replace(/[^+\d]/g, "") : ""; }
function safeEmail(value: unknown) { return typeof value === "string" && !/[\r\n]/.test(value) ? value.trim() : ""; }
function operationalTime(label: string, value: unknown) {
  if (label.startsWith("Service")) return timeOnly(value);
  if (label === "Load-in window") return formatLoadInWindow(value);
  if (["Staff call", "Arrival", "Setup start", "Setup complete by", "Breakdown start", "Must be out"].includes(label)) return formatClockTime(value);
  return text(value);
}
function nestedValue(value: unknown, key: string) { return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRow)[key] : null; }
function EmptyFoundation({ children }: { children: ReactNode }) { return <p className="workspace-empty">{children}</p>; }
function Fact({ label, children }: { label: string; children: ReactNode }) { return <div><dt>{label}</dt><dd>{children}</dd></div>; }

export default async function GigWorkspacePage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");
  if (!isStaffRole(authData.user.app_metadata?.role)) redirect("/login?error=access");

  const [eventResult, bookingResult, activityResult, quoteResult, tasksResult, filesResult, factsResult, planningResult, notesResult] = await Promise.all([
    supabase.from("os_events").select("id,primary_contact_id,day_of_contact_id,title,event_type,status,starts_at,ends_at,timezone,guest_count,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,venue_country,settings,created_at,updated_at").eq("id", eventId).maybeSingle(),
    supabase.from("os_bookings").select("id,event_id,accepted_quote_version_id,status,contract_status,payment_status,total_amount,deposit_amount,balance_due,balance_due_at,booked_at,metadata,created_at,updated_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_activity_events").select("id,event_type,occurred_at,created_at,visibility").eq("event_id", eventId).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("os_quote_versions").select("id,status,currency,subtotal,discount_amount,travel_amount,total_amount,deposit_amount,created_at").eq("event_id", eventId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_tasks").select("id,title,description,status,priority,due_at,completed_at,task_type,created_at").eq("event_id", eventId).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
    supabase.from("os_files").select("id,file_name,category,mime_type,size_bytes,visibility,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(50),
    supabase.from("os_event_facts").select("id,fact_key,value,is_confirmed,source").eq("event_id", eventId).in("fact_key", WORKSPACE_FACT_KEYS),
    supabase.from("os_planning_assignments").select("id,status,progress_percent,last_saved_at,submitted_at,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_event_notes").select("id,body,is_pinned,created_at,updated_at").eq("event_id", eventId).eq("note_type", "event_day").eq("status", "active").eq("visibility", "staff").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  if (eventResult.error || !eventResult.data) notFound();
  const event = eventResult.data as AnyRow;
  const booking = (bookingResult.data ?? null) as AnyRow | null;
  const bookingId = booking?.id ? String(booking.id) : null;
  const servicesResult = bookingId
    ? await supabase.from("os_booking_services").select("id,booking_id,service_id,service_code,service_name,status,starts_at,ends_at,location_label,configuration,quote_item_id").eq("booking_id", bookingId).order("starts_at", { ascending: true })
    : { data: [], error: null };
  const [contactResult, dayOfContactResult, contactOptionsResult] = await Promise.all([
    event.primary_contact_id
      ? supabase.from("os_contacts").select("id,display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,notes,metadata").eq("id", event.primary_contact_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    event.day_of_contact_id
      ? supabase.from("os_contacts").select("id,display_name,first_name,last_name,organization_name,primary_phone,status").eq("id", event.day_of_contact_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("os_contacts").select("id,display_name,first_name,last_name,organization_name").eq("status", "active").order("display_name", { ascending: true, nullsFirst: false }).limit(200),
  ]);
  const contact = (contactResult.data ?? null) as AnyRow | null;
  const canonicalDayOfContact = (dayOfContactResult.data ?? null) as AnyRow | null;
  const quote = (quoteResult.data ?? null) as AnyRow | null;
  const services = (servicesResult.data ?? []) as AnyRow[];
  const tasks = (tasksResult.data ?? []) as AnyRow[];
  const files = (filesResult.data ?? []) as AnyRow[];
  const planning = (planningResult.data ?? null) as AnyRow | null;
  const eventDayNotes = (notesResult.data ?? []) as EventDayNote[];
  const loadResults = [["Booking", bookingResult.error], ["Services", servicesResult.error], ["Activity", activityResult.error], ["Quote", quoteResult.error], ["Contact", contactResult.error], ["Day-of contact", dayOfContactResult.error], ["Contact selector", contactOptionsResult.error], ["Tasks", tasksResult.error], ["Documents", filesResult.error], ["Event facts", factsResult.error], ["Planning", planningResult.error]] as const;
  const loadWarnings = loadResults.filter(([, error]) => error).map(([label]) => label);
  const operational = extractOperationalDetails({ event, contact, booking, facts: factsResult.data ?? [] });
  const dayOfContact = resolveDayOfContact({
    event,
    primaryContact: contact,
    dayOfContact: canonicalDayOfContact,
    legacyName: operational.dayOfContact,
    legacyPhone: operational.dayOfPhone,
  });
  const readinessOperational = { ...operational, dayOfContactId: dayOfContact.isCanonical ? dayOfContact.id : null, dayOfContact: dayOfContact.name };
  const readiness = buildGigReadiness({ event, contact, booking, services, tasks, files, planning, operational: readinessOperational, loadWarnings });
  const criticalChecks = readiness.critical as ReadinessCheck[];
  const attentionChecks = readiness.attention as ReadinessCheck[];
  const allChecks = readiness.checks as ReadinessCheck[];
  const phone = safePhone(contact?.primary_phone);
  const dayOfPhone = safePhone(dayOfContact.phone);
  const email = safeEmail(contact?.primary_email);
  const addressLines = [event.venue_address_1, event.venue_address_2, [event.venue_city, event.venue_state, event.venue_postal_code].filter(Boolean).join(" "), event.venue_country].filter(Boolean);
  const fullAddress = addressLines.join(", ");
  const location = [event.venue_name, fullAddress].filter(Boolean).join(" · ");
  const directions = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;
  const importantDetails = [["Environment", operational.environment], ["Special instructions", operational.specialInstructions], ["Experience goal", operational.experienceGoal], ["Client notes", contact?.notes]].filter(([, value]) => value);
  const operationalTimes: Array<[string, unknown]> = [["Staff call", operational.staffCallTime], ["Arrival", operational.arrivalTime], ["Load-in window", operational.loadInWindow], ["Setup start", operational.setupStart], ["Setup complete by", operational.setupComplete], ["Service start", event.starts_at ?? operational.requestedStart], ["Service end", event.ends_at ?? operational.requestedEnd], ["Breakdown start", operational.breakdownStart], ["Must be out", operational.mustBeOut]];
  const timingFormValues = operationalTimingFormValues(operational);
  const logisticsFormValues = eventDayLogisticsFormValues(operational);
  const contactOptions = (contactOptionsResult.data ?? []).map((candidate) => dayOfContactOption(candidate, event.primary_contact_id)).filter(Boolean) as Array<{ id: string; label: string; isPrimary: boolean }>;

  return <div className="workspace-shell">
    <nav className="review-nav"><div><Wordmark compact /><span>Gig Workspace</span></div><div><Link href="/admin">Mission Control</Link></div></nav>
    <main className="workspace-main">
      <header className="workspace-hero"><div><span className="eyebrow">Canonical Gig Workspace</span><h1>{text(event.title, "Untitled event")}</h1><p>{text(event.event_type, "Event type not provided")} · {dateOnly(event.starts_at)} · {location || "Venue/location not provided"}</p></div><div className="workspace-status-card"><span>Booking</span><b>{status(booking?.status ?? event.status)}</b><small>Event ID {eventId}</small></div></header>
      <div className="event-day-actions" aria-label="Event-day quick actions">
        {directions ? <a className="btn primary" href={directions} target="_blank" rel="noreferrer">Directions</a> : <span className="btn disabled" aria-disabled="true">Directions unavailable</span>}
        {dayOfPhone || phone ? <a className="btn" href={`tel:${dayOfPhone || phone}`}>Call {dayOfPhone ? "day-of contact" : "client"}</a> : null}
        {dayOfPhone || phone ? <a className="btn" href={`sms:${dayOfPhone || phone}`}>Text</a> : null}
        {email ? <a className="btn" href={`mailto:${email}`}>Email</a> : null}
      </div>
      {loadWarnings.length ? <div className="alert warning"><b>Some workspace records could not be loaded.</b><p>Known data is shown; unavailable areas count as Unknown, never Ready.</p></div> : null}

      <section className="readiness-summary" id="readiness" aria-labelledby="readiness-title">
        <header><div><span className="eyebrow">Operational readiness</span><h2 id="readiness-title">What needs attention</h2></div><p>No percentage. Unknown never counts as Ready.</p></header>
        <div className="readiness-counts"><div className="critical"><b>{readiness.critical.length}</b><span>Critical</span></div><div className="attention"><b>{readiness.attention.length}</b><span>Attention</span></div><div className="ready"><b>{readiness.ready.length}</b><span>Ready</span></div><div className="unknown"><b>{readiness.unknown.length}</b><span>Unknown</span></div></div>
        {criticalChecks.length || attentionChecks.length ? <ul className="readiness-alerts">{[...criticalChecks, ...attentionChecks].map((check) => <li key={check.id} className={check.state}><a href={`#${check.target}`}><b>{check.label}</b><span>{check.message}</span><em>Review section</em></a></li>)}</ul> : <EmptyFoundation>No critical or attention items were derived. Review Unknown items before treating the gig as ready.</EmptyFoundation>}
        <details className="readiness-details"><summary>All readiness checks ({allChecks.length})</summary><ul className="readiness-list">{allChecks.map((check) => <li className={check.state} key={check.id}><span>{check.state.replaceAll("_", " ")}</span><div><b>{check.label}</b><small>{check.message}</small></div></li>)}</ul></details>
      </section>

      <div className="workspace-grid">
        <section className="workspace-section workspace-overview" id="overview"><header><span className="eyebrow">Gig at a glance</span><h2>Event-day essentials</h2></header><dl className="workspace-facts workspace-facts-priority"><Fact label="Client / organization">{text(contact?.display_name, "Client not provided")}{contact?.organization_name ? ` · ${contact.organization_name}` : ""}</Fact><Fact label="Event">{text(event.title, "Untitled event")} · {text(event.event_type, "Type not provided")}</Fact><Fact label="Date">{dateOnly(event.starts_at)}</Fact><Fact label="Event time">{timeOnly(event.starts_at)} – {timeOnly(event.ends_at)}</Fact><Fact label="Venue">{text(event.venue_name, "Venue not provided")}</Fact><Fact label="Address">{fullAddress || "Full address not provided"}</Fact><Fact label="Room / area">{text(operational.roomArea)}</Fact><Fact label="Indoor / outdoor">{text(operational.environment)}</Fact></dl></section>
        <section className="workspace-section workspace-wide event-day-notes-section" id="event-day-notes"><header><span className="eyebrow">Event-Day Notes</span><h2>Pinned instructions and reminders</h2></header><EventDayNotesEditor action={upsertEventDayNoteAction} eventId={eventId} loadFailed={Boolean(notesResult.error)} notes={eventDayNotes} /></section>
        <section className="workspace-section workspace-wide" id="operations"><header><span className="eyebrow">Our operational times</span><h2>Arrival through load-out</h2></header><dl className="operations-timeline">{operationalTimes.map(([label, value]) => <Fact key={label} label={label}>{operationalTime(label, value)}</Fact>)}</dl><p className="workspace-help">Missing operational times are shown honestly. Event start/end do not imply staff arrival, load-in, setup, breakdown, or must-be-out times.</p><OperationalTimingEditor action={updateOperationalTimingAction} eventId={eventId} initialValues={timingFormValues} /></section>
        <section className="workspace-section workspace-wide logistics-section" id="logistics"><header><span className="eyebrow">Event-day logistics</span><h2>Staff arrival and venue access</h2></header><dl className="workspace-facts logistics-facts"><Fact label="Staff call">{formatClockTime(operational.staffCallTime)}</Fact><Fact label="Setup start">{formatClockTime(operational.setupStart)}</Fact><Fact label="Room / area">{text(operational.roomArea)}</Fact><Fact label="Load-in / access notes">{text(operational.loadInDetails)}</Fact></dl><EventDayLogisticsEditor action={updateEventDayLogisticsAction} eventId={eventId} initialValues={logisticsFormValues} /></section>
        <section className="workspace-section workspace-wide important-section" id="important"><header><span className="eyebrow">Important details</span><h2>What could matter on event day</h2></header>{importantDetails.length ? <dl className="workspace-facts">{importantDetails.map(([label, value]) => <Fact key={String(label)} label={String(label)}>{text(value)}</Fact>)}</dl> : <EmptyFoundation>No special-instruction, environment, experience-goal, or client-note details are recorded in the current allow-listed fields.</EmptyFoundation>}</section>
        <section className="workspace-section workspace-wide day-of-contact-section" id="client"><header><span className="eyebrow">Client</span><h2>Primary and day-of contacts</h2></header>{contact ? <dl className="workspace-facts"><Fact label="Primary client">{text(contactDisplayName(contact), "Client not provided")}</Fact><Fact label="Organization">{text(contact.organization_name)}</Fact><Fact label="Email">{text(contact.primary_email)}</Fact><Fact label="Primary phone">{text(contact.primary_phone)}</Fact><Fact label="Preferred contact">{status(contact.preferred_channel)}</Fact><Fact label="Day-of contact">{text(dayOfContact.name, dayOfContact.isCanonical ? "Canonical contact unavailable" : "Not provided")}</Fact><Fact label="Day-of phone">{text(dayOfContact.phone)}</Fact><Fact label="Relationship">{dayOfContact.isCanonical ? dayOfContactRelationshipLabel(dayOfContact.relationship) : dayOfContact.source === "legacy" ? "Legacy details; relationship not established" : "Not provided"}</Fact></dl> : <EmptyFoundation>No canonical primary contact is linked to this event.</EmptyFoundation>}{dayOfPhone ? <div className="day-of-contact-actions"><a className="btn" href={`tel:${dayOfPhone}`}>Call day-of contact</a><a className="btn" href={`sms:${dayOfPhone}`}>Text day-of contact</a></div> : null}<DayOfContactEditor action={updateDayOfContactAction} contacts={contactOptions} eventId={eventId} initialContactId={String(event.day_of_contact_id ?? "")} primaryContactId={String(event.primary_contact_id ?? "")} /></section>
        <section className="workspace-section" id="money"><header><span className="eyebrow">Money / contract</span><h2>Canonical booking state</h2></header>{booking || quote ? <dl className="workspace-facts"><Fact label="Quote">{status(quote?.status)}</Fact><Fact label="Total">{formatMoney(booking?.total_amount ?? quote?.total_amount)}</Fact><Fact label="Deposit">{formatMoney(booking?.deposit_amount ?? quote?.deposit_amount)}</Fact><Fact label="Balance">{formatMoney(booking?.balance_due)}</Fact><Fact label="Balance due">{dateTime(booking?.balance_due_at)}</Fact><Fact label="Payment status">{status(booking?.payment_status)}</Fact><Fact label="Contract status">{status(booking?.contract_status)}</Fact><Fact label="Payment terms">{text(nestedValue(booking?.metadata, "payment_terms"))}</Fact></dl> : <EmptyFoundation>No canonical quote or booking money record is available.</EmptyFoundation>}<p className="workspace-help">A balance does not automatically block readiness. The due date and recorded terms determine urgency.</p></section>
        <section className="workspace-section workspace-wide" id="services"><header><span className="eyebrow">Services</span><h2>Booked services</h2></header>{services.length ? <div className="service-grid">{services.map((service) => <article key={String(service.id)}><div><h3>{text(service.service_name, text(service.service_code, "Service"))}</h3><span className="status-pill">{status(service.status)}</span></div><dl><Fact label="Time">{service.starts_at ? `${timeOnly(service.starts_at)} – ${timeOnly(service.ends_at)}` : "Follows event schedule unless separately configured"}</Fact><Fact label="Duration">{duration(service.starts_at, service.ends_at) || "Not separately recorded"}</Fact><Fact label="Location">{text(service.location_label)}</Fact><Fact label="Package / add-on">{text(nestedValue(service.configuration, "package_name") ?? nestedValue(service.configuration, "addon_name"))}</Fact></dl></article>)}</div> : <EmptyFoundation>No booked service records are linked. Convert to Gig seeds these from the approved canonical quote.</EmptyFoundation>}</section>
        <section className="workspace-section" id="tasks"><header><span className="eyebrow">Tasks / planning</span><h2>Outstanding work</h2></header>{tasks.length ? <ol className="task-list">{tasks.map((task) => <li key={String(task.id)}><div><b>{text(task.title, "Untitled task")}</b><span>{status(task.priority)} · {status(task.status)}</span></div><small>{task.due_at ? `Due ${dateTime(task.due_at)}` : "No due date"}</small></li>)}</ol> : <EmptyFoundation>No event-linked tasks are recorded. This is Unknown, not proof that planning is complete.</EmptyFoundation>}<p className="workspace-help">Client planning: {planning ? `${status(planning.status)}${planning.progress_percent !== null ? ` · ${planning.progress_percent}% of the canonical planning form` : ""}` : "No assignment linked"}.</p></section>
        <section className="workspace-section" id="documents"><header><span className="eyebrow">Documents</span><h2>Contracts and files</h2></header>{files.length ? <ul className="document-list">{files.map((file) => <li key={String(file.id)}><b>{text(file.file_name, "Unnamed file")}</b><span>{status(file.category, "Uncategorized")} · {status(file.visibility)}</span></li>)}</ul> : <EmptyFoundation>No canonical event files are linked. Contract state is shown in Money / contract; a status is not a document.</EmptyFoundation>}</section>
        <section className="workspace-section" id="staff"><header><span className="eyebrow">Staff</span><h2>Requirements and assignments</h2></header><EmptyFoundation>No verified event staffing relationship exists in the current schema. Staffing remains Unknown, not Ready.</EmptyFoundation></section>
        <section className="workspace-section" id="equipment"><header><span className="eyebrow">Equipment</span><h2>Requirements and load-out</h2></header><EmptyFoundation>No verified event equipment relationship exists in the current schema. Required, assigned, tested, loaded, returned, and issue states remain Unknown.</EmptyFoundation></section>
        <section className="workspace-section workspace-wide" id="activity"><header><span className="eyebrow">Activity / notes</span><h2>Event history</h2></header>{(activityResult.data ?? []).length ? <ol className="activity-list">{(activityResult.data ?? []).map((activity) => <li key={activity.id}><div><b>{status(activity.event_type)}</b><span>{dateTime(activity.occurred_at ?? activity.created_at)}</span></div></li>)}</ol> : <EmptyFoundation>No canonical activity entries are available for this event.</EmptyFoundation>}</section>
        <section className="workspace-section workspace-wide closeout-foundation"><header><span className="eyebrow">Closeout foundation</span><h2>Post-event work is not active yet</h2></header><p>Future closeout will track returned equipment, issues, payment completion, staff notes, Gig Log completion, deliverables, thank-you, and review-request eligibility. Lifecycle status and readiness remain separate.</p></section>
      </div>
    </main>
  </div>;
}
