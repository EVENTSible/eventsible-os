"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GigSaladSyncActionState, ImportActionState } from "@/app/admin/imports/actions";
import { EXISTING_GIG_NOTES_LIMIT, EXISTING_GIG_TIME_ZONES } from "@/lib/existing-gig-intake.mjs";

type ContactOption = { id: string; label: string; email: string | null; phone: string | null };
type ServiceOption = { id: string; code: string; name: string };
type EventOption = { id: string; label: string; startsAt: string | null };
type Candidate = {
  id: string;
  contract_version: string;
  source: string;
  external_reference: string;
  proposed_data: Record<string, unknown>;
  review_status: string;
  matched_event_id: string | null;
  imported_event_id: string | null;
  imported_contact_id: string | null;
  imported_booking_id: string | null;
  created_at: string;
};

type Props = {
  candidates: Candidate[];
  contacts: ContactOption[];
  services: ServiceOption[];
  events: EventOption[];
  todayKey: string;
  gigsaladConfigured: boolean;
  createAction: (state: ImportActionState, formData: FormData) => Promise<ImportActionState>;
  reviewAction: (state: ImportActionState, formData: FormData) => Promise<ImportActionState>;
  importAction: (state: ImportActionState, formData: FormData) => Promise<ImportActionState>;
  syncGigSaladAction: (state: GigSaladSyncActionState, formData: FormData) => Promise<GigSaladSyncActionState>;
};

const INITIAL: ImportActionState = { status: "idle", message: "" };
const SYNC_INITIAL: GigSaladSyncActionState = { status: "idle", message: "" };

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    : "Not supplied";
}

function dateTime(value: unknown, timeZone = "America/Indiana/Indianapolis") {
  if (!value) return "Not supplied";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
  } catch {
    return "Invalid date";
  }
}

function Message({ state }: { state: ImportActionState }) {
  return state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}{state.eventId ? <> <Link href={`/admin/gigs/${state.eventId}`}>Open Gig Workspace</Link></> : null}</p> : null;
}

function FieldError({ name, state }: { name: string; state: ImportActionState }) {
  return state.errors?.[name] ? <small className="field-error" id={`${name}-error`}>{state.errors[name]}</small> : null;
}

function GigSaladSourcePanel({ configured, syncAction }: { configured: boolean; syncAction: Props["syncGigSaladAction"] }) {
  const router = useRouter();
  async function submit(state: GigSaladSyncActionState, formData: FormData) {
    const next = await syncAction(state, formData);
    if (next.status === "success" && next.counts?.new) router.refresh();
    return next;
  }
  const [state, action, pending] = useActionState(submit, SYNC_INITIAL);
  const counts = state.counts;

  return <section className="panel intake-source-panel" aria-labelledby="gigsalad-source-heading">
    <header className="panel-heading">
      <div><span className="eyebrow">External source</span><h2 id="gigsalad-source-heading">GigSalad iCal</h2></div>
      <span className={`status-pill ${configured ? "success" : "warning"}`}>{configured ? "Configured" : "Not configured"}</span>
    </header>
    <p className="panel-note">Manual sync creates staff-private Import Review candidates only. It never creates contacts, events, bookings, services, or Calendar entries.</p>
    <form action={action} className="intake-source-actions">
      <button className="secondary-button" disabled={!configured || pending} type="submit">{pending ? "Syncing GigSalad…" : "Sync GigSalad"}</button>
    </form>
    {state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    {counts ? <dl className="intake-sync-counts">
      {Object.entries(counts).map(([name, count]) => <div key={name}><dt>{name.replaceAll("_", " ")}</dt><dd>{count}</dd></div>)}
    </dl> : null}
  </section>;
}

function ManualCandidateForm({ contacts, services, todayKey, createAction }: Pick<Props, "contacts" | "services" | "todayKey" | "createAction">) {
  const router = useRouter();
  const [contactMode, setContactMode] = useState<"reuse" | "create">(contacts.length ? "reuse" : "create");
  const formRef = useRef<HTMLFormElement>(null);
  async function submit(state: ImportActionState, formData: FormData) {
    const next = await createAction(state, formData);
    if (next.status === "success") {
      formRef.current?.reset();
      setContactMode(contacts.length ? "reuse" : "create");
      router.refresh();
    }
    return next;
  }
  const [state, action, pending] = useActionState(submit, INITIAL);

  return <form action={action} className="intake-form" ref={formRef}>
    <div className="intake-form-grid">
      <label><span>Event title</span><input aria-invalid={Boolean(state.errors?.event_title)} maxLength={180} name="event_title" required /><FieldError name="event_title" state={state} /></label>
      <label><span>Event type</span><input aria-invalid={Boolean(state.errors?.event_type)} maxLength={80} name="event_type" placeholder="Wedding, school dance, corporate event…" required /><FieldError name="event_type" state={state} /></label>
      <label><span>Date</span><input defaultValue={todayKey} name="event_date" required type="date" /></label>
      <label><span>Start</span><input aria-invalid={Boolean(state.errors?.start_time)} name="start_time" required type="time" /><FieldError name="start_time" state={state} /></label>
      <label><span>End</span><input aria-invalid={Boolean(state.errors?.end_time)} name="end_time" type="time" /><FieldError name="end_time" state={state} /></label>
      <label><span>Timezone</span><select defaultValue="America/Indiana/Indianapolis" name="timezone">{EXISTING_GIG_TIME_ZONES.map((zone: string) => <option key={zone}>{zone}</option>)}</select><FieldError name="timezone" state={state} /></label>
      <label><span>Venue</span><input maxLength={180} name="venue_name" /></label>
      <label><span>Address</span><input maxLength={200} name="venue_address_1" /></label>
      <label><span>Address line 2</span><input maxLength={160} name="venue_address_2" /></label>
      <label><span>City</span><input maxLength={120} name="venue_city" /></label>
      <label><span>State</span><input maxLength={80} name="venue_state" /></label>
      <label><span>Postal code</span><input maxLength={24} name="venue_postal_code" /></label>
      <fieldset className="intake-contact-mode">
        <legend>Contact decision</legend>
        <div className="intake-choice-row">
          <label><input checked={contactMode === "reuse"} name="contact_mode" onChange={() => setContactMode("reuse")} type="radio" value="reuse" /> Reuse canonical contact</label>
          <label><input checked={contactMode === "create"} name="contact_mode" onChange={() => setContactMode("create")} type="radio" value="create" /> Create reviewed contact</label>
        </div>
        <FieldError name="contact_mode" state={state} />
      </fieldset>
      {contactMode === "reuse" ? <label className="intake-span"><span>Existing contact</span><select aria-invalid={Boolean(state.errors?.contact_id)} defaultValue="" name="contact_id" required><option disabled value="">Choose a contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.label}{contact.email ? ` · ${contact.email}` : contact.phone ? " · phone on file" : ""}</option>)}</select><FieldError name="contact_id" state={state} /></label> : <>
        <label><span>New contact name</span><input aria-invalid={Boolean(state.errors?.contact_display_name)} maxLength={160} name="contact_display_name" required /><FieldError name="contact_display_name" state={state} /></label>
        <label><span>New contact email</span><input aria-invalid={Boolean(state.errors?.contact_email)} maxLength={254} name="contact_email" type="email" /><FieldError name="contact_email" state={state} /></label>
        <label><span>New contact phone</span><input maxLength={40} name="contact_phone" type="tel" /></label>
      </>}
      <fieldset className="intake-span intake-services">
        <legend>Canonical services</legend>
        <div>{services.map((service) => <label key={service.id}><input name="service_ids" type="checkbox" value={service.id} /> <span><b>{service.name}</b><small>{service.code}</small></span></label>)}</div>
        <FieldError name="service_ids" state={state} />
      </fieldset>
      <label><span>Booked amount</span><input aria-invalid={Boolean(state.errors?.booked_amount)} max="1000000" min="0" name="booked_amount" step="0.01" type="number" /><FieldError name="booked_amount" state={state} /></label>
      <label className="intake-span"><span>Intake notes</span><textarea aria-invalid={Boolean(state.errors?.notes)} maxLength={EXISTING_GIG_NOTES_LIMIT} name="notes" rows={4} /><FieldError name="notes" state={state} /><small>Candidate review only; this does not create a general event note.</small></label>
    </div>
    <FieldError name="form" state={state} />
    <Message state={state} />
    <div className="intake-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? "Adding candidate…" : "Add to Import Review"}</button><button className="secondary-button" disabled={pending} onClick={() => formRef.current?.reset()} type="button">Reset</button></div>
  </form>;
}

function CandidateCard({ candidate, services, events, reviewAction, importAction }: { candidate: Candidate } & Pick<Props, "services" | "events" | "reviewAction" | "importAction">) {
  const router = useRouter();
  const proposal = plainObject(candidate.proposed_data);
  const event = plainObject(proposal.event);
  const contact = plainObject(proposal.contact);
  const serviceIds = Array.isArray(proposal.service_ids) ? proposal.service_ids.map(String) : [];
  const warnings = Array.isArray(proposal.match_warnings) ? proposal.match_warnings.map(plainObject) : [];
  const conflicts = Array.isArray(proposal.date_conflicts) ? proposal.date_conflicts.map(plainObject) : [];
  const missing = Array.isArray(proposal.missing_fields) ? proposal.missing_fields.map(String) : [];
  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  async function refreshAfter(action: (state: ImportActionState, data: FormData) => Promise<ImportActionState>, state: ImportActionState, data: FormData) {
    const next = await action(state, data);
    if (next.status === "success") router.refresh();
    return next;
  }
  const [reviewState, reviewFormAction, reviewPending] = useActionState(refreshAfter.bind(null, reviewAction), INITIAL);
  const [importState, importFormAction, importPending] = useActionState(refreshAfter.bind(null, importAction), INITIAL);
  const status = candidate.review_status.replaceAll("_", " ");
  const canonicalLink = candidate.imported_event_id ?? candidate.matched_event_id;
  const address = [event.venue_address_1, event.venue_city, event.venue_state].map(stringValue).filter(Boolean).join(", ");

  return <article className={`intake-candidate intake-candidate-${candidate.review_status}`}>
    <header><div><span className="eyebrow">{candidate.source}</span><h3>{stringValue(event.title) ?? "Untitled candidate"}</h3></div><span className="status-pill">{status}</span></header>
    <div className="intake-candidate-grid">
      <div><span>Date / time</span><b>{dateTime(event.starts_at, stringValue(event.timezone) ?? undefined)}</b><small>{event.ends_at ? `Ends ${dateTime(event.ends_at, stringValue(event.timezone) ?? undefined)}` : "End not supplied"}</small></div>
      <div><span>Venue / location</span><b>{stringValue(event.venue_name) ?? stringValue(event.venue_address_1) ?? "Not supplied"}</b><small>{stringValue(event.venue_name) ? address || "Address not supplied" : address ? "Source address evidence" : "Address not supplied"}</small></div>
      <div><span>Contact decision</span><b>{contact.mode === "reuse" ? "Reuse canonical contact" : stringValue(contact.display_name) ?? "Create reviewed contact"}</b><small>{contact.mode === "reuse" ? "Selected by canonical ID" : contact.primary_email ? "Email supplied" : contact.primary_phone ? "Phone supplied" : "Contact channel missing"}</small></div>
      <div><span>Booked amount</span><b>{money(proposal.booked_amount)}</b><small>{selectedServices.length ? selectedServices.map((service) => service.name).join(", ") : "No valid services selected"}</small></div>
    </div>
    {missing.length ? <p className="intake-notice"><b>Missing:</b> {missing.join(", ")}</p> : null}
    {warnings.length ? <div className="intake-warning"><b>Potential existing match</b>{warnings.map((warning, index) => <p key={`${warning.event_id}-${index}`}>{stringValue(warning.reason)}{warning.event_id ? <> <Link href={`/admin/gigs/${warning.event_id}`}>Review event</Link></> : null}</p>)}</div> : null}
    {conflicts.length ? <div className="intake-warning"><b>Date conflict warning</b><p>{conflicts.length} existing booked event{conflicts.length === 1 ? "" : "s"} share this event-local date. No availability conclusion was made.</p></div> : null}
    <details className="intake-source-details"><summary>Source details</summary><dl><div><dt>Contract</dt><dd>{candidate.contract_version}</dd></div><div><dt>External reference</dt><dd>{candidate.external_reference}</dd></div><div><dt>Created</dt><dd>{dateTime(candidate.created_at)}</dd></div></dl></details>
    {canonicalLink ? <p className="intake-canonical-link"><Link className="primary-button" href={`/admin/gigs/${canonicalLink}`}>{candidate.imported_event_id ? "Open imported Gig Workspace" : "Open matched Gig Workspace"}</Link></p> : null}
    {candidate.review_status !== "imported" ? <div className="intake-review-controls">
      {candidate.review_status === "pending" ? <form action={importFormAction}><input name="candidate_id" type="hidden" value={candidate.id} /><button className="primary-button" disabled={importPending} type="submit">{importPending ? "Importing atomically…" : "Import as New Gig"}</button></form> : null}
      {candidate.review_status === "pending" ? <form action={reviewFormAction}><input name="candidate_id" type="hidden" value={candidate.id} /><input name="decision" type="hidden" value="review_later" /><button className="secondary-button" disabled={reviewPending} type="submit">Review Later</button></form> : <form action={reviewFormAction}><input name="candidate_id" type="hidden" value={candidate.id} /><input name="decision" type="hidden" value="pending" /><button className="secondary-button" disabled={reviewPending} type="submit">Return to Pending</button></form>}
      {candidate.review_status !== "ignored" ? <form action={reviewFormAction}><input name="candidate_id" type="hidden" value={candidate.id} /><input name="decision" type="hidden" value="ignored" /><button className="secondary-button" disabled={reviewPending} type="submit">Ignore / Skip</button></form> : null}
      {candidate.review_status === "pending" || candidate.review_status === "review_later" ? <form action={reviewFormAction} className="intake-match-form"><input name="candidate_id" type="hidden" value={candidate.id} /><input name="decision" type="hidden" value="matched" /><label><span>Match existing gig</span><select defaultValue="" name="matched_event_id" required><option disabled value="">Choose canonical event</option>{events.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="secondary-button" disabled={reviewPending} type="submit">Match Existing</button></form> : null}
    </div> : null}
    <Message state={importState.status !== "idle" ? importState : reviewState} />
  </article>;
}

export function ExistingGigImportReview(props: Props) {
  const [adding, setAdding] = useState(false);
  return <div className="intake-foundation">
    <GigSaladSourcePanel configured={props.gigsaladConfigured} syncAction={props.syncGigSaladAction} />
    <section className="panel intake-add-panel">
      <header className="panel-heading"><div><span className="eyebrow">Manual Add Existing Gig</span><h2>Create a reviewed proposal first</h2></div><button className="secondary-button" onClick={() => setAdding((current) => !current)} type="button" aria-expanded={adding}>{adding ? "Close form" : "Add Existing Gig"}</button></header>
      <p className="panel-note">This step creates a staff-private candidate only. A canonical gig is created only after a separate Import as New Gig decision.</p>
      {adding ? <ManualCandidateForm contacts={props.contacts} createAction={props.createAction} services={props.services} todayKey={props.todayKey} /> : null}
    </section>
    <section className="intake-review-list" aria-labelledby="import-review-heading">
      <div className="intake-review-heading"><div><span className="eyebrow">Import Review</span><h2 id="import-review-heading">Human-reviewed candidates</h2></div><span className="status-dot">{props.candidates.length} candidate{props.candidates.length === 1 ? "" : "s"}</span></div>
      {props.candidates.length ? props.candidates.map((candidate) => <CandidateCard candidate={candidate} events={props.events} importAction={props.importAction} key={candidate.id} reviewAction={props.reviewAction} services={props.services} />) : <div className="empty-state compact"><div className="empty-icon">＋</div><h3>No import candidates yet.</h3><p>Add an already-booked gig as a proposal. Nothing imports automatically.</p></div>}
    </section>
  </div>;
}
