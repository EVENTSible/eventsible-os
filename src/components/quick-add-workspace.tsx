"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { QuickAddState } from "@/app/admin/quick-add/actions";

type Row = Record<string, unknown>;
type QuickType = "contact" | "lead" | "event" | "booking" | "note";
type Action = (state: QuickAddState, form: FormData) => Promise<QuickAddState>;
type Props = { action: Action; contacts: Row[]; events: Row[]; leads: Row[]; bookings: Row[]; services: Row[]; initialType: string };

const INITIAL: QuickAddState = { status: "idle", message: "" };
const text = (row: Row, key: string) => String(row[key] ?? "");
const TYPES: { id: QuickType; label: string; description: string }[] = [
  { id: "contact", label: "Contact", description: "Add a person or organization" },
  { id: "lead", label: "Lead", description: "Record a new inquiry" },
  { id: "event", label: "Gig / Event", description: "Put a real event on the books" },
  { id: "booking", label: "Booking", description: "Start a booking for an event" },
  { id: "note", label: "Note", description: "Attach a business note" },
];

function useQuickAddForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [operationId, setOperationId] = useState("");
  const completedOperationId = state.status === "success" ? String(state.result?.operationId ?? "") : "";
  useEffect(() => {
    if (operationId && completedOperationId !== operationId) return;
    const nextOperationId = crypto.randomUUID();
    const timer = window.setTimeout(() => setOperationId(nextOperationId), 0);
    return () => window.clearTimeout(timer);
  }, [completedOperationId, operationId]);
  return { state, formAction, pending, operationId };
}

function OperationId({ value }: { value: string }) {
  return <input name="operation_id" type="hidden" value={value} />;
}

function Feedback({ state }: { state: QuickAddState }) {
  if (state.status === "idle") return null;
  const warnings = Array.isArray(state.result?.duplicateWarnings) ? state.result.duplicateWarnings as Row[] : [];
  return <div className={`quick-feedback ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
    <b>{state.message}</b>
    {warnings.length ? <ul>{warnings.map((warning, index) => <li key={`${text(warning,"recordId")}-${index}`}>
      {text(warning,"label") || "Existing record"} · {text(warning,"status") || "status not provided"} ({text(warning,"kind").replaceAll("_"," ")})
    </li>)}</ul> : null}
    {state.status === "success" ? <ResultLink result={state.result ?? {}} /> : null}
  </div>;
}

function ResultLink({ result }: { result: Record<string, unknown> }) {
  const eventId = String(result.eventId ?? "");
  if (eventId) return <Link className="secondary-button compact-button" href={`/admin/gigs/${eventId}`}>Open canonical gig</Link>;
  const leadId = String(result.leadId ?? "");
  if (leadId) return <Link className="secondary-button compact-button" href="/admin#lead-review">Open Lead review</Link>;
  return <Link className="secondary-button compact-button" href="/admin/data-readiness">Open Records</Link>;
}

function ContactFields({ prefix = "" }: { prefix?: string }) {
  const name = (value: string) => `${prefix}${value}`;
  return <div className="quick-grid">
    <label className="span"><span>Display name *</span><input autoComplete="name" name={name("display_name")} required /></label>
    <label><span>First name</span><input autoComplete="given-name" name={name("first_name")} /></label>
    <label><span>Last name</span><input autoComplete="family-name" name={name("last_name")} /></label>
    <label><span>Organization</span><input autoComplete="organization" name={name("organization")} /></label>
    <label><span>Email</span><input autoComplete="email" inputMode="email" name={name("email")} type="email" /></label>
    <label><span>Phone</span><input autoComplete="tel" inputMode="tel" name={name("phone")} type="tel" /></label>
    <label><span>Preferred contact</span><select defaultValue="email" name={name("preferred_channel")}><option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option><option value="portal">Portal</option></select></label>
    <label className="span"><span>Notes</span><textarea name={name("notes")} rows={3} /></label>
    <p className="quick-hint span">Enter at least an email or phone. HQ checks active and archived contacts before saving.</p>
  </div>;
}

function ContactForm({ action }: { action: Action }) {
  const { state, formAction, pending, operationId } = useQuickAddForm(action);
  return <form action={formAction} className="quick-form"><input name="record_type" type="hidden" value="contact" /><OperationId value={operationId} /><ContactFields />
    {state.status === "warning" ? <label className="quick-confirm"><input name="confirm_duplicates" type="checkbox" value="true" required /><span>I reviewed the likely match and this is a different contact.</span></label> : null}
    <button className="primary-button quick-submit" disabled={pending || !operationId}>{pending ? "Saving…" : state.status === "warning" ? "Create separate contact" : "Save contact"}</button><Feedback state={state} />
  </form>;
}

function ContactSelect({ contacts, name = "contact_id", required = true }: { contacts: Row[]; name?: string; required?: boolean }) {
  return <select name={name} required={required} defaultValue=""><option value="">Choose a contact…</option>{contacts.map((contact) => <option key={text(contact,"id")} value={text(contact,"id")}>{text(contact,"display_name") || text(contact,"organization_name")}</option>)}</select>;
}

function LeadForm({ action, contacts }: { action: Action; contacts: Row[] }) {
  const { state, formAction, pending, operationId } = useQuickAddForm(action);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  return <form action={formAction} className="quick-form"><input name="record_type" type="hidden" value="lead" /><OperationId value={operationId} /><input name="contact_mode" type="hidden" value={mode} />
    <div className="quick-choice" role="group" aria-label="Lead contact"><button className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")} type="button">Existing contact</button><button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")} type="button">New contact</button></div>
    {mode === "existing" ? <label><span>Contact *</span><ContactSelect contacts={contacts} /></label> : <fieldset><legend>Quick-create contact</legend><ContactFields prefix="new_contact_" /></fieldset>}
    <div className="quick-grid"><label><span>Source</span><input defaultValue="Owner / direct inquiry" name="source" /></label><label><span>Status</span><select defaultValue="new" name="status"><option value="new">New</option><option value="qualifying">Qualifying</option><option value="follow_up">Follow up</option><option value="quoted">Quoted</option></select></label><label><span>Next follow-up</span><input name="next_follow_up_at" type="date" /></label><label className="span"><span>What do they want? *</span><textarea name="summary" required rows={3} placeholder="Birthday karaoke, date still being confirmed…" /></label><label className="span"><span>Internal note</span><textarea name="notes" rows={2} /></label></div>
    {state.status === "warning" ? <label className="quick-confirm"><input name="confirm_duplicates" type="checkbox" value="true" required /><span>I reviewed the likely match and intend to create this separate inquiry.</span></label> : null}
    <button className="primary-button quick-submit" disabled={pending || !operationId}>{pending ? "Saving…" : state.status === "warning" ? "Create separate lead" : "Save lead"}</button><Feedback state={state} />
  </form>;
}

function ServiceChoices({ services }: { services: Row[] }) {
  return <details className="quick-services"><summary>Add services (optional)</summary><div>{services.map((service) => <label key={text(service,"id")}><input name="service_ids" type="checkbox" value={text(service,"id")} /><span><b>{text(service,"name")}</b><small>{text(service,"category")}</small></span></label>)}</div></details>;
}

function EventForm({ action, contacts, services }: { action: Action; contacts: Row[]; services: Row[] }) {
  const { state, formAction, pending, operationId } = useQuickAddForm(action);
  const [timed, setTimed] = useState(false);
  return <form action={formAction} className="quick-form"><input name="record_type" type="hidden" value="event" /><OperationId value={operationId} />
    <div className="quick-grid"><label className="span"><span>Gig / event title *</span><input name="title" required /></label><label><span>Client contact *</span><ContactSelect contacts={contacts} /></label><label><span>Event type *</span><input name="event_type" required placeholder="birthday_party, wedding…" /></label><label><span>Status</span><select defaultValue="inquiry" name="status"><option value="inquiry">Inquiry</option><option value="pending">Pending</option><option value="booked">Booked</option><option value="planning">Planning</option><option value="active">Active</option><option value="completed">Completed</option></select></label><label><span>Date *</span><input name="event_date" required type="date" /></label><label className="quick-toggle"><input checked={timed} onChange={(event) => setTimed(event.target.checked)} type="checkbox" /><span>I know the time</span></label>{timed ? <><label><span>Start time *</span><input name="start_time" required type="time" /></label><label><span>End time</span><input name="end_time" type="time" /></label><label><span>Event timezone *</span><select defaultValue="America/Indiana/Indianapolis" name="timezone"><option value="America/Indiana/Indianapolis">Indiana (Eastern)</option><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option></select></label></> : <p className="quick-hint span">Only the date will be stored. HQ will not invent midnight or a timezone.</p>}<label><span>Venue</span><input name="venue_name" /></label><label><span>Address</span><input name="venue_address_1" /></label><label><span>Address 2</span><input name="venue_address_2" /></label><label><span>City</span><input name="venue_city" /></label><label><span>State</span><input name="venue_state" /></label><label><span>Postal code</span><input name="venue_postal_code" /></label><label><span>Guest count</span><input min="0" name="guest_count" type="number" /></label><label className="span"><span>Notes</span><textarea name="notes" rows={3} /></label></div><ServiceChoices services={services} />
    {state.status === "warning" ? <label className="quick-confirm"><input name="confirm_duplicates" type="checkbox" value="true" required /><span>I reviewed the likely match and this is a different gig.</span></label> : null}
    <button className="primary-button quick-submit" disabled={pending || !operationId}>{pending ? "Saving…" : state.status === "warning" ? "Create separate gig" : "Save gig"}</button><Feedback state={state} />
  </form>;
}

function BookingForm({ action, events, services }: { action: Action; events: Row[]; services: Row[] }) {
  const { state, formAction, pending, operationId } = useQuickAddForm(action);
  return <form action={formAction} className="quick-form"><input name="record_type" type="hidden" value="booking" /><OperationId value={operationId} /><div className="quick-grid"><label className="span"><span>Gig / event *</span><select defaultValue="" name="event_id" required><option value="">Choose an event…</option>{events.map((event) => <option key={text(event,"id")} value={text(event,"id")}>{text(event,"title")} · {text(event,"status")}</option>)}</select></label><label><span>Booking status</span><select defaultValue="pending" name="status"><option value="pending">Pending</option><option value="pending_contract">Pending contract</option><option value="pending_deposit">Pending deposit</option><option value="confirmed">Confirmed</option></select></label><label><span>Contracted amount</span><input inputMode="decimal" min="0" name="contracted_amount" placeholder="Leave blank if unknown" step="0.01" type="number" /></label><label><span>Payment status</span><select defaultValue="" name="payment_status"><option value="">Unknown / not entered</option><option value="unpaid">Unpaid</option><option value="deposit_due">Deposit due</option><option value="deposit_paid">Deposit paid</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></label><label className="span"><span>Booking note</span><textarea name="notes" rows={3} /></label></div><ServiceChoices services={services} /><p className="quick-hint">Zero services is valid. Quick Add never invents a deposit, receipt, invoice, or balance.</p><button className="primary-button quick-submit" disabled={pending || !operationId}>{pending ? "Saving…" : "Save booking"}</button><Feedback state={state} /></form>;
}

function NoteForm({ action, contacts, events, leads, bookings }: { action: Action; contacts: Row[]; events: Row[]; leads: Row[]; bookings: Row[] }) {
  const { state, formAction, pending, operationId } = useQuickAddForm(action);
  const [entityType, setEntityType] = useState<"contact" | "lead" | "event" | "booking">("event");
  const choices = useMemo(() => entityType === "contact" ? contacts.map((row) => ({ id:text(row,"id"), label:text(row,"display_name") })) : entityType === "event" ? events.map((row) => ({ id:text(row,"id"), label:text(row,"title") })) : entityType === "lead" ? leads.map((row) => ({ id:text(row,"id"), label:text(row,"inquiry_summary") || `Lead · ${text(row,"status")}` })) : bookings.map((row) => ({ id:text(row,"id"), label:`${text(events.find((event) => text(event,"id") === text(row,"event_id")) ?? {},"title") || "Booking"} · ${text(row,"status")}` })), [entityType,contacts,events,leads,bookings]);
  return <form action={formAction} className="quick-form"><input name="record_type" type="hidden" value="note" /><OperationId value={operationId} /><div className="quick-grid"><label><span>Record type</span><select name="entity_type" value={entityType} onChange={(event) => setEntityType(event.target.value as typeof entityType)}><option value="contact">Contact</option><option value="lead">Lead</option><option value="event">Gig / event</option><option value="booking">Booking</option></select></label><label className="span"><span>Attach to *</span><select defaultValue="" key={entityType} name="entity_id" required><option value="">Choose a record…</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label className="span"><span>Business note *</span><textarea name="body" required rows={5} placeholder="Record the fact in plain language…" /></label></div><button className="primary-button quick-submit" disabled={pending || !operationId}>{pending ? "Saving…" : "Save note"}</button><Feedback state={state} /></form>;
}

export function QuickAddWorkspace({ action, contacts, events, leads, bookings, services, initialType }: Props) {
  const [type, setType] = useState<QuickType>((TYPES.some((item) => item.id === initialType) ? initialType : "contact") as QuickType);
  return <div className="admin-main quick-add-main"><header className="admin-header compact"><div><span className="eyebrow">Owner truth</span><h1>Quick Add</h1><p>Save an ordinary business fact directly to EVENTSible HQ. Imports and forensic tools stay out of the way.</p></div><Link className="secondary-button" href="/admin">Back to Mission Control</Link></header>
    <nav aria-label="Quick Add record type" className="quick-type-grid">{TYPES.map((item) => <button aria-current={type === item.id ? "page" : undefined} className={type === item.id ? "active" : ""} key={item.id} onClick={() => setType(item.id)}><b>{item.label}</b><span>{item.description}</span></button>)}</nav>
    <section className="panel quick-add-panel"><div className="panel-heading"><div><span className="eyebrow">New canonical record</span><h2>Add {TYPES.find((item) => item.id === type)?.label}</h2></div><span className="status-dot">Owner only</span></div>
      {type === "contact" ? <ContactForm action={action} /> : null}
      {type === "lead" ? <LeadForm action={action} contacts={contacts} /> : null}
      {type === "event" ? <EventForm action={action} contacts={contacts} services={services} /> : null}
      {type === "booking" ? <BookingForm action={action} events={events} services={services} /> : null}
      {type === "note" ? <NoteForm action={action} bookings={bookings} contacts={contacts} events={events} leads={leads} /> : null}
    </section></div>;
}
