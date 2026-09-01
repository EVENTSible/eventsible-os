import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";
import { formatMoney } from "@/lib/mission-control.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Gig Workspace | EVENTSible HQ" };
type PageProps = { params: Promise<{ eventId: string }> };
type AnyRow = Record<string, unknown>;

function text(value: unknown, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function status(value: unknown) {
  return text(value, "Not started").replaceAll("_", " ");
}

function dateTime(value: unknown) {
  if (!value) return "Date/time not provided";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

function EmptyFoundation({ children }: { children: ReactNode }) {
  return <p className="workspace-empty">{children}</p>;
}

export default async function GigWorkspacePage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");
  if (!isStaffRole(authData.user.app_metadata?.role)) redirect("/login?error=access");

  const [eventResult, bookingResult, activityResult, quoteResult] = await Promise.all([
    supabase.from("os_events").select("id,primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,guest_count,venue_name,venue_address_1,venue_city,venue_state,venue_postal_code,settings,created_at,updated_at").eq("id", eventId).maybeSingle(),
    supabase.from("os_bookings").select("id,event_id,status,contract_status,payment_status,total_amount,deposit_amount,balance_due,booked_at,metadata,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_activity_events").select("id,event_type,payload,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(20),
    supabase.from("os_quote_versions").select("id,status,currency,subtotal,discount_amount,travel_amount,total_amount,deposit_amount,created_at").eq("event_id", eventId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (eventResult.error || !eventResult.data) notFound();
  const event = eventResult.data as AnyRow;
  const booking = (bookingResult.data ?? null) as AnyRow | null;
  const bookingId = booking?.id ? String(booking.id) : null;
  const servicesResult = bookingId
    ? await supabase.from("os_booking_services").select("id,booking_id,service_id,service_code,service_name,status,starts_at,ends_at,configuration").eq("booking_id", bookingId).order("starts_at", { ascending: true })
    : { data: [], error: null };
  const services = servicesResult.data ?? [];
  const contactResult = event.primary_contact_id
    ? await supabase.from("os_contacts").select("id,display_name,primary_email,primary_phone,preferred_channel,notes").eq("id", event.primary_contact_id).maybeSingle()
    : { data: null, error: null };
  const contact = (contactResult.data ?? null) as AnyRow | null;
  const quote = (quoteResult.data ?? null) as AnyRow | null;
  const warnings = [bookingResult.error, servicesResult.error, activityResult.error, quoteResult.error, contactResult.error].filter(Boolean);
  const location = [event.venue_name, event.venue_address_1, [event.venue_city, event.venue_state, event.venue_postal_code].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

  return (
    <div className="workspace-shell">
      <nav className="review-nav"><div><Wordmark compact /><span>Gig Workspace</span></div><div><Link href="/admin">Back to Mission Control</Link></div></nav>
      <main className="workspace-main">
        <header className="workspace-hero">
          <div><span className="eyebrow">Canonical Gig Workspace</span><h1>{text(event.title, "Untitled event")}</h1><p>{text(event.event_type, "Event type not provided")} · {dateTime(event.starts_at)} · {location || "Venue/location not provided"}</p></div>
          <div className="workspace-status-card"><span>Booking</span><b>{status(booking?.status ?? event.status)}</b><small>Event ID {eventId}</small></div>
        </header>
        {warnings.length ? <div className="alert warning"><b>Some workspace records could not be loaded.</b><p>Known data is shown below; unavailable sections are not treated as complete.</p></div> : null}

        <div className="workspace-grid">
          <section className="workspace-section workspace-overview"><header><span className="eyebrow">Overview</span><h2>Event essentials</h2></header><dl className="workspace-facts">
            <div><dt>Date and time</dt><dd>{dateTime(event.starts_at)}{event.ends_at ? ` – ${dateTime(event.ends_at)}` : ""}</dd></div>
            <div><dt>Venue</dt><dd>{location || "Venue/location not provided"}</dd></div>
            <div><dt>Guest count</dt><dd>{event.guest_count ? String(event.guest_count) : "Not provided"}</dd></div>
            <div><dt>Booking status</dt><dd>{status(booking?.status ?? event.status)}</dd></div>
          </dl></section>

          <section className="workspace-section"><header><span className="eyebrow">Client</span><h2>{text(contact?.display_name, "Client not provided")}</h2></header>{contact ? <dl className="workspace-facts"><div><dt>Email</dt><dd>{text(contact.primary_email)}</dd></div><div><dt>Phone</dt><dd>{text(contact.primary_phone)}</dd></div><div><dt>Preferred contact</dt><dd>{status(contact.preferred_channel)}</dd></div></dl> : <EmptyFoundation>No canonical contact is linked to this event.</EmptyFoundation>}</section>

          <section className="workspace-section workspace-wide"><header><span className="eyebrow">Services</span><h2>Booked services</h2></header>{services.length ? <div className="service-grid">{services.map((service) => <article key={service.id}><h3>{text(service.service_name, text(service.service_code, "Service"))}</h3><span className="status-pill">{status(service.status)}</span><p>{service.starts_at ? `${dateTime(service.starts_at)}${service.ends_at ? ` – ${dateTime(service.ends_at)}` : ""}` : "Service time follows the event schedule unless separately configured."}</p></article>)}</div> : <EmptyFoundation>No booked service records are linked yet. Convert to Gig seeds these from the approved canonical quote.</EmptyFoundation>}</section>

          <section className="workspace-section"><header><span className="eyebrow">Readiness</span><h2>Known checks</h2></header><ul className="readiness-list"><li className={contact ? "known" : "missing"}>Canonical client {contact ? "linked" : "missing"}</li><li className={event.starts_at ? "known" : "missing"}>Schedule {event.starts_at ? "recorded" : "missing"}</li><li className={location ? "known" : "missing"}>Venue {location ? "recorded" : "missing"}</li><li className={services.length ? "known" : "missing"}>Services {services.length ? "linked" : "not linked"}</li></ul><p className="workspace-help">No readiness percentage is calculated because staffing, equipment, task, contract, and confirmation checks are not yet fully modeled.</p></section>

          <section className="workspace-section"><header><span className="eyebrow">Money</span><h2>Canonical booking state</h2></header>{booking || quote ? <dl className="workspace-facts"><div><dt>Quote</dt><dd>{status(quote?.status)}</dd></div><div><dt>Total</dt><dd>{formatMoney(booking?.total_amount ?? quote?.total_amount)}</dd></div><div><dt>Deposit</dt><dd>{formatMoney(booking?.deposit_amount ?? quote?.deposit_amount)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(booking?.balance_due)}</dd></div><div><dt>Payment status</dt><dd>{status(booking?.payment_status)}</dd></div><div><dt>Contract status</dt><dd>{status(booking?.contract_status)}</dd></div></dl> : <EmptyFoundation>No canonical quote or booking money record is available.</EmptyFoundation>}</section>

          {[["Tasks", "Event-linked task records are not connected in the current workspace foundation."], ["Staff", "Staff requirements and assignments are not connected in the current workspace foundation."], ["Equipment", "Equipment requirements and assignments are not connected in the current workspace foundation."], ["Documents", "No canonical contract or document links are available in this workspace foundation."]].map(([title, message]) => <section className="workspace-section" key={title}><header><span className="eyebrow">{title}</span><h2>{title === "Documents" ? "Contracts and files" : title}</h2></header><EmptyFoundation>{message}</EmptyFoundation></section>)}

          <section className="workspace-section workspace-wide"><header><span className="eyebrow">Activity / Notes</span><h2>Event history</h2></header>{(activityResult.data ?? []).length ? <ol className="activity-list">{(activityResult.data ?? []).map((activity) => <li key={activity.id}><div><b>{status(activity.event_type)}</b><span>{dateTime(activity.created_at)}</span></div></li>)}</ol> : <EmptyFoundation>No canonical activity entries are available for this event.</EmptyFoundation>}</section>
        </div>
      </main>
    </div>
  );
}
