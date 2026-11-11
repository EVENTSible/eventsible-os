import Link from "next/link";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isBookedStatus } from "@/lib/mission-control.mjs";
import { orderGigBoardRows } from "@/lib/gig-board.mjs";
import { isStaffRole } from "@/lib/types";

type GigRow = { event_id: string | null; title: string | null; event_type: string | null; starts_at: string | null; ends_at: string | null; venue_name: string | null; primary_contact_name: string | null; booking_id: string | null; booking_status: string | null; contract_status: string | null; payment_status: string | null };
const requestTime = cache(() => Date.now());

export const metadata = { title: "Home | EVENTSible HQ" };

function dateLabel(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date to confirm";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const role = auth.user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/access-denied");
  const result = await supabase.from("os_event_dashboard_v")
    .select("event_id,title,event_type,starts_at,ends_at,venue_name,primary_contact_name,booking_id,booking_status,contract_status,payment_status")
    .order("starts_at", { ascending: true, nullsFirst: false });
  const now = requestTime();
  const booked = orderGigBoardRows(((result.data ?? []) as GigRow[]).filter(row => row.event_id && (isBookedStatus(row.booking_status) || (row.booking_id && !row.booking_status))), now);
  const upcoming = booked.filter(row => !row.starts_at || Number.isNaN(Date.parse(row.starts_at)) || Date.parse(row.ends_at ?? row.starts_at) >= now);
  const nextGig = upcoming[0];
  const attention = upcoming.filter(row => row.contract_status === "sent" || row.payment_status === "deposit_due");
  return <div className="admin-main hq-home">
    <header className="hq-home-hero"><div><span className="eyebrow">EVENTSible HQ</span><h1>Ready for what&apos;s next.</h1><p>Find the next booked gig, see what needs attention, and get back to the work.</p></div><Link className="secondary-button" href="/admin/calendar">Open Calendar</Link></header>
    {result.error ? <div className="alert warning">Gigs are unavailable right now. The list below is incomplete; check again before planning your day.</div> : null}
    <section className="hq-next-gig" aria-labelledby="next-gig-title"><div><span className="eyebrow">Next booked gig</span><h2 id="next-gig-title">{nextGig?.title ?? "No upcoming booking visible"}</h2><p>{nextGig ? `${dateLabel(nextGig.starts_at)} · ${nextGig.venue_name ?? "Venue to confirm"}` : "Check Gigs for historical or undated work."}</p>{nextGig?.primary_contact_name ? <small>Client: {nextGig.primary_contact_name}</small> : null}</div>{nextGig?.event_id ? <Link className="primary-button" href={`/admin/gigs/${nextGig.event_id}`}>Open Gig Workspace</Link> : <Link className="secondary-button" href="/admin/gigs">View Gigs</Link>}</section>
    <div className="hq-home-summary"><section className="panel"><span className="eyebrow">Coming up</span><h2>{upcoming.length} booked {upcoming.length === 1 ? "gig" : "gigs"}</h2><p>Confirmed work appears first. Past events are in Gigs.</p><Link href="/admin/gigs">See all gigs</Link></section><section className="panel"><span className="eyebrow">Review</span><h2>{attention.length} booking {attention.length === 1 ? "item" : "items"}</h2><p>Contracts sent or deposits due on upcoming work.</p><Link href="/admin/mission-control">Open Mission Control</Link></section></div>
    <section className="hq-board-section"><div className="panel-heading"><div><span className="eyebrow">On deck</span><h2>Upcoming gigs</h2></div><Link href="/admin/gigs">View all</Link></div><div className="hq-gig-list">{upcoming.slice(0, 3).map(gig => <Link className="hq-home-gig" key={gig.event_id} href={`/admin/gigs/${gig.event_id}`}><span>{dateLabel(gig.starts_at)}</span><strong>{gig.title ?? "Untitled gig"}</strong><small>{gig.venue_name ?? "Venue to confirm"}</small><b>Open gig →</b></Link>)}</div></section>
    <nav className="hq-home-shortcuts" aria-label="Work shortcuts"><Link href="/admin/calendar">Calendar</Link><Link href="/admin/mission-control#lead-review">Leads and quotes</Link><Link href="/admin/team">Team</Link><Link href="/admin/tools">Tools</Link></nav>
  </div>;
}
