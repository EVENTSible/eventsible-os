"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { agendaEvents, availabilityForDate, monthGrid } from "@/lib/hq-calendar.mjs";

export type CalendarEvent = {
  id: string;
  title: string;
  eventType: string;
  eventStatus: string;
  bookingStatus: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  dateKey: string | null;
  startLabel: string;
  endLabel: string | null;
  venue: string | null;
  services: string[];
  classification: "booked" | "inquiry" | "other";
};

type View = "month" | "agenda";
type AgendaRange = "today" | "7" | "30" | "month" | "all";

function moveMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

function monthTitle(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function dateTitle(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T00:00:00Z`));
}

function EventSummary({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <Link className={`calendar-event calendar-event-${event.classification}${compact ? " compact" : ""}`} href={`/admin/gigs/${event.id}`}>
      <span className="calendar-event-time">{event.startLabel}</span>
      <b>{event.title}</b>
      {!compact ? <small>{event.services.length ? event.services.join(", ") : event.eventType}{event.venue ? ` · ${event.venue}` : ""}</small> : null}
    </Link>
  );
}

export function HqCalendar({ events, todayKey, unscheduledCount }: { events: CalendarEvent[]; todayKey: string; unscheduledCount: number }) {
  const [view, setView] = useState<View>("month");
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [agendaRange, setAgendaRange] = useState<AgendaRange>("30");
  const days = useMemo(() => monthGrid(monthKey), [monthKey]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.dateKey) continue;
      grouped.set(event.dateKey, [...(grouped.get(event.dateKey) ?? []), event]);
    }
    return grouped;
  }, [events]);
  const selectedAvailability = availabilityForDate(events, selectedDate);
  const agenda = useMemo<CalendarEvent[]>(() => {
    if (agendaRange === "all") return events.filter((event) => event.dateKey && event.dateKey >= todayKey).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    if (agendaRange === "month") {
      const nextMonth = moveMonth(monthKey, 1);
      return events.filter((event) => event.dateKey && event.dateKey >= `${monthKey}-01` && event.dateKey < `${nextMonth}-01`).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    }
    return agendaEvents(events, todayKey, agendaRange === "today" ? 1 : Number(agendaRange));
  }, [agendaRange, events, monthKey, todayKey]);

  function chooseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setSelectedDate(value);
    setMonthKey(value.slice(0, 7));
  }

  return (
    <div className="calendar-foundation">
      <div className="calendar-toolbar" aria-label="Calendar controls">
        <div className="calendar-view-switch" role="group" aria-label="Calendar view">
          <button type="button" className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
          <button type="button" className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")}>Agenda</button>
        </div>
        <div className="calendar-navigation">
          <button type="button" onClick={() => setMonthKey(moveMonth(monthKey, -1))} aria-label="Previous month">Previous</button>
          <button type="button" onClick={() => chooseDate(todayKey)}>Today</button>
          <button type="button" onClick={() => setMonthKey(moveMonth(monthKey, 1))} aria-label="Next month">Next</button>
          <label>Jump to date<input type="date" value={selectedDate} onChange={(event) => chooseDate(event.target.value)} /></label>
        </div>
      </div>

      {view === "month" ? (
        <section className="calendar-month panel" aria-labelledby="calendar-month-title">
          <header className="panel-heading"><div><span className="eyebrow">Month</span><h2 id="calendar-month-title">{monthTitle(monthKey)}</h2></div><span className="status-dot">Event-local dates</span></header>
          <div className="calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {days.map((day) => {
              const dayEvents = eventsByDate.get(day.key) ?? [];
              const availability = availabilityForDate(events, day.key);
              return (
                <article key={day.key} className={`calendar-day${day.inMonth ? "" : " outside"}${day.key === selectedDate ? " selected" : ""}`}>
                  <button type="button" className="calendar-day-number" onClick={() => chooseDate(day.key)} aria-label={`Check ${dateTitle(day.key)}`}>{day.day}</button>
                  {day.inMonth ? <span className={`calendar-day-state ${availability.state}`}>{availability.booked.length ? availability.booked.length : availability.inquiries.length ? `${availability.inquiries.length} inquiry` : ""}</span> : null}
                  <div className="calendar-day-events">{dayEvents.slice(0, 3).map((event: CalendarEvent) => <EventSummary event={event} compact key={event.id} />)}{dayEvents.length > 3 ? <button type="button" onClick={() => { chooseDate(day.key); setView("agenda"); }}>+{dayEvents.length - 3} more</button> : null}</div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="calendar-agenda panel" aria-labelledby="calendar-agenda-title">
          <header className="panel-heading"><div><span className="eyebrow">Date Book</span><h2 id="calendar-agenda-title">Upcoming events</h2></div><label className="agenda-range">Range<select value={agendaRange} onChange={(event) => setAgendaRange(event.target.value as AgendaRange)}><option value="today">Today</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="month">This month</option><option value="all">All upcoming</option></select></label></header>
          {agenda.length ? <div className="agenda-list">{agenda.map((event: CalendarEvent) => <article key={event.id} className="agenda-item"><div className="agenda-date"><b>{event.dateKey ? dateTitle(event.dateKey) : "Date missing"}</b><span>{event.startLabel}{event.endLabel ? ` – ${event.endLabel}` : ""}</span></div><EventSummary event={event} /><span className={`agenda-classification ${event.classification}`}>{event.classification === "booked" ? "Booked" : event.classification === "inquiry" ? "Inquiry / hold" : "Scheduled"}</span></article>)}</div> : <p className="calendar-empty">No canonical events fall in this range.</p>}
        </section>
      )}

      <section className="date-checker panel" aria-labelledby="date-checker-title">
        <header className="panel-heading"><div><span className="eyebrow">Booked / open quick view</span><h2 id="date-checker-title">{dateTitle(selectedDate)}</h2></div><span className={`availability-badge ${selectedAvailability.state}`}>{selectedAvailability.label}</span></header>
        <p className="panel-note">Open means no canonical confirmed/booked event occupies this date. It does not promise partial-day, staff, service, travel, or equipment availability.</p>
        {selectedAvailability.booked.length ? <div className="date-check-results"><h3>Confirmed / booked</h3>{selectedAvailability.booked.map((event: CalendarEvent) => <EventSummary event={event} key={event.id} />)}</div> : null}
        {selectedAvailability.inquiries.length ? <div className="date-check-results inquiry"><h3>Inquiries / holds (not booked)</h3>{selectedAvailability.inquiries.map((event: CalendarEvent) => <EventSummary event={event} key={event.id} />)}</div> : null}
        {!selectedAvailability.scheduled.length ? <p className="calendar-empty">No scheduled canonical event is recorded for this date.</p> : null}
      </section>

      {unscheduledCount ? <p className="calendar-warning"><b>{unscheduledCount} event{unscheduledCount === 1 ? "" : "s"} lack a start date.</b> They are excluded from the calendar and remain a data-completeness concern in their canonical workspace.</p> : null}
    </div>
  );
}
