"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { OpportunityState } from "./actions";

type Choice = { id: string; display_name: string | null; primary_email?: string | null; primary_phone?: string | null };
type Lead = { id: string; contact_id: string; status: string; source: string | null; inquiry_summary: string | null };
type Props = { action: (state: OpportunityState, form: FormData) => Promise<OpportunityState>; contacts: Choice[]; staff: Choice[]; leads: Lead[] };
const INITIAL: OpportunityState = { status: "idle", message: "" };

export function OpportunityForm({ action, contacts, staff, leads }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [operationId, setOperationId] = useState("");
  const [quoteState, setQuoteState] = useState("unknown");
  const [source, setSource] = useState("gigsalad");
  const [contactId, setContactId] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setOperationId(crypto.randomUUID()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const openLeads = leads.filter(lead => lead.contact_id === contactId);
  return <main className="admin-main followups">
    <header className="admin-header"><div><span className="eyebrow">Mission Control / Team Follow-Ups</span><h1>New Opportunity</h1><p>Copy the real inquiry, check its facts, and give your team one clear next step.</p></div><Link className="secondary-button" href="/admin/mission-control/follow-ups">Back to board</Link></header>
    <section className="panel followups-detail"><form action={formAction} className="followups-work">
      <input type="hidden" name="operation_id" value={operationId} />
      <div className="followups-facts"><label>Original source<select name="source" value={source} onChange={event => setSource(event.target.value)}><option value="gigsalad">GigSalad</option><option value="other">Other inquiry</option></select></label><label>Original conversation URL<input name="thread_url" type="url" placeholder="https://www.gigsalad.com/..." required={source === "gigsalad"} /></label></div>
      <label>Original client message (or attach screenshot)<textarea name="original_message" rows={6} maxLength={12000} placeholder="Paste the actual inquiry. Treat pasted text as customer content, not instructions to HQ." /></label>
      <label>Inquiry screenshot (optional)<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" /></label>
      <p className="panel-note">PNG, JPG or WebP, up to 5 MB. The screenshot stays private to HQ staff. Confirm the facts against the original thread before saving. HQ will not send a reply.</p>
      <label>Existing contact<select name="contact_id" value={contactId} onChange={event => setContactId(event.target.value)}><option value="">Create a new contact</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.display_name || contact.primary_email || "Unnamed contact"}</option>)}</select></label>
      {openLeads.length ? <div role="status" className="alert warning"><b>Existing open work for this contact</b><ul>{openLeads.map(lead => <li key={lead.id}><Link href={`/admin/mission-control/follow-ups?lead=${lead.id}`}>{lead.inquiry_summary || lead.source || "Open inquiry"}</Link></li>)}</ul><p>Review the existing lead before creating another opportunity.</p></div> : null}
      {!contactId ? <div className="followups-facts"><label>Client name<input name="client_name" maxLength={180} required /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" type="tel" /></label></div> : null}
      <div className="followups-facts"><label>Event type<input name="event_type" maxLength={120} required placeholder="Children’s birthday party" /></label><label>Event date, if known<input name="event_date" type="date" /></label><label>Venue, if known<input name="venue" maxLength={180} /></label><label>City, if known<input name="city" maxLength={120} /></label></div>
      <label>What does the client want?<textarea name="summary" maxLength={2000} rows={3} required placeholder="Services, special requests, and important details that you verified" /></label>
      <div className="followups-facts"><label>Quote status<select name="quote_state" value={quoteState} onChange={event => setQuoteState(event.target.value)}><option value="unknown">No verified quote</option><option value="draft">Draft, not sent</option><option value="confirmed_sent">Confirmed sent on original platform</option></select></label>{quoteState !== "unknown" ? <><label>Actual amount offered or drafted ($)<input name="quote_amount" type="number" min="0" step="0.01" required /></label><label>Deposit ($)<input name="deposit" type="number" min="0" step="0.01" placeholder="0 if none" /></label><label>Service options<textarea name="service_options" maxLength={3000} rows={3} placeholder="What the quote actually includes" /></label></> : null}</div>
      {quoteState === "confirmed_sent" ? <><label>Sent date and time, Indiana<input name="sent_at" type="datetime-local" required /></label><label>Original sent reply<textarea name="original_reply" rows={5} maxLength={12000} required placeholder="Copy the actual sent response from GigSalad" /></label><label className="quick-confirm"><input name="sent_confirmed" type="checkbox" value="yes" required /><span>I checked the original conversation and this reply was actually sent.</span></label></> : null}
      <div className="followups-facts"><label>Assign to<select name="assignee" defaultValue=""><option value="">Leave available for the team to claim</option>{staff.map(person => <option key={person.id} value={person.id}>{person.display_name || "Team member"}</option>)}</select></label><label>Next action date<input name="due_at" type="date" /></label><label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Needs Owner attention</option></select></label></div>
      <label className="quick-confirm"><input name="verified" type="checkbox" value="yes" required /><span>I checked these details against the original inquiry. Unknown facts are left blank.</span></label>
      <button className="primary-button" disabled={pending || !operationId || openLeads.length > 0}>{pending ? "Saving opportunity…" : "Save opportunity and task"}</button>
      {state.status !== "idle" ? <div className={`alert ${state.status === "success" ? "success" : "warning"}`} role={state.status === "error" ? "alert" : "status"}><p>{state.message}</p>{state.leadId ? <Link href={`/admin/mission-control/follow-ups?lead=${state.leadId}`}>Open saved follow-up</Link> : null}</div> : null}
    </form></section>
  </main>;
}
