"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { agendaEvents, availabilityForDate, monthGrid } from "@/lib/hq-calendar.mjs";
import { assignmentRoleLabel, availabilityDateKeys, availabilityPrivacyDefault, availabilityTypeLabel, conflictIds, detectScheduleConflicts, teamAvailabilityLabel } from "@/lib/team-availability.mjs";

export type CalendarEvent = {
  id: string;
  title: string;
  eventType: string;
  eventStatus: string;
  bookingStatus: string;
  startsAt: string | null;
  endsAt: string | null;
  conflictStartsAt?: string | null;
  conflictEndsAt?: string | null;
  timezone: string;
  dateKey: string | null;
  startLabel: string;
  endLabel: string | null;
  venue: string | null;
  services: string[];
  classification: "booked" | "inquiry" | "other";
};

export type TeamMember = { id: string; displayName: string; timezone: string; status: "active" | "inactive"; isSelf: boolean };
export type TeamAvailability = {
  id: string;
  teamMemberId: string;
  entryType: "available" | "unavailable" | "outside_booking" | "vacation" | "reminder" | "note";
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timezone: string;
  privacy: "busy_only" | "team_details" | "private";
  title: string | null;
  privateNotes: string | null;
  canEdit: boolean;
  canRemove: boolean;
};
export type StaffAssignment = { id: string; eventId: string; teamMemberId: string; assignmentRole: string; callTime: string | null; status: string };

type View = "month" | "agenda";
type AgendaRange = "today" | "7" | "30" | "month" | "all";
type CalendarAction = (formData: FormData) => Promise<void>;
type ScheduleConflict = { id: string; teamMemberId: string; leftId: string; rightId: string; startsAt: string; endsAt: string };
type CalendarIndicator = { key: string; label: string; tone: string };

type Props = {
  events: CalendarEvent[];
  todayKey: string;
  unscheduledCount: number;
  teamMembers: TeamMember[];
  availability: TeamAvailability[];
  assignments: StaffAssignment[];
  currentTeamMemberId: string | null;
  canManageTeam: boolean;
  canManageAssignments: boolean;
  upsertAvailabilityAction: CalendarAction;
  removeAvailabilityAction: CalendarAction;
  manageAssignmentAction: CalendarAction;
  manageTeamMemberAction: CalendarAction;
};

function moveMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
}

function monthTitle(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function dateTitle(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T00:00:00Z`));
}

function dateTime(value: string | null, timeZone: string) {
  if (!value) return "Time not provided";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

function localInputValue(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function AssignmentChips({ eventId, assignments, members }: { eventId: string; assignments: StaffAssignment[]; members: Map<string, TeamMember> }) {
  const assigned = assignments.filter((assignment) => assignment.eventId === eventId);
  return assigned.length ? <span className="calendar-assignment-chips">{assigned.map((assignment) => <span key={assignment.id}>{members.get(assignment.teamMemberId)?.displayName ?? "Team member"} · {assignmentRoleLabel(assignment.assignmentRole)}</span>)}</span> : null;
}

function EventSummary({ event, assignments, members, hasConflict, compact = false }: { event: CalendarEvent; assignments: StaffAssignment[]; members: Map<string, TeamMember>; hasConflict: boolean; compact?: boolean }) {
  return (
    <Link className={`calendar-event calendar-event-${event.classification}${compact ? " compact" : ""}`} href={`/admin/gigs/${event.id}`}>
      <span className="calendar-event-time">{compact ? `${event.classification === "booked" ? "Confirmed" : "Tentative"} · ${event.startLabel}` : event.startLabel}</span><b>{event.title}</b>
      {hasConflict ? <span className="calendar-conflict-badge">Conflict</span> : null}
      {!compact ? <><small>{event.services.length ? event.services.join(", ") : event.eventType}{event.venue ? ` · ${event.venue}` : ""}</small><AssignmentChips eventId={event.id} assignments={assignments} members={members} /></> : null}
    </Link>
  );
}

function AvailabilityFields({ entry, defaultDate, allDay, setAllDay, members, currentTeamMemberId, canManageTeam }: { entry?: TeamAvailability | null; defaultDate: string; allDay: boolean; setAllDay?: (value: boolean) => void; members: TeamMember[]; currentTeamMemberId: string | null; canManageTeam: boolean }) {
  const timezone = entry?.timezone ?? members.find((member) => member.id === currentTeamMemberId)?.timezone ?? "America/Indiana/Indianapolis";
  const correctingAnotherMember = Boolean(entry && entry.teamMemberId !== currentTeamMemberId);
  const [entryType, setEntryType] = useState<TeamAvailability["entryType"]>(entry?.entryType ?? "unavailable");
  const [privacy, setPrivacy] = useState<TeamAvailability["privacy"]>(entry?.privacy ?? availabilityPrivacyDefault("unavailable"));
  function changeEntryType(nextType: TeamAvailability["entryType"]) {
    setEntryType(nextType);
    if (!entry) setPrivacy(availabilityPrivacyDefault(nextType));
  }
  return <>
    <input name="entry_id" type="hidden" value={entry?.id ?? ""} />
    {canManageTeam ? <label>Team member<select name="team_member_id" defaultValue={entry?.teamMemberId ?? currentTeamMemberId ?? ""} required><option value="">Choose team member</option>{members.filter((member) => member.status === "active").map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label> : <input name="team_member_id" type="hidden" value={entry?.teamMemberId ?? currentTeamMemberId ?? ""} />}
    <label>Schedule type<select name="entry_type" value={entryType} onChange={(event) => changeEntryType(event.target.value as TeamAvailability["entryType"])} disabled={correctingAnotherMember}><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="outside_booking">Outside booking</option><option value="vacation">Vacation / time off</option><option value="reminder">Reminder</option><option value="note">Note / idea</option></select>{correctingAnotherMember ? <input name="entry_type" type="hidden" value={entryType} /> : null}</label>
    {correctingAnotherMember ? <><input name="privacy" type="hidden" value={entry?.privacy ?? "busy_only"} /><p className="calendar-privacy-preserved">Editing {members.find((member) => member.id === entry?.teamMemberId)?.displayName ?? "this team member"}. Privacy, type, and private details stay unchanged.</p></> : <label>Privacy<select name="privacy" value={privacy} onChange={(event) => setPrivacy(event.target.value as TeamAvailability["privacy"])}><option value="busy_only">Busy only</option><option value="team_details">Share title with the team</option><option value="private">Private details</option></select></label>}
    <label>Timezone<input name="timezone" defaultValue={timezone} required /></label>
    <label className="calendar-checkbox"><input checked={allDay} name="all_day" onChange={(event) => setAllDay?.(event.target.checked)} type="checkbox" value="true" />All day</label>
    {allDay ? <><label>Start date<input name="starts_on" type="date" defaultValue={entry?.startsOn ?? defaultDate} required /></label><label>End date<input name="ends_on" type="date" defaultValue={entry?.endsOn ?? defaultDate} required /></label></> : <><label>Starts<input name="starts_at" type="datetime-local" defaultValue={localInputValue(entry?.startsAt ?? null, timezone) || `${defaultDate}T09:00`} required /></label><label>Ends<input name="ends_at" type="datetime-local" defaultValue={localInputValue(entry?.endsAt ?? null, timezone) || `${defaultDate}T10:00`} required /></label></>}
    {!correctingAnotherMember ? <><label className="calendar-field-wide">Optional title<input maxLength={120} name="title" defaultValue={entry?.title ?? ""} placeholder="Shown only when privacy allows" /></label><label className="calendar-field-wide">Private notes<textarea maxLength={2000} name="private_notes" defaultValue={entry?.privateNotes ?? ""} rows={3} /><small>Only you can read these notes. Owners still see only the occupied time window when details are private.</small></label></> : null}
  </>;
}

function AvailabilitySummary({ entry, member, conflict, onOpen }: { entry: TeamAvailability; member?: TeamMember; conflict: boolean; onOpen: (entry: TeamAvailability) => void }) {
  const when = entry.allDay ? `${entry.startsOn}${entry.endsOn !== entry.startsOn ? ` – ${entry.endsOn}` : ""}` : `${dateTime(entry.startsAt, entry.timezone)} – ${dateTime(entry.endsAt, entry.timezone)}`;
  return <article className={`team-availability-card availability-${entry.entryType}`}>
    <div><span className="schedule-type-label">{availabilityTypeLabel(entry.entryType)}</span><h3>{teamAvailabilityLabel(entry)}</h3><p>{member?.displayName ?? "Team member"} · {when}</p></div>
    <div className="availability-card-status"><span>{entry.privacy.replaceAll("_", " ")}</span>{conflict ? <b className="calendar-conflict-badge">Conflict</b> : null}</div>
    {entry.canEdit ? <button className="calendar-entry-open secondary-button" type="button" onClick={() => onOpen(entry)}>{entry.canRemove ? "View or edit" : "Correct schedule window"}</button> : null}
  </article>;
}

export function HqCalendar({ events, todayKey, unscheduledCount, teamMembers, availability, assignments, currentTeamMemberId, canManageTeam, canManageAssignments, upsertAvailabilityAction, removeAvailabilityAction, manageAssignmentAction, manageTeamMemberAction }: Props) {
  const [view, setView] = useState<View>("month");
  const [scope, setScope] = useState<"master" | "mine">("master");
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [agendaRange, setAgendaRange] = useState<AgendaRange>("30");
  const [teamFilter, setTeamFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(!currentTeamMemberId);
  const [editorEntry, setEditorEntry] = useState<TeamAvailability | null>(null);
  const [editorDate, setEditorDate] = useState(todayKey);
  const [editorAllDay, setEditorAllDay] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const days = useMemo(() => monthGrid(monthKey), [monthKey]);
  const members = useMemo(() => new Map(teamMembers.map((member) => [member.id, member])), [teamMembers]);
  const effectiveMemberFilter = scope === "mine" ? currentTeamMemberId : teamFilter === "all" ? null : teamFilter;
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => !effectiveMemberFilter || assignment.teamMemberId === effectiveMemberFilter), [assignments, effectiveMemberFilter]);
  const assignedEventIds = useMemo(() => new Set(visibleAssignments.map((assignment) => assignment.eventId)), [visibleAssignments]);
  const visibleEvents = useMemo(() => events.filter((event) => {
    if (effectiveMemberFilter && !assignedEventIds.has(event.id)) return false;
    return typeFilter === "all" || typeFilter === "event" && event.classification === "booked" || typeFilter === "tentative" && event.classification === "inquiry" || typeFilter === "assignment" && assignedEventIds.has(event.id);
  }), [assignedEventIds, effectiveMemberFilter, events, typeFilter]);
  const visibleAvailability = useMemo(() => availability.filter((entry) => {
    if (effectiveMemberFilter && entry.teamMemberId !== effectiveMemberFilter) return false;
    return typeFilter === "all" || typeFilter === entry.entryType;
  }), [availability, effectiveMemberFilter, typeFilter]);
  const conflicts = useMemo<ScheduleConflict[]>(() => detectScheduleConflicts({ availability, assignments, events, visibleTeamMemberId: currentTeamMemberId, canViewAll: canManageAssignments }) as ScheduleConflict[], [availability, assignments, events, currentTeamMemberId, canManageAssignments]);
  const conflicted = useMemo(() => conflictIds(conflicts), [conflicts]);
  const conflictEventIds = useMemo(() => new Set(assignments.filter((assignment) => conflicted.has(assignment.id)).map((assignment) => assignment.eventId)), [assignments, conflicted]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) if (event.dateKey) grouped.set(event.dateKey, [...(grouped.get(event.dateKey) ?? []), event]);
    return grouped;
  }, [visibleEvents]);
  const availabilityByDate = useMemo(() => {
    const grouped = new Map<string, TeamAvailability[]>();
    for (const entry of visibleAvailability) for (const key of availabilityDateKeys(entry)) grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    return grouped;
  }, [visibleAvailability]);
  const selectedAvailability = availabilityForDate(visibleEvents, selectedDate);
  const activeFilterCount = Number(teamFilter !== "all") + Number(typeFilter !== "all");
  const agenda = useMemo<CalendarEvent[]>(() => {
    if (agendaRange === "all") return visibleEvents.filter((event) => event.dateKey && event.dateKey >= todayKey).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    if (agendaRange === "month") return visibleEvents.filter((event) => event.dateKey?.startsWith(monthKey)).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    return agendaEvents(visibleEvents, todayKey, agendaRange === "today" ? 1 : Number(agendaRange));
  }, [agendaRange, visibleEvents, monthKey, todayKey]);
  const agendaAvailability = useMemo(() => visibleAvailability.filter((entry) => availabilityDateKeys(entry).some((key) => agendaRange === "month" ? key.startsWith(monthKey) : agendaRange === "all" ? key >= todayKey : key >= todayKey && key < new Date(new Date(`${todayKey}T00:00:00Z`).valueOf() + (agendaRange === "today" ? 1 : Number(agendaRange)) * 86_400_000).toISOString().slice(0, 10))), [visibleAvailability, agendaRange, monthKey, todayKey]);

  function chooseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setSelectedDate(value);
    setMonthKey(value.slice(0, 7));
  }

  function focusEditor() {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>("#calendar-entry-editor input:not([type='hidden']), #calendar-entry-editor select")?.focus();
      document.getElementById("calendar-entry-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function startEntry(value = selectedDate) {
    chooseDate(value);
    setEditorEntry(null);
    setEditorDate(value);
    setEditorAllDay(true);
    setEditorOpen(true);
    setEditorKey((key) => key + 1);
    focusEditor();
  }

  function openEntry(entry: TeamAvailability) {
    const entryDate = availabilityDateKeys(entry)[0] ?? selectedDate;
    chooseDate(entryDate);
    setEditorEntry(entry);
    setEditorDate(entryDate);
    setEditorAllDay(entry.allDay);
    setEditorOpen(true);
    setEditorKey((key) => key + 1);
    focusEditor();
  }

  function cancelEditor() {
    setEditorOpen(false);
    setEditorEntry(null);
  }

  function selectDay(value: string) {
    chooseDate(value);
    window.setTimeout(() => document.getElementById("selected-day-agenda")?.focus(), 0);
  }

  function indicatorsForDay(dayEvents: CalendarEvent[], dayAvailability: TeamAvailability[]) {
    const indicators: CalendarIndicator[] = [];
    for (const event of dayEvents) {
      indicators.push({ key: `event-${event.id}`, label: event.classification === "booked" ? "Confirmed EVENTSible event" : "Tentative event or inquiry", tone: event.classification === "booked" ? "event" : "tentative" });
      if (visibleAssignments.some((assignment) => assignment.eventId === event.id)) indicators.push({ key: `assignment-${event.id}`, label: "Staff assignment", tone: "assignment" });
      if (conflictEventIds.has(event.id)) indicators.push({ key: `event-conflict-${event.id}`, label: "Scheduling conflict", tone: "conflict" });
    }
    for (const entry of dayAvailability) {
      indicators.push({ key: `availability-${entry.id}`, label: availabilityTypeLabel(entry.entryType), tone: entry.entryType });
      if (conflicted.has(entry.id)) indicators.push({ key: `availability-conflict-${entry.id}`, label: "Scheduling conflict", tone: "conflict" });
    }
    return indicators;
  }

  return <div className="calendar-foundation">
    <div className="calendar-toolbar" role="group" aria-label="Calendar controls">
      <div className="calendar-month-control">
        <button className="calendar-icon-button" type="button" onClick={() => setMonthKey(moveMonth(monthKey, -1))} aria-label="Previous month"><span aria-hidden="true">‹</span></button>
        <h2 aria-live="polite">{monthTitle(monthKey)}</h2>
        <button className="calendar-icon-button" type="button" onClick={() => setMonthKey(moveMonth(monthKey, 1))} aria-label="Next month"><span aria-hidden="true">›</span></button>
        <button className="calendar-today-button" type="button" onClick={() => chooseDate(todayKey)}>Today</button>
      </div>
      <div className="calendar-toolbar-actions">
        <div className="calendar-view-switch" role="group" aria-label="Calendar scope"><button className={scope === "master" ? "active" : ""} onClick={() => setScope("master")} type="button" aria-label="Master calendar">Master</button><button className={scope === "mine" ? "active" : ""} onClick={() => setScope("mine")} type="button" aria-label="My schedule">Mine</button></div>
        <div className="calendar-view-switch" role="group" aria-label="Calendar view"><button className={view === "month" ? "active" : ""} onClick={() => setView("month")} type="button">Month</button><button className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")} type="button">Upcoming</button></div>
        <button className={`calendar-filter-toggle${activeFilterCount ? " active" : ""}`} type="button" aria-expanded={filtersOpen} aria-controls="calendar-filters" onClick={() => setFiltersOpen((open) => !open)}>Filter{activeFilterCount ? <span className="calendar-filter-count" aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span> : null}</button>
        <button className="calendar-quick-add" type="button" onClick={() => startEntry()}><span aria-hidden="true">+</span><span>Add</span></button>
      </div>
    </div>

    {view === "month" ? <div className="calendar-primary-layout"><section className="calendar-month panel" aria-labelledby="calendar-month-title"><header className="calendar-month-status"><h2 className="sr-only" id="calendar-month-title">{monthTitle(monthKey)}</h2><span className="status-dot">Event-local dates</span><span>{visibleEvents.length + visibleAvailability.length} visible items</span></header><div className="calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid" data-calendar-month-grid>{days.map((day) => {
      const dayEvents = eventsByDate.get(day.key) ?? [];
      const dayAvailability = availabilityByDate.get(day.key) ?? [];
      const totalItems = dayEvents.length + dayAvailability.length;
      const indicators = indicatorsForDay(dayEvents, dayAvailability);
      const visibleIndicators = indicators.slice(0, 3);
      const hiddenIndicatorCount = Math.max(0, indicators.length - visibleIndicators.length);
      return <article key={day.key} data-date-key={day.key} className={`calendar-day${day.inMonth ? "" : " outside"}${day.key === selectedDate ? " selected" : ""}${day.key === todayKey ? " today" : ""}`}><button type="button" className="calendar-day-number" onClick={() => totalItems ? selectDay(day.key) : startEntry(day.key)} aria-label={totalItems ? `Select ${dateTitle(day.key)}, ${totalItems} calendar item${totalItems === 1 ? "" : "s"}` : `Add calendar entry on ${dateTitle(day.key)}`} aria-pressed={day.key === selectedDate}>{day.day}</button>{day.inMonth ? <span className="calendar-day-state">{totalItems ? `${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}</span> : null}<div className="calendar-day-indicators" aria-label={`${totalItems} calendar item${totalItems === 1 ? "" : "s"}`}>{visibleIndicators.map((indicator) => <span className={`calendar-indicator indicator-${indicator.tone}`} title={indicator.label} aria-label={indicator.label} role="img" key={indicator.key} />)}{hiddenIndicatorCount ? <span className="calendar-indicator-overflow" aria-label={`${hiddenIndicatorCount} more indicators`}>+{hiddenIndicatorCount}</span> : null}</div></article>;
    })}</div><div className="calendar-compact-legend" aria-label="Calendar indicator legend"><span><i className="legend-event" />Confirmed</span><span><i className="legend-tentative" />Tentative</span><span><i className="legend-assignment" />Assigned</span><span><i className="legend-available" />Available</span><span><i className="legend-personal" />Unavailable</span><span><i className="legend-outside_booking" />Outside</span><span><i className="legend-vacation" />Vacation</span><span><i className="legend-reminder" />Reminder</span><span><i className="legend-note" />Note</span><span><i className="legend-conflict" />Conflict</span></div></section>
      <section className="date-checker panel calendar-selected-day" id="selected-day-agenda" tabIndex={-1} aria-labelledby="date-checker-title"><header className="panel-heading"><div><span className="eyebrow">Selected day</span><h2 id="date-checker-title">{dateTitle(selectedDate)}</h2></div><button className="primary-button" type="button" onClick={() => startEntry(selectedDate)}>Add entry</button></header><span className={`availability-badge ${selectedAvailability.state}`}>{selectedAvailability.booked.length ? selectedAvailability.label : "No booked event"}</span>{selectedAvailability.booked.map((event: CalendarEvent) => <EventSummary event={event} assignments={assignments} members={members} hasConflict={conflictEventIds.has(event.id)} key={event.id} />)}{selectedAvailability.inquiries.length ? <div className="date-check-results inquiry"><h3>Inquiries / tentative dates</h3>{selectedAvailability.inquiries.map((event: CalendarEvent) => <EventSummary event={event} assignments={assignments} members={members} hasConflict={conflictEventIds.has(event.id)} key={event.id} />)}</div> : null}{(availabilityByDate.get(selectedDate) ?? []).map((entry) => <AvailabilitySummary entry={entry} member={members.get(entry.teamMemberId)} conflict={conflicted.has(entry.id)} onOpen={openEntry} key={entry.id} />)}{!selectedAvailability.booked.length && !selectedAvailability.inquiries.length && !(availabilityByDate.get(selectedDate) ?? []).length ? <div className="calendar-empty-day"><p>No entries for this date.</p></div> : null}<p className="panel-note">No booked event is not a promise that the team, services, travel window, or equipment are available.</p></section>
    </div> : <section className="calendar-agenda panel" aria-labelledby="calendar-agenda-title"><header className="panel-heading"><div><span className="eyebrow">Upcoming</span><h2 id="calendar-agenda-title">Events and team availability</h2></div><label className="agenda-range">Range<select value={agendaRange} onChange={(event) => setAgendaRange(event.target.value as AgendaRange)}><option value="today">Today</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="month">This month</option><option value="all">All upcoming</option></select></label></header><div className="team-agenda-list">{agenda.map((event) => <EventSummary event={event} assignments={visibleAssignments} members={members} hasConflict={conflictEventIds.has(event.id)} key={event.id} />)}{agendaAvailability.map((entry) => <AvailabilitySummary entry={entry} member={members.get(entry.teamMemberId)} conflict={conflicted.has(entry.id)} onOpen={openEntry} key={entry.id} />)}{!agenda.length && !agendaAvailability.length ? <p className="calendar-empty">No schedule items fall in this range.</p> : null}</div></section>}

    {editorOpen ? <section className="calendar-add-panel panel" id="add-availability" aria-labelledby="calendar-add-title"><div id="calendar-entry-editor" className="calendar-entry-editor" tabIndex={-1}><header><div><span className="eyebrow">{editorEntry ? "Entry details" : "New calendar entry"}</span><h2 id="calendar-add-title">{editorEntry ? `Edit ${teamAvailabilityLabel(editorEntry)}` : dateTitle(editorDate)}</h2>{editorEntry && editorEntry.teamMemberId !== currentTeamMemberId ? <p>Editing {members.get(editorEntry.teamMemberId)?.displayName ?? "another team member"}&apos;s schedule window.</p> : null}</div><button className="secondary-button" type="button" onClick={cancelEditor}>Cancel</button></header><form action={upsertAvailabilityAction} className="calendar-form-grid" key={`${editorEntry?.id ?? "new"}-${editorDate}-${editorKey}`}><AvailabilityFields entry={editorEntry} defaultDate={editorDate} allDay={editorAllDay} setAllDay={setEditorAllDay} members={teamMembers} currentTeamMemberId={currentTeamMemberId} canManageTeam={canManageTeam} /><div className="calendar-form-actions calendar-field-wide"><button className="primary-button" type="submit">{editorEntry ? "Save changes" : "Save entry"}</button><button className="secondary-button" type="button" onClick={cancelEditor}>Cancel</button><span>Personal entries never create a lead, contact, booking, or EVENTSible event.</span></div></form>{editorEntry?.canRemove ? <form action={removeAvailabilityAction} className="calendar-remove-entry" onSubmit={(event) => { if (!window.confirm("Remove this calendar entry? This cannot be undone.")) event.preventDefault(); }}><input name="entry_id" type="hidden" value={editorEntry.id} /><button className="danger-button" type="submit">Remove entry</button></form> : null}</div></section> : null}

    <div className="calendar-filter-shell" id="calendar-filters" hidden={!filtersOpen}><div className="calendar-filter-bar" aria-label="Schedule filters"><label>Team member<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} disabled={scope === "mine"}><option value="all">Everyone</option>{teamMembers.filter((member) => member.status === "active").map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select></label><label>Schedule type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Everything</option><option value="event">Confirmed EVENTSible gigs</option><option value="tentative">Inquiries / tentative</option><option value="assignment">Staff assignments</option><option value="available">Available</option><option value="outside_booking">Outside bookings</option><option value="unavailable">Unavailable</option><option value="vacation">Vacation / time off</option><option value="reminder">Reminders</option><option value="note">Notes / ideas</option></select></label><label>Jump to date<input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} /></label><span className="calendar-legend"><span><i className="legend-event" />Confirmed</span><span><i className="legend-tentative" />Tentative</span><span><i className="legend-assignment" />Assigned</span><span><i className="legend-available" />Available</span><span><i className="legend-personal" />Busy</span><span><i className="legend-reminder" />Reminder</span><span><i className="legend-note" />Note</span></span></div></div>

    {conflicts.length ? <section className="calendar-conflicts panel" aria-labelledby="calendar-conflicts-title"><header className="panel-heading"><div><span className="eyebrow">Scheduling conflicts</span><h2 id="calendar-conflicts-title">{conflicts.length} overlap{conflicts.length === 1 ? " needs" : "s need"} attention</h2></div><span className="calendar-conflict-badge">Review</span></header><p>Conflicts use occupied time windows. Exact end/start boundaries do not conflict, and missing travel time is never invented.</p></section> : null}

    {canManageAssignments || canManageTeam ? <details className="calendar-owner-tools"><summary><span>Manage Team</span><small>Staff assignments and team records</small></summary><div className="calendar-owner-tools-content">
    {canManageAssignments ? <section className="calendar-owner-panel panel"><header className="panel-heading"><div><span className="eyebrow">Owner controls</span><h2>Staff assignments</h2></div></header><form action={manageAssignmentAction} className="calendar-form-grid"><input name="action" type="hidden" value="upsert" /><label>EVENTSible event<select name="event_id" required><option value="">Choose canonical event</option>{events.filter((event) => event.dateKey).map((event) => <option value={event.id} key={event.id}>{event.dateKey} · {event.title}</option>)}</select></label><label>Team member<select name="team_member_id" required><option value="">Choose team member</option>{teamMembers.filter((member) => member.status === "active").map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select></label><label>Assignment role<select name="assignment_role"><option value="dj">DJ</option><option value="mc">MC</option><option value="vocalist">Vocalist</option><option value="assistant">Assistant</option><option value="activity_helper">Activity helper</option><option value="operator">Operator</option><option value="other">Other</option></select></label><label>Call time<input name="call_time" type="datetime-local" /></label><input name="timezone" type="hidden" value="America/Indiana/Indianapolis" /><div className="calendar-field-wide calendar-form-actions"><button className="primary-button" type="submit">Assign team member</button></div></form>{assignments.length ? <div className="assignment-admin-list">{assignments.map((assignment) => <form action={manageAssignmentAction} key={assignment.id}><input name="action" type="hidden" value="remove" /><input name="assignment_id" type="hidden" value={assignment.id} /><span>{members.get(assignment.teamMemberId)?.displayName ?? "Team member"} · {events.find((event) => event.id === assignment.eventId)?.title ?? "Canonical event"} · {assignmentRoleLabel(assignment.assignmentRole)}</span><button className="secondary-button" type="submit">Remove assignment</button></form>)}</div> : <p className="calendar-empty">No active staff assignments are recorded.</p>}</section> : null}

    {canManageTeam && teamMembers.length ? <section className="calendar-owner-panel panel"><header className="panel-heading"><div><span className="eyebrow">Owner controls</span><h2>Team records</h2></div></header><div className="team-admin-list">{teamMembers.map((member) => <form action={manageTeamMemberAction} className="calendar-form-grid" key={member.id}><input name="team_member_id" type="hidden" value={member.id} /><label>Display name<input name="display_name" defaultValue={member.displayName} required /></label><label>Timezone<input name="timezone" defaultValue={member.timezone} required /></label><label>Status<select name="status" defaultValue={member.status}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button className="secondary-button" type="submit">Update member</button></form>)}</div></section> : null}
    </div></details> : null}

    {unscheduledCount ? <p className="calendar-warning"><b>{unscheduledCount} event{unscheduledCount === 1 ? "" : "s"} lack a start date.</b> They remain a data-completeness concern and are not assigned a fabricated date.</p> : null}
  </div>;
}
