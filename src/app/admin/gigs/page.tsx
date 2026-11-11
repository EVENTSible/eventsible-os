import Link from "next/link";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { orderGigBoardRows } from "@/lib/gig-board.mjs";
import { isBookedStatus } from "@/lib/mission-control.mjs";
import { ownerPlanningReviewForGig } from "@/lib/owner-planning-review.mjs";
import { isStaffRole } from "@/lib/types";

type GigRow = { event_id: string | null; title: string | null; event_type: string | null; event_status: string | null; starts_at: string | null; ends_at: string | null; venue_name: string | null; primary_contact_name: string | null; booking_id: string | null; booking_status: string | null; assignment_id: string | null };
const requestTime = cache(() => Date.now());

export const metadata = { title: "Gigs | EVENTSible HQ" };

function gigDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date to confirm";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function GigCard({ gig, owner }: { gig: GigRow; owner: boolean }) {
  if (!gig.event_id) return null;
  const review = ownerPlanningReviewForGig(gig.event_id);
  const reviewPending = owner && review && !gig.assignment_id;
  return <article className="hq-gig-card">
    <div><span className="eyebrow">{gig.event_type ?? "Event"} · {gigDate(gig.starts_at)}</span><h3>{gig.title ?? "Untitled gig"}</h3><p>{gig.venue_name ?? "Venue to confirm"} · {gig.primary_contact_name ?? "Client to confirm"}</p></div>
    <div className="hq-gig-card-actions"><span className="status-pill">{gig.booking_status ?? "Booked"}</span><Link className="primary-button" href={`/admin/gigs/${gig.event_id}`}>Open Gig</Link>{reviewPending ? <Link className="secondary-button" href={`/admin/gigs/${gig.event_id}#client-planning`}>Planning review pending</Link> : null}</div>
  </article>;
}

export default async function GigsPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const role = auth.user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/access-denied");
  const result = await supabase.from("os_event_dashboard_v")
    .select("event_id,title,event_type,event_status,starts_at,ends_at,venue_name,primary_contact_name,booking_id,booking_status,assignment_id")
    .order("starts_at", { ascending: true, nullsFirst: false });
  const now = requestTime();
  const booked = orderGigBoardRows(((result.data ?? []) as GigRow[]).filter(gig => gig.event_id && (isBookedStatus(gig.booking_status) || (gig.booking_id && !gig.booking_status))), now);
  const upcoming = booked.filter(gig => !gig.starts_at || Number.isNaN(Date.parse(gig.starts_at)) || Date.parse(gig.ends_at ?? gig.starts_at) >= now);
  const past = booked.filter(gig => gig.starts_at && !Number.isNaN(Date.parse(gig.starts_at)) && Date.parse(gig.ends_at ?? gig.starts_at) < now);
  return <div className="admin-main hq-board">
    <header className="hq-page-heading"><div><span className="eyebrow">Booked work</span><h1>Gigs</h1><p>Open one event workspace for its booking, crew and preparation.</p></div><Link className="secondary-button" href="/admin/calendar">Calendar</Link></header>
    {result.error ? <div className="alert warning">Booked gigs could not be loaded. Try again before relying on this list.</div> : null}
    <section className="hq-board-section"><div className="panel-heading"><div><span className="eyebrow">Next up</span><h2>Upcoming gigs</h2></div><span className="status-pill">{upcoming.length}</span></div>
      {upcoming.length ? <div className="hq-gig-list">{upcoming.map(gig => <GigCard key={gig.event_id} gig={gig} owner={role === "owner"} />)}</div> : <p className="workspace-empty">No future booked gig is visible in your HQ access. Check Calendar for inquiries and unscheduled events.</p>}
    </section>
    <details className="hq-history"><summary>Past gigs <span>{past.length}</span></summary><div className="hq-gig-list">{past.map(gig => <GigCard key={gig.event_id} gig={gig} owner={role === "owner"} />)}</div></details>
  </div>;
}
