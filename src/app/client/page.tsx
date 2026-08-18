import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientLogoutButton } from "@/components/client-logout-button";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "My events | EVENTSible" };

type ClientEvent = {
  event_id: string;
  title: string | null;
  event_type: string | null;
  starts_at: string | null;
  venue_name: string | null;
  booking_status: string | null;
  planning_template_name: string | null;
  planning_status: string | null;
  progress_percent: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date being finalized";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ClientHomePage() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/client/login");

  const { data, error } = await supabase
    .from("os_client_portal_v")
    .select("event_id,title,event_type,starts_at,venue_name,booking_status,planning_template_name,planning_status,progress_percent")
    .in("planning_template_name", ["Wedding Hero", "Event Hero"])
    .order("starts_at", { ascending: true, nullsFirst: false });
  const events = (data ?? []) as ClientEvent[];

  return (
    <div className="client-shell">
      <nav className="client-nav">
        <div><Wordmark compact /><span>Client Portal</span></div>
        <ClientLogoutButton />
      </nav>
      <main className="client-main">
        <header className="client-hero">
          <span className="eyebrow">Your EVENTSible workspace</span>
          <h1>Let&apos;s get your event ready.</h1>
          <p>Continue an event or start a new planning workspace. You can begin before booking, and legacy GigSalad clients can reconnect here.</p>
        </header>

        {error ? <div className="alert error">Your events could not be loaded. Please contact EVENTSible for help.</div> : null}
        <section className="hero-starter-grid" aria-label="Start a planning workspace">
          <article className="hero-starter-card wedding-starter">
            <span className="eyebrow">Weddings</span>
            <h2>Start Wedding Companion</h2>
            <p>Build your timeline, music, ceremony details, introductions, special dances, and planning notes.</p>
            <Link className="primary-button" href="/client/start/wedding">Start my wedding</Link>
          </article>
          <article className="hero-starter-card event-starter">
            <span className="eyebrow">Parties + events</span>
            <h2>Start Event Hero</h2>
            <p>Share the event vision, guest experience, entertainment preferences, announcements, and venue logistics.</p>
            <Link className="primary-button" href="/client/start/event">Start my event</Link>
          </article>
        </section>

        <div className="client-section-heading">
          <span className="eyebrow">Your saved workspaces</span>
          <h2>{events.length ? "Pick up where you left off" : "No saved workspace yet"}</h2>
          {!events.length ? <p>Choose either option above. We will create the workspace and alert the EVENTSible team.</p> : null}
        </div>
        <section className="client-event-grid">
          {events.length ? events.map((event) => {
            const route = event.planning_template_name === "Wedding Hero" ? "wedding" : "event";
            const label = route === "wedding" ? "Open Wedding Companion" : "Open Event Hero";
            return (
              <article className="client-event-card" key={event.event_id}>
                <span className="eyebrow">{event.event_type ?? "EVENTSible event"}</span>
                <h2>{event.title ?? "Your event"}</h2>
                <p>{formatDate(event.starts_at)}<br />{event.venue_name ?? "Venue details coming soon"}</p>
                <div className="client-event-progress">
                  <span><b>{event.progress_percent ?? 0}%</b> planning complete</span>
                  <div><span style={{ width: `${event.progress_percent ?? 0}%` }} /></div>
                </div>
                <Link className="primary-button" href={`/client/${route}/${event.event_id}`}>{label}</Link>
              </article>
            );
          }) : (
            <div className="client-empty">
              <h2>Ready when you are</h2>
              <p>You do not need to wait for EVENTSible to connect a booking. Start above and your verified workspace will appear here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
