import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventDashboardRow, isStaffRole } from "@/lib/types";

export const metadata = {
  title: "Admin | EVENTSible OS",
};

function formatDate(value: string | null) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(value: string | null) {
  return value ? value.replaceAll("_", " ") : "Not started";
}

export default async function AdminPage() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) redirect("/login");

  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/login?error=access");

  const { data, error } = await supabase
    .from("os_event_dashboard_v")
    .select("*")
    .order("starts_at", { ascending: true, nullsFirst: false });

  const events = (data ?? []) as EventDashboardRow[];
  const leads = events.filter((event) => ["new", "qualifying", "quoted", "follow_up"].includes(event.lead_status ?? ""));
  const booked = events.filter((event) => ["confirmed", "completed"].includes(event.booking_status ?? ""));
  const planning = events.filter((event) => ["assigned", "opened", "in_progress", "reopened"].includes(event.event_status ?? "") || (event.progress_percent ?? 0) > 0);
  const attention = events.filter((event) => event.contract_status === "sent" || event.payment_status === "deposit_due" || event.last_activity_type?.includes("help"));

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wordmark compact />
          <span>Operating System</span>
        </div>
        <nav>
          <a className="active" href="/admin">Overview</a>
          <a href="#events">Events</a>
          <a href="#leads">Leads & Quotes</a>
          <a href="#heroes">Wedding & Event Hero</a>
          <a href="#messages">Messages</a>
          <a href="#automations">Automations</a>
        </nav>
        <div className="sidebar-footer">
          <span className="role-pill">{String(role)}</span>
          <LogoutButton />
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="eyebrow">Owner dashboard</span>
            <h1>Good to see you, Travis.</h1>
            <p>Here is the current pulse of EVENTSible.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="secondary-button">Import gig</button>
            <button type="button" className="primary-button">New lead</button>
          </div>
        </header>

        {error ? <div className="alert error">Dashboard data could not be loaded: {error.message}</div> : null}

        <section className="metrics" aria-label="Business overview">
          <article><span>Active leads</span><b>{leads.length}</b><small>Builder and direct inquiries</small></article>
          <article><span>Booked events</span><b>{booked.length}</b><small>Confirmed in the system</small></article>
          <article><span>Planning now</span><b>{planning.length}</b><small>Hero work in progress</small></article>
          <article><span>Needs attention</span><b>{attention.length}</b><small>Payments, contracts, or help</small></article>
        </section>

        <section className="dashboard-grid">
          <article className="panel event-panel" id="events">
            <div className="panel-heading">
              <div><span className="eyebrow">GigTracker</span><h2>Upcoming events</h2></div>
              <button type="button" className="text-button">View calendar</button>
            </div>
            {events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <h3>Your connected event list starts here.</h3>
                <p>When Event Builder submissions and existing GigTracker records are connected, leads and bookings will appear automatically.</p>
                <div className="empty-actions">
                  <button type="button" className="primary-button">Connect Event Builder</button>
                  <button type="button" className="secondary-button">Import existing gigs</button>
                </div>
              </div>
            ) : (
              <div className="event-list">
                {events.slice(0, 8).map((event) => (
                  <article className="event-row" key={event.event_id ?? event.title}>
                    <div className="date-block"><b>{formatDate(event.starts_at).split(",")[0]}</b><span>{event.event_type ?? "Event"}</span></div>
                    <div className="event-copy"><h3>{event.title}</h3><p>{event.primary_contact_name ?? "Client not entered"} · {event.venue_name ?? "Venue not entered"}</p></div>
                    <div className="event-status"><span>{statusLabel(event.booking_status ?? event.event_status)}</span><small>{event.progress_percent ?? 0}% planned</small></div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <aside className="stack">
            <article className="panel" id="heroes">
              <div className="panel-heading"><div><span className="eyebrow">Hero center</span><h2>Planning progress</h2></div></div>
              <div className="mini-stat"><span>Wedding Hero</span><b>{events.filter((event) => event.planning_template_name === "Wedding Hero").length}</b></div>
              <div className="mini-stat"><span>Event Hero</span><b>{events.filter((event) => event.planning_template_name === "Event Hero").length}</b></div>
              <p className="panel-note">Client answers will update the same event record used by GigTracker and host tools.</p>
            </article>

            <article className="panel" id="automations">
              <div className="panel-heading"><div><span className="eyebrow">Automation</span><h2>System status</h2></div><span className="status-dot">Live</span></div>
              <ul className="check-list">
                <li>Builder facts sync</li>
                <li>Quote-to-booking lifecycle</li>
                <li>Hero auto-assignment</li>
                <li>Portal workspace creation</li>
              </ul>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}
