import { redirect } from "next/navigation";
import { activateWeddingCompanionAction, approveQuoteAction, convertToGigAction, updateLeadStatusAction } from "@/app/admin/actions";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { buildLeadSummary, latestQuoteByLead, formatMoney, isActiveLeadStatus, isBookedStatus, MISSION_CONTROL_SELECTS, nextLeadAction, QUOTE_APPROVAL_STATUS } from "@/lib/mission-control.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventDashboardRow, isStaffRole } from "@/lib/types";

export const metadata = {
  title: "Mission Control | EVENTSible OS",
};

type AnyRow = Record<string, unknown>;
type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: unknown) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(String(value)));
}

function statusLabel(value: unknown) {
  return value ? String(value).replaceAll("_", " ") : "Not started";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function idValue(row: AnyRow | null | undefined, key: string) {
  return stringValue(row?.[key]);
}

function eventTitle(event: EventDashboardRow | AnyRow | undefined, fallback = "EVENTSible event") {
  return stringValue(event?.title) ?? fallback;
}

async function optionalRows<T extends AnyRow>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
) {
  const { data, error } = await query;
  return {
    rows: data ?? [],
    warning: error ? `${label}: ${error.message}` : null,
  };
}

function noticeText(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function quoteItemsFor(quoteItemsByQuote: Map<string, AnyRow[]>, quoteId: string | null) {
  return quoteId ? quoteItemsByQuote.get(quoteId) ?? [] : [];
}

function LeadStatusForm({ lead, eventId }: { lead: AnyRow; eventId: string | null }) {
  const leadId = idValue(lead, "id");
  if (!leadId) return null;

  return (
    <form action={updateLeadStatusAction} className="inline-form">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="event_id" value={eventId ?? ""} />
      <label>
        <span>Lead status</span>
        <select name="status" defaultValue={String(lead.status ?? "new")}>
          {["new", "qualifying", "quoted", "follow_up", "won", "lost", "archived"].map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="secondary-button">Save</button>
    </form>
  );
}

function QuoteActionForms({ lead, event, quote }: { lead: AnyRow; event?: EventDashboardRow; quote?: AnyRow }) {
  const leadId = idValue(lead, "id");
  const eventId = idValue(lead, "event_id") ?? event?.event_id ?? null;
  const quoteVersionId = idValue(quote, "id");

  if (!leadId || !eventId || !quoteVersionId) {
    return <p className="panel-note">A draft quote is required before this lead can be approved or converted.</p>;
  }

  return (
    <div className="action-row">
      <form action={approveQuoteAction}>
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="quote_version_id" value={quoteVersionId} />
        <button type="submit" className="secondary-button">Approve quote</button>
      </form>
      <form action={convertToGigAction}>
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="quote_version_id" value={quoteVersionId} />
        <button type="submit" className="primary-button">Convert to Gig</button>
      </form>
    </div>
  );
}

function QuoteSummary({ quote, items }: { quote?: AnyRow; items: AnyRow[] }) {
  if (!quote) {
    return (
      <div className="quote-card muted-card">
        <b>No draft quote found</b>
        <span>Review the Builder submission and prepare a quote before conversion.</span>
      </div>
    );
  }

  return (
    <div className="quote-card">
      <div>
        <span className="eyebrow">Quote review</span>
        <h4>{formatMoney(quote.total_amount, String(quote.currency ?? "USD"))}</h4>
      </div>
      <span className="status-pill">{statusLabel(quote.status)}</span>
      <ul className="quote-items">
        {items.length ? items.slice(0, 5).map((item) => (
          <li key={String(item.id ?? item.service_code)}>
            <span>{String(item.service_name ?? item.service_code ?? "Custom service")}</span>
            <b>{formatMoney(item.line_total, String(quote.currency ?? "USD"))}</b>
          </li>
        )) : <li><span>Quote items are not available.</span></li>}
      </ul>
    </div>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) redirect("/login");

  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/login?error=access");

  const dashboardResult = await supabase
    .from("os_event_dashboard_v")
    .select("*")
    .order("starts_at", { ascending: true, nullsFirst: false });

  const events = (dashboardResult.data ?? []) as EventDashboardRow[];
  const dashboardWarning = dashboardResult.error ? `Dashboard: ${dashboardResult.error.message}` : null;

  const [leadResult, quoteResult, itemResult, bookingResult, contactResult, submissionResult] = await Promise.all([
    optionalRows<AnyRow>(
      supabase
        .from("os_leads")
        .select(MISSION_CONTROL_SELECTS.leads)
        .order("created_at", { ascending: false })
        .limit(30),
      "Leads",
    ),
    optionalRows<AnyRow>(
      supabase
        .from("os_quote_versions")
        .select(MISSION_CONTROL_SELECTS.quoteVersions)
        .order("created_at", { ascending: false })
        .limit(60),
      "Quotes",
    ),
    optionalRows<AnyRow>(
      supabase
        .from("os_quote_items")
        .select("id,quote_version_id,service_id,service_code,service_name,quantity,unit,line_total,metadata")
        .order("created_at", { ascending: true })
        .limit(300),
      "Quote items",
    ),
    optionalRows<AnyRow>(
      supabase
        .from("os_bookings")
        .select("id,event_id,status,contract_status,payment_status,total_amount,deposit_amount,balance_due,booked_at,created_at,metadata")
        .order("created_at", { ascending: false })
        .limit(40),
      "Bookings",
    ),
    optionalRows<AnyRow>(
      supabase.from("os_contacts").select("id,display_name,primary_email,primary_phone,preferred_channel,notes").limit(100),
      "Contacts",
    ),
    optionalRows<AnyRow>(
      supabase.from("os_builder_submissions").select(MISSION_CONTROL_SELECTS.builderSubmissions).order("created_at", { ascending: false }).limit(60),
      "Builder submissions",
    ),
  ]);

  const warnings = [dashboardWarning, leadResult.warning, quoteResult.warning, itemResult.warning, bookingResult.warning, contactResult.warning, submissionResult.warning].filter(Boolean);
  const eventsById = new Map(events.map((event) => [event.event_id, event]));
  const latestQuotes = latestQuoteByLead(quoteResult.rows);
  const quoteItemsByQuote = new Map<string, AnyRow[]>();
  for (const item of itemResult.rows) {
    const quoteId = idValue(item, "quote_version_id");
    if (!quoteId) continue;
    quoteItemsByQuote.set(quoteId, [...(quoteItemsByQuote.get(quoteId) ?? []), item]);
  }

  const bookingsByEvent = new Map(bookingResult.rows.map((booking) => [idValue(booking, "event_id"), booking]));
  const contactsById = new Map(contactResult.rows.map((contact) => [idValue(contact, "id"), contact]));
  const submissionsById = new Map(submissionResult.rows.map((submission) => [idValue(submission, "id"), submission]));
  const activeLeads = leadResult.rows.filter((lead) => isActiveLeadStatus(lead.status));
  const fallbackLeads = events
    .filter((event) => isActiveLeadStatus(event.lead_status))
    .map((event) => ({
      id: event.lead_id,
      event_id: event.event_id,
      status: event.lead_status,
      inquiry_summary: event.title,
      source: "dashboard_view",
      created_at: event.starts_at,
    }))
    .filter((lead) => lead.id);
  const leadRows = activeLeads.length ? activeLeads : fallbackLeads;
  const bookedRows = events.filter((event) => isBookedStatus(event.booking_status) || bookingsByEvent.has(event.event_id));
  const planning = events.filter((event) => ["assigned", "opened", "in_progress", "reopened"].includes(event.planning_status ?? "") || (event.progress_percent ?? 0) > 0);
  const heroRows = events.filter((event) => Boolean(event.assignment_id) && ["Wedding Hero", "Event Hero"].includes(event.planning_template_name ?? ""));
  const attention = events.filter((event) => event.contract_status === "sent" || event.payment_status === "deposit_due" || event.last_activity_type?.includes("help"));
  const notice = noticeText(params, "notice");
  const errorNotice = noticeText(params, "error");

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wordmark compact />
          <span>Operating System</span>
        </div>
        <nav>
          <a className="active" href="/admin">Mission Control</a>
          <a href="/admin/calendar">Calendar / Date Book</a>
          <a href="#lead-review">Lead Review</a>
          <a href="#quote-review">Quotes</a>
          <a href="#hero-workspaces">Hero Workspaces</a>
          <a href="#gig-workspace">Booked Gigs</a>
          <a href="#automation">Automation</a>
        </nav>
        <div className="sidebar-footer">
          <span className="role-pill">{String(role)}</span>
          <LogoutButton />
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header mission-header">
          <div>
            <span className="eyebrow">Mission Control</span>
            <h1>Lead-to-Gig command center.</h1>
            <p>Review Builder leads, approve the draft quote, and start the booked Gig workspace from the same OS records.</p>
          </div>
          <div className="header-actions">
            <a className="secondary-button" href="/admin/calendar">Open calendar</a>
            <a className="secondary-button" href="#lead-review">Review leads</a>
            <a className="primary-button" href="#quote-review">Approve quotes</a>
          </div>
        </header>

        {notice ? <div className="alert success">{notice}</div> : null}
        {errorNotice ? <div className="alert error">{errorNotice}</div> : null}
        {warnings.length ? (
          <div className="alert warning">
            <b>Some OS surfaces need verification.</b>
            <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        ) : null}

        <section className="metrics" aria-label="Business overview">
          <article><span>Active leads</span><b>{leadRows.length}</b><small>Builder and direct inquiries</small></article>
          <article><span>Quotes to review</span><b>{quoteResult.rows.filter((quote) => ["draft", QUOTE_APPROVAL_STATUS].includes(String(quote.status ?? ""))).length}</b><small>Draft and approved quotes</small></article>
          <article><span>Booked gigs</span><b>{bookedRows.length}</b><small>Confirmed or workspace-ready</small></article>
          <article><span>Needs attention</span><b>{attention.length}</b><small>Contracts, deposits, or follow-up</small></article>
        </section>

        <section className="mission-grid">
          <article className="panel lead-panel" id="lead-review">
            <div className="panel-heading">
              <div><span className="eyebrow">Lead review</span><h2>Who they are, what they want, and what happens next</h2></div>
              <span className="status-dot">OS-owned</span>
            </div>
            <div className="lead-list">
              {leadRows.length ? leadRows.slice(0, 8).map((lead) => {
                const leadId = idValue(lead, "id");
                const eventId = idValue(lead, "event_id");
                const event = eventId ? eventsById.get(eventId) : undefined;
                const quote = leadId ? latestQuotes.get(leadId) : undefined;
                const quoteId = idValue(quote, "id");
                const quoteItems = quoteItemsFor(quoteItemsByQuote, quoteId);
                const contact = contactsById.get(idValue(lead, "contact_id"));
                const submission = submissionsById.get(idValue(lead, "builder_submission_id"));
                const summary = buildLeadSummary({ lead, event, contact, submission, quote, quoteItems });
                const nextAction = nextLeadAction(summary);
                return (
                  <article className="mission-card" key={String(lead.id ?? eventId)}>
                    <div className="mission-card-main">
                      <div className="lead-card-heading">
                        <div><span className="eyebrow">{statusLabel(lead.source ?? "eventsible_os")}</span><h3>{summary.clientName ?? "Name not provided"}</h3></div>
                        <span className={`status-pill status-${String(summary.leadStatus ?? "new")}`}>{statusLabel(summary.leadStatus)}</span>
                      </div>
                      <p className="lead-event-title"><b>{eventTitle(event, summary.eventType ?? "Event inquiry")}</b> · {summary.eventDate ? formatDate(summary.eventDate) : "Date not provided"}</p>
                      <dl className="lead-facts">
                        <div><dt>Contact</dt><dd>{summary.email ?? "Email not provided"}<br />{summary.phone ?? "Phone not provided"}<small>{summary.preferredContact ? `Prefers ${statusLabel(summary.preferredContact)}` : "Contact preference not provided"}</small></dd></div>
                        <div><dt>Event</dt><dd>{summary.eventType ?? "Event type not provided"}<br />{summary.location ?? "Venue/location not provided"}<small>{summary.guestCount ? `${summary.guestCount} guests` : "Guest count not provided"}{summary.timeframe ? ` · ${summary.timeframe}` : ""}</small></dd></div>
                        <div><dt>Services</dt><dd>{summary.services.length ? summary.services.join(", ") : "Services not provided"}<small>{summary.packageName ? `Recommended: ${statusLabel(summary.packageName)}` : "Package not provided"}</small></dd></div>
                        <div><dt>Planning notes</dt><dd>{String(summary.notes ?? summary.priorities ?? "No planning notes provided")}</dd></div>
                      </dl>
                      <div className="next-action"><span>Next required action</span><b>{nextAction}</b></div>
                      <LeadStatusForm lead={lead} eventId={eventId} />
                    </div>
                    <div className="mission-card-side">
                      <QuoteSummary quote={quote} items={quoteItems} />
                      <QuoteActionForms lead={lead} event={event} quote={quote} />
                    </div>
                  </article>
                );
              }) : (
                <div className="empty-state compact">
                  <div className="empty-icon">✦</div>
                  <h3>No active Builder leads are waiting.</h3>
                  <p>New public-site and Builder submissions will appear here after the OS intake creates the canonical lead, event, and draft quote.</p>
                </div>
              )}
            </div>
          </article>

          <aside className="stack">
            <article className="panel" id="quote-review">
              <div className="panel-heading"><div><span className="eyebrow">Quote approval</span><h2>Approval lane</h2></div></div>
              <p className="panel-note">Approval advances the quote through the canonical sent state and keeps final booking authority inside EVENTSible OS. Convert to Gig creates or updates the OS booking and service workspace.</p>
              <div className="mini-stat"><span>Draft quotes</span><b>{quoteResult.rows.filter((quote) => quote.status === "draft").length}</b></div>
              <div className="mini-stat"><span>Approved quotes</span><b>{quoteResult.rows.filter((quote) => quote.status === QUOTE_APPROVAL_STATUS).length}</b></div>
              <div className="mini-stat"><span>Accepted quotes</span><b>{quoteResult.rows.filter((quote) => quote.status === "accepted").length}</b></div>
            </article>

            <article className="panel" id="automation">
              <div className="panel-heading"><div><span className="eyebrow">Automation</span><h2>System status</h2></div><span className="status-dot">Live</span></div>
              <ul className="check-list">
                <li>Builder intake chain remains OS-owned</li>
                <li>Quote approval updates existing quote versions</li>
                <li>Convert to Gig reuses OS booking tables</li>
                <li>Event workspace uses canonical event IDs</li>
              </ul>
            </article>
          </aside>
        </section>

        <section className="panel gig-panel" id="hero-workspaces">
          <div className="panel-heading">
            <div><span className="eyebrow">Client planning</span><h2>Wedding Hero + Event Hero</h2></div>
            <span className="status-dot">{heroRows.length} workspace{heroRows.length === 1 ? "" : "s"}</span>
          </div>
          <p className="panel-note">Includes booked clients, legacy GigSalad clients, and prospective clients who started with a verified email. A self-reported booking stays an inquiry until EVENTSible confirms it.</p>
          <div className="event-list workspace-list">
            {heroRows.length ? heroRows.slice(0, 16).map((event) => {
              const isWeddingHero = event.planning_template_name === "Wedding Hero";
              const route = isWeddingHero ? "wedding" : "event";
              return (
                <article className="event-row workspace-row" key={`${event.event_id}-${event.assignment_id}`}>
                  <div className="date-block"><b>{formatDate(event.starts_at).split(",")[0]}</b><span>{event.planning_template_name}</span></div>
                  <div className="event-copy">
                    <h3>{event.title ?? "Untitled event"}</h3>
                    <p>{event.primary_contact_name ?? "Client not entered"} · {event.venue_name ?? "Venue not entered"}</p>
                  </div>
                  <div className="workspace-status">
                    <span className="status-pill">{event.progress_percent ?? 0}% · {statusLabel(event.planning_status)}</span>
                    <small>{statusLabel(event.event_status)}</small>
                    <a className="secondary-button compact-button" href={`/admin/${route}/${event.event_id}`}>Review {isWeddingHero ? "Wedding Hero" : "Event Hero"}</a>
                  </div>
                </article>
              );
            }) : (
              <div className="empty-state compact"><div className="empty-icon">✦</div><h3>No Hero workspace has been started.</h3><p>Verified client self-starts will appear here immediately for review.</p></div>
            )}
          </div>
        </section>

        <section className="panel gig-panel" id="gig-workspace">
          <div className="panel-heading">
            <div><span className="eyebrow">Booked Gig workspace</span><h2>Confirmed and workspace-ready events</h2></div>
            <span className="status-dot">{planning.length} planning</span>
          </div>
          <div className="event-list workspace-list">
            {bookedRows.length ? bookedRows.slice(0, 10).map((event) => {
              const booking = bookingsByEvent.get(event.event_id);
              const isWedding = String(event.event_type ?? "").toLowerCase().includes("wedding");
              const hasWeddingCompanion = isWedding && event.planning_template_name === "Wedding Hero" && Boolean(event.assignment_id);
              return (
                <article className="event-row workspace-row" key={event.event_id ?? event.title}>
                  <div className="date-block"><b>{formatDate(event.starts_at).split(",")[0]}</b><span>{event.event_type ?? "Event"}</span></div>
                  <div className="event-copy">
                    <h3>{event.title}</h3>
                    <p>{event.primary_contact_name ?? "Client not entered"} · {event.venue_name ?? "Venue not entered"}</p>
                  </div>
                  <div className="workspace-status">
                    <span className="status-pill">{statusLabel(booking?.status ?? event.booking_status ?? event.event_status)}</span>
                    <small>Quote total: {formatMoney(booking?.total_amount)}</small>
                    {event.event_id ? <a className="primary-button compact-button" href={`/admin/gigs/${event.event_id}`}>Open Gig Workspace</a> : null}
                    {hasWeddingCompanion ? (
                      <a className="secondary-button compact-button" href={`/admin/wedding/${event.event_id}`}>Review Wedding Hero</a>
                    ) : isWedding && event.event_id ? (
                      <form action={activateWeddingCompanionAction}>
                        <input type="hidden" name="event_id" value={event.event_id} />
                        <button type="submit" className="primary-button compact-button">Activate & invite client</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <div className="empty-state compact">
                <div className="empty-icon">✓</div>
                <h3>Booked Gig workspaces start after conversion.</h3>
                <p>Use Convert to Gig from a reviewed lead to create the booking record and seed booked services from the approved quote.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
