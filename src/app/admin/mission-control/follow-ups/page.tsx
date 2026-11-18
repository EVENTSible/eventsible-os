import Link from "next/link";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hasHqCapability } from "@/lib/hq-authorization";
import { isStaffRole } from "@/lib/types";
import { followUpDue, followUpState, safeGigSaladUrl } from "@/lib/follow-ups.mjs";
import { formatMoney, latestQuoteByLead } from "@/lib/mission-control.mjs";
import { assignFollowUpAction, claimFollowUpAction, completeFollowUpTaskAction, createFollowUpTaskAction, saveFollowUpAction, scheduleFollowUpAction } from "./actions";
import "./follow-ups.css";

export const metadata = { title: "Team Follow-Ups | EVENTSible HQ" };
export const dynamic = "force-dynamic";
// Canonical Supabase rows have different shapes across these five OS tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const string = (v: unknown) => typeof v === "string" ? v : "";
const date = (v: unknown) => v && !Number.isNaN(Date.parse(String(v))) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" }).format(new Date(String(v))) : "Not set";
const active = ["new", "qualifying", "quoted", "follow_up"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestTime = cache(() => Date.now());
const requestOperationIds = cache(() => Array.from({ length: 8 }, () => crypto.randomUUID()));

export default async function FollowUpsPage({ searchParams }: Props) {
  const supabase = await createServerSupabase();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) redirect("/login");
  const role = session.user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/access-denied");
  const owner = hasHqCapability(role, "lead.lifecycle.manage");
  const params = searchParams ? await searchParams : {};
  const requestedId = string(params.lead);
  const selectedId = uuid.test(requestedId) ? requestedId : null;
  const filter = string(params.filter);

  const [leadsResult, contactsResult, quotesResult, tasksResult, profilesResult] = await Promise.all([
    supabase.from("os_leads").select("id,contact_id,event_id,status,source,inquiry_summary,next_follow_up_at,assigned_to,metadata,created_at,updated_at").in("status", active).order("created_at", { ascending: false }).limit(250),
    supabase.from("os_contacts").select("id,display_name,primary_email,primary_phone").limit(250),
    supabase.from("os_quote_versions").select("id,lead_id,version_number,status,total_amount,deposit_amount,currency,sent_at,viewed_at,expires_at,created_at,snapshot").order("created_at", { ascending: false }).limit(250),
    supabase.from("os_tasks").select("id,lead_id,assigned_to,status,priority,due_at,metadata,created_at").eq("task_type", "follow_up").in("status", ["todo","in_progress","waiting"]).order("created_at", { ascending: false }).limit(250),
    supabase.from("os_profiles").select("id,display_name,is_active").eq("is_active", true).limit(100),
  ]);
  const failed = [leadsResult, contactsResult, quotesResult, tasksResult, profilesResult].some(result => result.error);
  const leads = (leadsResult.data ?? []) as Row[];
  const contacts = new Map(((contactsResult.data ?? []) as Row[]).map(row => [row.id, row]));
  const candidateProfiles = ((profilesResult.data ?? []) as Row[]);
  const identities = process.env.SUPABASE_SERVICE_ROLE_KEY ? await Promise.all(candidateProfiles.map(profile => createAdminSupabase().auth.admin.getUserById(profile.id))) : [];
  const profiles = candidateProfiles.filter((_, index) => isStaffRole(identities[index]?.data.user?.app_metadata?.role));
  const names = new Map(profiles.map(row => [row.id, row.display_name || "Team member"]));
  const quotes = latestQuoteByLead((quotesResult.data ?? []) as Row[]);
  const tasks = new Map<string, Row>();
  for (const task of (tasksResult.data ?? []) as Row[]) {
    if (task.lead_id && !tasks.has(task.lead_id)) tasks.set(task.lead_id, task);
  }
  const now = requestTime();
  const sorted = leads.sort((a, b) => Number(followUpDue(b, tasks.get(b.id), now)) - Number(followUpDue(a, tasks.get(a.id), now)) || String(a.next_follow_up_at ?? "9999").localeCompare(String(b.next_follow_up_at ?? "9999")));
  const visible = sorted.filter(lead => filter === "mine" ? lead.assigned_to === session.user!.id : filter === "unassigned" ? !lead.assigned_to : filter === "overdue" ? followUpDue(lead, tasks.get(lead.id), now) : true);
  const selected = selectedId ? leads.find(lead => lead.id === selectedId) : null;
  const selectedContact = selected ? contacts.get(selected.contact_id) : null;
  const selectedQuote = selected ? quotes.get(selected.id) : null;
  const quoteHistory = selected ? ((quotesResult.data ?? []) as Row[]).filter(quote => quote.lead_id === selected.id).sort((a, b) => Number(b.version_number) - Number(a.version_number)) : [];
  const sentQuote = quoteHistory.find(quote => quote.sent_at);
  const selectedTask = selected ? tasks.get(selected.id) : null;
  const historyResult = selected ? await supabase.from("os_activity_events").select("id,event_type,payload,actor_user_id,occurred_at")
    .contains("payload", { lead_id: selected.id }).eq("visibility", "staff").order("occurred_at", { ascending: false }).limit(50) : null;
  const history = (historyResult?.data ?? []) as Row[];
  const evidence = history.find(row => row.event_type === "opportunity.intake_created");
  const eventResult = selected?.event_id ? await supabase.from("os_events").select("title,event_type,historical_date,starts_at,venue_name,venue_city").eq("id", selected.event_id).maybeSingle() : null;
  const event = eventResult?.data;
  const filesResult = selected?.event_id ? await supabase.from("os_files")
    .select("id,bucket_id,object_path,file_name,created_at")
    .eq("event_id", selected.event_id).eq("bucket_id", "opportunity-evidence")
    .eq("visibility", "staff_only").order("created_at", { ascending: false }).limit(10) : null;
  const evidenceFiles = await Promise.all((filesResult?.data ?? []).map(async file => {
    const { data } = await supabase.storage.from("opportunity-evidence").createSignedUrl(file.object_path, 60);
    return { ...file, url: data?.signedUrl ?? null };
  }));
  const sourceUrl = safeGigSaladUrl(selected?.metadata?.gigsalad?.thread_url ?? selected?.metadata?.gigsalad_thread_url);
  const feedback = string(params.error) || string(params.notice);

  return <main className="admin-main followups">
    <header className="admin-header"><div><span className="eyebrow">Mission Control / Leads</span><h1>Team Follow-Ups</h1><p>See who owns each inquiry, what is due, and what the client was actually quoted.</p></div><div className="header-actions"><Link className="secondary-button" href="/admin/mission-control">Lead Review</Link>{owner ? <Link className="primary-button" href="/admin/mission-control/follow-ups/new">New Opportunity</Link> : null}</div></header>
    {feedback ? <p role="status" className={`alert ${params.error ? "error" : "success"}`}>{feedback}</p> : null}
    {failed || historyResult?.error ? <p role="alert" className="alert warning">Some HQ records could not be loaded. Refresh before taking action.</p> : null}
    <nav className="followups-filters" aria-label="Follow-up filters">{[["", "All open"], ["mine", "My work"], ["unassigned", "Available"], ["overdue", "Overdue"]].map(([key, label]) => <Link key={key} aria-current={filter === key ? "page" : undefined} href={`${"/admin/mission-control/follow-ups"}${key ? `?filter=${key}` : ""}`}>{label}{key === "overdue" ? ` (${leads.filter(lead => followUpDue(lead, tasks.get(lead.id), now)).length})` : ""}</Link>)}</nav>
    <div className="followups-layout"><section className="followups-list" aria-label="Open opportunities">{visible.length ? visible.map(lead => {
      const task = tasks.get(lead.id);
      const quote = quotes.get(lead.id);
      const contact = contacts.get(lead.contact_id);
      const overdue = followUpDue(lead, task, now);
      return <Link key={lead.id} className={`followups-card ${selectedId === lead.id ? "selected" : ""}`} href={`/admin/mission-control/follow-ups?lead=${encodeURIComponent(lead.id)}${filter ? `&filter=${filter}` : ""}`}>
        <span className="eyebrow">{string(lead.source).replaceAll("_", " ") || "Inquiry"} {overdue ? "· Overdue" : ""}</span><strong>{contact?.display_name || "Client name unavailable"}</strong>
        <span>{string(lead.inquiry_summary).slice(0, 130) || "Review this inquiry"}</span><small>{followUpState(lead, task, quote)} · {names.get(lead.assigned_to) || (lead.assigned_to ? "Team member" : "Available to claim")}</small>
        <small>Next: {date(lead.next_follow_up_at ?? task?.due_at)}</small>
      </Link>;
    }) : <div className="panel"><h2>No follow-ups in this view</h2><p>Choose another filter or ask the Owner to add a verified inquiry.</p></div>}</section>
    <section className="panel followups-detail" aria-label="Follow-up details">{selected ? <>
      <div className="panel-heading"><div><span className="eyebrow">{followUpState(selected, selectedTask, selectedQuote)}</span><h2>{selectedContact?.display_name || "Client name unavailable"}</h2></div><span className="status-pill">{string(selected.status).replaceAll("_", " ")}</span></div>
      <div className="followups-facts"><div><b>Inquiry</b><p>{selected.inquiry_summary || "Event details have not been entered."}</p><small>Source: {selected.source || "Unknown"} · Received {date(selected.created_at)}</small></div><div><b>Event</b><p>{event?.event_type || "Type unknown"} · {event?.historical_date || (event?.starts_at ? date(event.starts_at) : "Date unknown")}</p><small>{[event?.venue_name,event?.venue_city].filter(Boolean).join(", ") || "Location unknown"}</small></div><div><b>Contact</b><p>{selectedContact?.primary_email || "Email unknown"}<br />{selectedContact?.primary_phone || "Phone unknown"}</p></div><div><b>Original sent quote</b><p>{sentQuote ? `${formatMoney(sentQuote.total_amount, String(sentQuote.currency ?? "USD"))} · ${sentQuote.status}` : "No verified sent quote on this lead"}</p><small>{sentQuote ? `Deposit: ${formatMoney(sentQuote.deposit_amount, String(sentQuote.currency ?? "USD"))} · Sent: ${date(sentQuote.sent_at)} · Viewed: ${date(sentQuote.viewed_at)} · Expires: ${date(sentQuote.expires_at)}` : "Drafts and estimates are not confirmed offers."}</small>{sentQuote?.snapshot?.serviceOptions ? <p>Options: {sentQuote.snapshot.serviceOptions}</p> : null}</div><div><b>Owner and next step</b><p>{names.get(selected.assigned_to) || (selected.assigned_to ? "Team member" : "Unassigned")} · {date(selected.next_follow_up_at ?? selectedTask?.due_at)}</p></div></div>
      {evidence ? <details className="followups-history"><summary>Original inquiry and reply</summary><p><b>Client message:</b> {string(evidence.payload?.originalMessage) || "See private screenshot below."}</p><p><b>Recorded reply:</b> {string(evidence.payload?.originalReply) || "No reply recorded"}</p><small>Owner-supplied source evidence, reviewed inside HQ. Confirm source status at GigSalad before contacting anyone.</small></details> : null}
      {evidenceFiles.length ? <div className="followups-history"><h3>Private screenshots</h3><ul>{evidenceFiles.map(file => <li key={file.id}>{file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer">{file.file_name}</a> : `${file.file_name} (temporarily unavailable)`}</li>)}</ul><small>Links expire after one minute. Refresh this page for a new link.</small></div> : null}
      {quoteHistory.length ? <details><summary>Quote history ({quoteHistory.length})</summary><ul>{quoteHistory.map(quote => <li key={quote.id}>Version {quote.version_number} · {formatMoney(quote.total_amount, String(quote.currency ?? "USD"))} · {quote.status} · {date(quote.created_at)}{quote.snapshot?.serviceOptions ? <p>Options: {quote.snapshot.serviceOptions}</p> : null}</li>)}</ul></details> : null}
      {sourceUrl ? <p><a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="secondary-button">Open original GigSalad thread</a></p> : selected.source === "gigsalad" ? <p className="panel-note">Original GigSalad thread link has not been verified. Check the original account before outreach.</p> : null}
      <div className="followups-actions">{!selected.assigned_to ? <form action={claimFollowUpAction}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[0]} /><button className="primary-button">Claim this follow-up</button></form> : null}
      {owner ? <form action={assignFollowUpAction}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[1]} /><label>Assign to <select name="assignee" defaultValue={selected.assigned_to ?? ""} required><option value="">Choose team member</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || "Team member"}</option>)}</select></label><button className="secondary-button">Save owner</button></form> : null}</div>
      {(selected.assigned_to === session.user.id || owner) ? <div className="followups-work"><form action={scheduleFollowUpAction}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[2]} /><label>Next follow-up <input type="date" name="due_at" required /></label><button className="secondary-button">Set date</button></form>
      {!selectedTask ? <form action={createFollowUpTaskAction}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[3]} /><label>Priority <select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Needs Owner attention</option></select></label><button className="secondary-button">Add task</button></form> : <form action={completeFollowUpTaskAction}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[4]} /><p>Task: {selectedTask.status} · {selectedTask.priority}.</p>{!["completed","cancelled"].includes(selectedTask.status) ? <button className="secondary-button">Complete task</button> : null}</form>}
      {([ ["note", "Team note"], ["draft", "Private reply draft"], ["attempt", "Record contact attempt"] ] as const).map(([kind, label], index) => <form action={saveFollowUpAction} key={`${selected.id}-${kind}`}><input type="hidden" name="lead_id" value={selected.id} /><input type="hidden" name="operation_id" value={requestOperationIds()[index + 5]} /><input type="hidden" name="kind" value={kind} /><label>{label}<textarea name="body" maxLength={4000} rows={3} required placeholder={kind === "attempt" ? "Channel, outcome, and next step" : "Internal only. Do not paste account passwords."} /></label><button className="secondary-button">{kind === "draft" ? "Save draft only" : kind === "attempt" ? "Record outcome" : "Add private note"}</button></form>)}</div> : <p className="panel-note">Claim this inquiry before recording work. Only the Owner can reassign it.</p>}
      <div className="followups-history"><h3>Team activity</h3>{history.length ? <ul>{history.map(item => <li key={item.id}><small>{date(item.occurred_at)} · {names.get(item.actor_user_id) || "Team member"} · {string(item.event_type).split(".").pop()}</small><p>{string(item.payload?.body) || string(item.payload?.summary) || "Activity recorded"}</p></li>)}</ul> : <p>No follow-up notes or drafts recorded yet.</p>}</div>
      <p className="panel-note">HQ saves drafts internally and does not send GigSalad messages. Booking and quote approval stay in <Link href="/admin/mission-control">Lead Review</Link> with Owner authorization.</p>
    </> : <><h2>Choose an inquiry</h2><p>Open a card to see client context, original quote status, ownership, and next action.</p></>}</section></div>
  </main>;
}
