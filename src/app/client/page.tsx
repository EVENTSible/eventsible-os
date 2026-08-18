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
    .eq("planning_template_name", "Wedding Hero")
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
          <p>Choose your event to continue planning. Your answers save to the same workspace the EVENTSible team uses.</p>
        </header>

        {error ? <div className="alert error">Your events could not be loaded. Please contact EVENTSible for help.</div> : null}
        <section className="client-event-grid">
          {events.length ? events.map((event) => {
            const isWedding = String(event.event_type ?? "").toLowerCase().includes("wedding");
            const active = isWedding && event.planning_template_name === "Wedding Hero";
            return (
              <article className="client-event-card" key={event.event_id}>
                <span className="eyebrow">{event.event_type ?? "EVENTSible event"}</span>
                <h2>{event.title ?? "Your event"}</h2>
                <p>{formatDate(event.starts_at)}<br />{event.venue_name ?? "Venue details coming soon"}</p>
                <div className="client-event-progress">
                  <span><b>{event.progress_percent ?? 0}%</b> planning complete</span>
                  <div><span style={{ width: `${event.progress_percent ?? 0}%` }} /></div>
                </div>
                {active ? (
                  <Link className="primary-button" href={`/client/wedding/${event.event_id}`}>Open Wedding Companion</Link>
                ) : (
                  <p className="client-pending">Your planning workspace is being prepared. Contact EVENTSible if you need immediate access.</p>
                )}
              </article>
            );
          }) : (
            <div className="client-empty">
              <h2>No connected events yet</h2>
              <p>Your invitation may still be processing, or this email has not been connected to the booking. Contact EVENTSible and we&apos;ll get it fixed.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
