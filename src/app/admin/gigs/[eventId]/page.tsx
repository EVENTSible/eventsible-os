import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { updateDayOfContactAction, updateEventDayLogisticsAction, updateOperationalTimingAction, upsertEventDayNoteAction } from "@/app/admin/actions";
import { DayOfContactEditor } from "@/components/day-of-contact-editor";
import { EventDayLogisticsEditor } from "@/components/event-day-logistics-editor";
import { EventDayNotesEditor, type EventDayNote } from "@/components/event-day-notes-editor";
import { OperationalTimingEditor } from "@/components/operational-timing-editor";
import { buildGigReadiness, extractOperationalDetails, openTasks } from "@/lib/gig-readiness.mjs";
import { formatMoney } from "@/lib/mission-control.mjs";
import { contactDisplayName, dayOfContactOption, dayOfContactRelationshipLabel, resolveDayOfContact } from "@/lib/day-of-contact.mjs";
import { eventDayLogisticsFormValues } from "@/lib/event-day-logistics.mjs";
import { formatClockTime, formatLoadInWindow, operationalTimingFormValues, OPERATIONAL_TIMING_FACT_KEY_LIST } from "@/lib/operational-timing.mjs";
import { eventDateLabel, eventTimeLabel } from "@/lib/event-time.mjs";
import { localDateKey } from "@/lib/hq-calendar.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import { buildWeddingOperations, weddingScheduleReview } from "@/lib/wedding-operations.mjs";
import { ownerPlanningReviewForGig } from "@/lib/owner-planning-review.mjs";
import { answerHasValue, formatWeddingAnswer, WEDDING_SECTIONS } from "@/lib/wedding-companion.mjs";
import { recordWeddingScheduleReviewAction } from "./schedule-review-actions";

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
function duration(start: unknown, end: unknown) {
  if (!start || !end) return null;
  const hours = (new Date(String(end)).valueOf() - new Date(String(start)).valueOf()) / 3_600_000;
  return Number.isFinite(hours) && hours > 0 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours` : null;
}
function safePhone(value: unknown) { return typeof value === "string" ? value.replace(/[^+\d]/g, "") : ""; }
function safeEmail(value: unknown) { return typeof value === "string" && !/[\r\n]/.test(value) ? value.trim() : ""; }
function operationalTime(label: string, value: unknown, timeZone: unknown) {
  if (label.startsWith("Service")) return eventTimeLabel(value, timeZone);
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
  if (!isStaffRole(authData.user.app_metadata?.role)) redirect("/access-denied");

  const [eventResult, bookingResult, activityResult, quoteResult, tasksResult, filesResult, factsResult, planningResult, notesResult] = await Promise.all([
    supabase.from("os_events").select("id,primary_contact_id,day_of_contact_id,title,event_type,status,starts_at,ends_at,historical_date,timezone,guest_count,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,venue_country,settings,created_at,updated_at").eq("id", eventId).neq("status", "archived").maybeSingle(),
    supabase.from("os_bookings").select("id,event_id,accepted_quote_version_id,status,contract_status,payment_status,total_amount,deposit_amount,balance_due,balance_due_at,booked_at,metadata,created_at,updated_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_activity_events").select("id,event_type,occurred_at,created_at,visibility").eq("event_id", eventId).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("os_quote_versions").select("id,status,currency,subtotal,discount_amount,travel_amount,total_amount,deposit_amount,created_at").eq("event_id", eventId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_tasks").select("id,title,description,status,priority,due_at,completed_at,task_type,created_at,metadata").eq("event_id", eventId).order("due_at", { ascending: true, nullsFirst: false }).limit(50),
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
  const eventDate = event.historical_date ? String(event.historical_date) : eventDateLabel(event.starts_at, event.timezone);
  const eventStart = event.historical_date ? "Time not provided" : eventTimeLabel(event.starts_at, event.timezone);
  const eventEnd = event.historical_date ? "" : eventTimeLabel(event.ends_at, event.timezone);
  const canonicalDayOfContact = (dayOfContactResult.data ?? null) as AnyRow | null;
  const quote = (quoteResult.data ?? null) as AnyRow | null;
  const services = (servicesResult.data ?? []) as AnyRow[];
  const tasks = (tasksResult.data ?? []) as AnyRow[];
  const files = (filesResult.data ?? []) as AnyRow[];
  const planning = (planningResult.data ?? null) as AnyRow | null;
  const isOwner = authData.user.app_metadata?.role === "owner";
  const ownerReview = isOwner && !planning ? ownerPlanningReviewForGig(eventId) : null;
  const candidateId = ownerReview?.assignmentId ?? null;
  const staffDate = event.starts_at ? new Date(String(event.starts_at)) : null;
  const staffFrom = staffDate && !Number.isNaN(staffDate.valueOf()) ? new Date(staffDate.valueOf() - 86_400_000).toISOString().slice(0, 10) : null;
  const staffTo = staffDate && !Number.isNaN(staffDate.valueOf()) ? new Date(staffDate.valueOf() + 86_400_000).toISOString().slice(0, 10) : null;
  const [candidateResult, sourceResult, linkedResult, staffResult] = await Promise.all([
    candidateId && !planning ? supabase.from("os_planning_assignments").select("id,event_id,status,submitted_at,last_saved_at,settings").eq("id", candidateId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ownerReview ? supabase.from("os_events").select("id,status,source").eq("id", ownerReview.sourceEventId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    planning ? supabase.from("os_planning_assignments").select("id,event_id,status,submitted_at,last_saved_at,settings").eq("id", planning.id).eq("event_id", eventId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    staffFrom && staffTo ? supabase.rpc("os_team_calendar_snapshot", { p_from: staffFrom, p_to: staffTo }) : Promise.resolve({ data: null, error: null }),
  ]);
  const staffSnapshot = staffResult.data as { assignments?: Array<{ eventId: string; teamMemberId: string; assignmentRole: string; callTime: string | null }>; teamMembers?: Array<{ id: string; displayName: string }> } | null;
  const eventStaff = (staffSnapshot?.assignments ?? []).filter(row => row.eventId === eventId);
  const teamNames = new Map((staffSnapshot?.teamMembers ?? []).map(row => [row.id, row.displayName]));
  const candidate = candidateResult.data && candidateResult.data.event_id === ownerReview?.sourceEventId && candidateResult.data.status === "submitted" && sourceResult.data?.status === "inquiry" && sourceResult.data?.source === "wedding_hero_public_submission" ? candidateResult.data : null;
  const assignment = linkedResult.data ?? candidate;
  const planningAnswersResult = assignment ? await supabase.from("os_planning_answers").select("question_key,value").eq("assignment_id", assignment.id) : { data: [], error: null };
  const planningAnswers = Object.fromEntries((planningAnswersResult.data ?? []).map(row => [row.question_key, row.value]));
  const planningPacket = assignment && !planningAnswersResult.error ? buildWeddingOperations({ event: { id: assignment.event_id, status: candidate ? "inquiry" : String(event.status) }, assignment, answers: planningAnswers, services, tasks: tasks.map(task => ({ id: String(task.id), metadata: task.metadata as Record<string, unknown> | undefined })) }) : null;
  const musicPreferences = planningPacket?.sheet.sections.find(section => section.title === "Music and special moments")?.items.filter((item: { label: string; value: string }) => ["Music styles", "Do-not-play list", "Clean edits required", "Other dance-floor direction", "Cultural or traditional music"].includes(item.label)) ?? [];
  const history = Array.isArray((assignment?.settings as AnyRow | undefined)?.wedding_hero_submissions) ? (assignment?.settings as AnyRow).wedding_hero_submissions as AnyRow[] : [];
  const reviewResult = await supabase.from("os_event_facts").select("value").eq("event_id", eventId).eq("fact_key", "event.schedule_review").maybeSingle();
  const review = reviewResult.data?.value && typeof reviewResult.data.value === "object" && !Array.isArray(reviewResult.data.value) ? reviewResult.data.value as AnyRow : null;
  const planningZone = review && review.assignmentId === assignment?.id ? String(review.planningZone ?? "") : "";
  const schedule = planningPacket ? weddingScheduleReview(planningPacket.timeline, { starts_at: event.starts_at, ends_at: event.ends_at, timezone: event.timezone }, planningZone || null) : null;
  const eventDayNotes = (notesResult.data ?? []) as EventDayNote[];
  const loadResults = [["Booking", bookingResult.error], ["Services", servicesResult.error], ["Activity", activityResult.error], ["Quote", quoteResult.error], ["Contact", contactResult.error], ["Day-of contact", dayOfContactResult.error], ["Contact selector", contactOptionsResult.error], ["Tasks", tasksResult.error], ["Documents", filesResult.error], ["Event facts", factsResult.error], ["Planning", planningResult.error], ["Crew", staffResult.error], ["Client planning", candidateResult.error ?? sourceResult.error ?? linkedResult.error ?? planningAnswersResult.error]] as const;
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
  const calendarDate = localDateKey(event.starts_at, text(event.timezone, "America/Indiana/Indianapolis"));
  const calendarHref = calendarDate ? `/admin/calendar?date=${calendarDate}` : "/admin/calendar";

  return <div className="workspace-main">
      <header className="workspace-hero"><div><span className="eyebrow">Gig Workspace</span><h1>{text(event.title, "Untitled event")}</h1><p>{text(event.event_type, "Event type not provided")} · {eventDate} · {location || "Venue/location not provided"}</p></div><div className="workspace-status-card"><span>Booking</span><b>{status(booking?.status ?? event.status)}</b></div></header>
      <div className="event-day-actions" aria-label="Event-day quick actions">
        {directions ? <a className="btn primary" href={directions} target="_blank" rel="noreferrer">Directions</a> : <span className="btn disabled" aria-disabled="true">Directions unavailable</span>}
        {dayOfPhone || phone ? <a className="btn" href={`tel:${dayOfPhone || phone}`}>Call {dayOfPhone ? "day-of contact" : "client"}</a> : null}
        {dayOfPhone || phone ? <a className="btn" href={`sms:${dayOfPhone || phone}`}>Text</a> : null}
        {email ? <a className="btn" href={`mailto:${email}`}>Email</a> : null}
      </div>
      {loadWarnings.length ? <div className="alert warning"><b>Some workspace records could not be loaded.</b><p>Known data is shown; unavailable areas count as Unknown, never Ready.</p></div> : null}

      <nav className="gig-jump-nav" aria-label="Gig sections"><a href="#overview">Overview</a><a href="#timeline">Timeline</a><a href="#music">Music</a><a href="#crew">Crew</a><a href="#tasks">Tasks</a><a href="#equipment">Equipment</a><a href="#client-planning">Client planning</a><a href={calendarHref}>Calendar</a></nav>
      <section className="gig-focus-overview" id="overview"><div><span className="eyebrow">At a glance</span><h2>Everything for this gig</h2><p>{text(contact?.display_name, "Client to confirm")} · {text(event.venue_name, "Venue to confirm")} · {eventDate}</p></div><dl><Fact label="Booked coverage">{event.historical_date ? "Time not recorded" : `${eventStart} to ${eventEnd}`}</Fact><Fact label="Services">{services.length ? services.map(service => text(service.service_name, text(service.service_code))).join(", ") : "No service rows available"}</Fact><Fact label="Contract">{status(booking?.contract_status)}</Fact><Fact label="Payment">{status(booking?.payment_status)}</Fact></dl></section>
      <div className="gig-focus-grid">
        <section className="gig-focus-card gig-focus-wide" id="timeline"><header><div><span className="eyebrow">Client draft and signed booking</span><h2>Timeline</h2></div>{schedule?.status === "PENDING REVIEW" ? <span className="gig-pending">Pending confirmation</span> : null}</header>
          <p className="gig-coverage">Contracted: {eventDate}, {eventStart} to {eventEnd} ({text(event.timezone)}). Client times are separate until approved.</p>
          {planningPacket ? <><ol className="gig-timeline">{planningPacket.timeline.map((row, i) => <li key={`${row.sourceKey}-${i}`}><time>{row.time ?? "Time TBD"}</time><div><b>{row.moment}</b>{row.people || row.notes ? <p>{[row.people, row.notes].filter(Boolean).join(" · ")}</p> : null}</div></li>)}</ol><p className="gig-status-note">{schedule?.reason ?? "Client timezone needs confirmation."} No draft time changes the signed coverage.</p>{schedule?.outside?.length ? <p className="gig-pending">{schedule.outside.length} activities outside booked coverage need review.</p> : null}</> : <p className="workspace-empty">No client timeline is linked to this Gig.</p>}
          {isOwner && planningPacket ? <a href="#schedule-review">Review schedule decision</a> : null}
        </section>
        <section className="gig-focus-card" id="music"><header><span className="eyebrow">Client selections</span><h2>Music</h2></header>{planningPacket?.music.length ? <ul className="gig-simple-list">{planningPacket.music.map(row => <li key={row.sourceKey}><b>{row.moment}: {row.title}</b><span>{row.artist || "Artist to confirm"} · {row.version || "Version to confirm"}</span></li>)}</ul> : <p className="workspace-empty">No linked music requests are available.</p>}{musicPreferences.length ? <details><summary>Preferences and do-not-play</summary><dl className="gig-answer-grid">{musicPreferences.map((item: { label: string; value: string }) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></details> : <p className="gig-status-note">Music preferences and do-not-play still need confirmation.</p>}<p className="gig-status-note">Recordings, cue points and local availability still need verification.</p></section>
        <section className="gig-focus-card" id="crew"><header><span className="eyebrow">People and calls</span><h2>Crew</h2></header>{staffResult.error ? <p className="workspace-empty">Assignments are unavailable.</p> : eventStaff.length ? <ul className="gig-simple-list">{eventStaff.map((row, i) => <li key={`${row.teamMemberId}-${i}`}><b>{teamNames.get(row.teamMemberId) ?? "Team member"} · {status(row.assignmentRole)}</b><span>{row.callTime ? `Call ${dateTime(row.callTime)}` : "Call time outstanding"}</span></li>)}</ul> : <p className="workspace-empty">No crew assignment is recorded for this Gig.</p>}<a href="/admin/team">Open Team</a></section>
        <section className="gig-focus-card" id="tasks"><header><span className="eyebrow">Preparation</span><h2>Tasks</h2></header>{tasks.length ? <ul className="gig-simple-list">{openTasks(tasks).map(task => <li key={String(task.id)}><b>{text(task.title, "Untitled task")}</b><span>{status(task.status)}{task.due_at ? ` · Due ${dateTime(task.due_at)}` : ""}</span></li>)}</ul> : <p className="workspace-empty">No event tasks are recorded.</p>}{planningPacket?.tasks.some(task => task.status !== "EXISTING") ? <details><summary>Suggested checks for Owner review</summary><ul>{planningPacket.tasks.filter(task => task.status !== "EXISTING").map(task => <li key={task.key}>{task.title}</li>)}</ul><p>Suggestions are not created tasks.</p></details> : null}</section>
        <section className="gig-focus-card" id="equipment"><header><span className="eyebrow">Gear</span><h2>Equipment</h2></header><p className="workspace-empty">No confirmed equipment assignment is linked to this event. Check booked services and venue logistics before packing.</p><p className="gig-status-note">Service details and operational edit controls are in More event details below.</p></section>
        <section className="gig-focus-card gig-focus-wide" id="client-planning"><header><div><span className="eyebrow">Wedding Hero / Event Hero</span><h2>Client planning</h2></div>{candidate ? <span className="gig-pending">Owner review only</span> : null}</header>
          {candidate ? <p className="alert warning">The Owner confirmed this plan and booking describe the same wedding. The submitted plan still belongs to a separate inquiry. This read-only view is not a completed reconciliation or approved run sheet.</p> : null}
          {planningPacket ? <><p>Submitted {dateTime(assignment?.submitted_at)} · Last updated {dateTime(assignment?.last_saved_at ?? assignment?.submitted_at)} · {Object.keys(planningAnswers).length} saved answers.</p><div className="gig-planning-links"><a className="secondary-button" href={`/admin/wedding/${assignment?.event_id}`}>Original answers</a><a className="secondary-button" href={`/admin/wedding/${assignment?.event_id}/operations`}>Planning packet</a></div>{history.length ? <details><summary>Submission history ({history.length})</summary><ol>{history.map((entry, i) => <li key={String(entry.submission_id ?? i)}>{dateTime(entry.submitted_at)} · {status(entry.mode)} · {String(entry.progress_percent ?? "?")}% saved</li>)}</ol><p>History records submission times; answer values reflect the latest saved version.</p></details> : null}<details><summary>Read submitted answers here</summary><div className="gig-answer-grid">{WEDDING_SECTIONS.map(section => <section key={section.key}><h3>{section.title}</h3><dl>{section.questions.filter(question => answerHasValue(planningAnswers[question.key])).map(question => <div key={question.key}><dt>{question.label}</dt><dd>{formatWeddingAnswer(question, planningAnswers[question.key])}</dd></div>)}</dl></section>)}</div></details></> : <p className="workspace-empty">No submitted plan is linked to this Gig. A separate plan requires Owner identity review and approved reconciliation.</p>}
        </section>
      </div>

      <section className="readiness-summary" id="readiness" aria-labelledby="readiness-title">
        <header><div><span className="eyebrow">Operational readiness</span><h2 id="readiness-title">What needs attention</h2></div><p>No percentage. Unknown never counts as Ready.</p></header>
        <div className="readiness-counts"><div className="critical"><b>{readiness.critical.length}</b><span>Critical</span></div><div className="attention"><b>{readiness.attention.length}</b><span>Attention</span></div><div className="ready"><b>{readiness.ready.length}</b><span>Ready</span></div><div className="unknown"><b>{readiness.unknown.length}</b><span>Unknown</span></div></div>
        {criticalChecks.length || attentionChecks.length ? <ul className="readiness-alerts">{[...criticalChecks, ...attentionChecks].map((check) => <li key={check.id} className={check.state}><div><b>{check.label}</b><span>{check.message}</span></div></li>)}</ul> : <EmptyFoundation>No critical or attention items were derived. Review Unknown items before treating the gig as ready.</EmptyFoundation>}
        <details className="readiness-details"><summary>All readiness checks ({allChecks.length})</summary><ul className="readiness-list">{allChecks.map((check) => <li className={check.state} key={check.id}><span>{check.state.replaceAll("_", " ")}</span><div><b>{check.label}</b><small>{check.message}</small></div></li>)}</ul></details>
      </section>

      <section className="gig-schedule-review" id="schedule-review"><header><span className="eyebrow">Coverage decision</span><h2>Schedule review</h2></header>
        <p>Signed coverage: {eventDate} {eventStart} to {eventEnd} ({text(event.timezone)}). Client activity times and any earlier service remain pending confirmation.</p>
        {planningPacket ? <><p>{schedule?.reason}</p>{schedule?.outside?.length ? <ul>{schedule.outside.map((row, i) => <li key={`${row.sourceKey}-${i}`}>{row.time} {row.moment}: {row.position}</li>)}</ul> : null}
          {isOwner ? <form action={recordWeddingScheduleReviewAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="assignmentId" value={assignment?.id} /><input type="hidden" name="sourceDigest" value={planningPacket.sourceDigest} /><label>Client planning timezone <select name="planningZone" defaultValue={planningZone}><option value="">Needs confirmation</option><option value="America/Detroit">Eastern, Michigan</option><option value="America/Chicago">Central</option><option value="America/Indiana/Indianapolis">Eastern, Indiana</option></select></label><label>Owner decision <select name="decision" defaultValue={review && review.assignmentId === assignment?.id ? String(review.decision ?? "pending") : "pending"}><option value="pending">Pending review</option><option value="accommodate">Accommodate, subject to client confirmation</option><option value="clarify">Clarify times and coverage</option><option value="propose_change">Propose contract change</option></select></label><label>Internal review note <textarea name="note" maxLength={1000} defaultValue={review && review.assignmentId === assignment?.id ? String(review.note ?? "") : ""} /></label><button className="btn" type="submit">Save Owner review</button></form> : null}<p>Owner decision: {review && review.assignmentId === assignment?.id ? status(review.decision) : "Pending review"}. This review does not change pricing, contracted coverage or the run sheet.</p></> : <p>No submitted plan is available for comparison.</p>}
      </section>
      <details className="workspace-more"><summary>More event details and edit controls</summary><div className="workspace-grid">        <section className="workspace-section workspace-wide event-day-notes-section" id="event-day-notes"><header><span className="eyebrow">Event-Day Notes</span><h2>Pinned instructions and reminders</h2></header><EventDayNotesEditor action={upsertEventDayNoteAction} eventId={eventId} loadFailed={Boolean(notesResult.error)} notes={eventDayNotes} /></section>
        <section className="workspace-section workspace-wide" id="operations"><header><span className="eyebrow">Our operational times</span><h2>Arrival through load-out</h2></header><dl className="operations-timeline">{operationalTimes.map(([label, value]) => <Fact key={label} label={label}>{event.historical_date&&label.startsWith("Service")?"Time not provided":operationalTime(label, value, event.timezone)}</Fact>)}</dl><p className="workspace-help">Missing operational times are shown honestly. Event start/end do not imply staff arrival, load-in, setup, breakdown, or must-be-out times.</p><OperationalTimingEditor action={updateOperationalTimingAction} eventId={eventId} initialValues={timingFormValues} /></section>
        <section className="workspace-section workspace-wide logistics-section" id="logistics"><header><span className="eyebrow">Event-day logistics</span><h2>Staff arrival and venue access</h2></header><dl className="workspace-facts logistics-facts"><Fact label="Staff call">{formatClockTime(operational.staffCallTime)}</Fact><Fact label="Setup start">{formatClockTime(operational.setupStart)}</Fact><Fact label="Room / area">{text(operational.roomArea)}</Fact><Fact label="Load-in / access notes">{text(operational.loadInDetails)}</Fact></dl><EventDayLogisticsEditor action={updateEventDayLogisticsAction} eventId={eventId} initialValues={logisticsFormValues} /></section>
        <section className="workspace-section workspace-wide important-section" id="important"><header><span className="eyebrow">Important details</span><h2>What could matter on event day</h2></header>{importantDetails.length ? <dl className="workspace-facts">{importantDetails.map(([label, value]) => <Fact key={String(label)} label={String(label)}>{text(value)}</Fact>)}</dl> : <EmptyFoundation>No special-instruction, environment, experience-goal, or client-note details are recorded in the current allow-listed fields.</EmptyFoundation>}</section>
        <section className="workspace-section workspace-wide day-of-contact-section" id="client"><header><span className="eyebrow">Client</span><h2>Primary and day-of contacts</h2></header>{contact ? <dl className="workspace-facts"><Fact label="Primary client">{text(contactDisplayName(contact), "Client not provided")}</Fact><Fact label="Organization">{text(contact.organization_name)}</Fact><Fact label="Email">{text(contact.primary_email)}</Fact><Fact label="Primary phone">{text(contact.primary_phone)}</Fact><Fact label="Preferred contact">{status(contact.preferred_channel)}</Fact><Fact label="Day-of contact">{text(dayOfContact.name, dayOfContact.isCanonical ? "Canonical contact unavailable" : "Not provided")}</Fact><Fact label="Day-of phone">{text(dayOfContact.phone)}</Fact><Fact label="Relationship">{dayOfContact.isCanonical ? dayOfContactRelationshipLabel(dayOfContact.relationship) : dayOfContact.source === "legacy" ? "Legacy details; relationship not established" : "Not provided"}</Fact></dl> : <EmptyFoundation>No canonical primary contact is linked to this event.</EmptyFoundation>}{dayOfPhone ? <div className="day-of-contact-actions"><a className="btn" href={`tel:${dayOfPhone}`}>Call day-of contact</a><a className="btn" href={`sms:${dayOfPhone}`}>Text day-of contact</a></div> : null}<DayOfContactEditor action={updateDayOfContactAction} contacts={contactOptions} eventId={eventId} initialContactId={String(event.day_of_contact_id ?? "")} primaryContactId={String(event.primary_contact_id ?? "")} /></section>
        <section className="workspace-section" id="money"><header><span className="eyebrow">Money / contract</span><h2>Canonical booking state</h2></header>{booking || quote ? <dl className="workspace-facts"><Fact label="Quote">{status(quote?.status)}</Fact><Fact label="Total">{formatMoney(booking?.total_amount ?? quote?.total_amount)}</Fact><Fact label="Deposit">{formatMoney(booking?.deposit_amount ?? quote?.deposit_amount)}</Fact><Fact label="Balance">{formatMoney(booking?.balance_due)}</Fact><Fact label="Balance due">{dateTime(booking?.balance_due_at)}</Fact><Fact label="Payment status">{status(booking?.payment_status)}</Fact><Fact label="Contract status">{status(booking?.contract_status)}</Fact><Fact label="Payment terms">{text(nestedValue(booking?.metadata, "payment_terms"))}</Fact></dl> : <EmptyFoundation>No canonical quote or booking money record is available.</EmptyFoundation>}<p className="workspace-help">A balance does not automatically block readiness. The due date and recorded terms determine urgency.</p></section>
        <section className="workspace-section workspace-wide" id="services"><header><span className="eyebrow">Services</span><h2>Booked services</h2></header>{services.length ? <div className="service-grid">{services.map((service) => <article key={String(service.id)}><div><h3>{text(service.service_name, text(service.service_code, "Service"))}</h3><span className="status-pill">{status(service.status)}</span></div><dl><Fact label="Time">{service.starts_at ? `${eventTimeLabel(service.starts_at,event.timezone)} – ${eventTimeLabel(service.ends_at,event.timezone)}` : "Follows event schedule unless separately configured"}</Fact><Fact label="Duration">{duration(service.starts_at, service.ends_at) || "Not separately recorded"}</Fact><Fact label="Location">{text(service.location_label)}</Fact><Fact label="Package / add-on">{text(nestedValue(service.configuration, "package_name") ?? nestedValue(service.configuration, "addon_name"))}</Fact></dl></article>)}</div> : <EmptyFoundation>No booked service records are linked. Convert to Gig seeds these from the approved canonical quote.</EmptyFoundation>}</section>
        <section className="workspace-section" id="documents"><header><span className="eyebrow">Documents</span><h2>Contracts and files</h2></header>{files.length ? <ul className="document-list">{files.map((file) => <li key={String(file.id)}><b>{text(file.file_name, "Unnamed file")}</b><span>{status(file.category, "Uncategorized")} · {status(file.visibility)}</span></li>)}</ul> : <EmptyFoundation>No canonical event files are linked. Contract state is shown in Money / contract; a status is not a document.</EmptyFoundation>}</section>
        <section className="workspace-section workspace-wide" id="activity"><header><span className="eyebrow">Activity / notes</span><h2>Event history</h2></header>{(activityResult.data ?? []).length ? <ol className="activity-list">{(activityResult.data ?? []).map((activity) => <li key={activity.id}><div><b>{status(activity.event_type)}</b><span>{dateTime(activity.occurred_at ?? activity.created_at)}</span></div></li>)}</ol> : <EmptyFoundation>No canonical activity entries are available for this event.</EmptyFoundation>}</section>
      </div></details>
  </div>;
}
