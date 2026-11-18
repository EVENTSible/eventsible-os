import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";

export const metadata = { title: "Team | EVENTSible HQ" };

type Assignment = { id: string; eventId: string; teamMemberId: string; assignmentRole: string; callTime: string | null };
type Member = { id: string; displayName: string; status: string };
type Snapshot = { assignments?: Assignment[]; teamMembers?: Member[]; currentTeamMemberId?: string | null; canManageAssignments?: boolean; canManageTeam?: boolean };

export default async function TeamPage() {
  const auth = await authorizeHqCapability("schedule.read");
  if (!auth.ok) redirect(auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  const from = new Date(); from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(); to.setUTCDate(to.getUTCDate() + 90);
  const [snapshotResult, eventResult] = await Promise.all([
    auth.supabase.rpc("os_team_calendar_snapshot", { p_from: from.toISOString().slice(0, 10), p_to: to.toISOString().slice(0, 10) }),
    auth.supabase.from("os_event_dashboard_v").select("event_id,title,starts_at,venue_name,booking_id,booking_status"),
  ]);
  const snapshot = (snapshotResult.data ?? {}) as Snapshot;
  const members = new Map((snapshot.teamMembers ?? []).map(member => [member.id, member]));
  const events = new Map((eventResult.data ?? []).map(event => [event.event_id, event]));
  const assignments = (snapshot.assignments ?? []).filter(item => events.has(item.eventId)).sort((a, b) => String(events.get(a.eventId)?.starts_at ?? "").localeCompare(String(events.get(b.eventId)?.starts_at ?? "")));
  return <div className="admin-main hq-board"><header className="hq-page-heading"><div><span className="eyebrow">Crew and calls</span><h1>Team</h1><p>Event assignments and call times from the shared calendar.</p></div><Link className="secondary-button" href="/admin/calendar">Open Calendar</Link></header>
    {snapshotResult.error || eventResult.error ? <div className="alert warning">Some team details are unavailable. Confirm the schedule before making plans.</div> : null}
    <section className="hq-board-section"><div className="panel-heading"><div><span className="eyebrow">Next 90 days</span><h2>Assigned gigs</h2></div><span className="status-pill">{assignments.length}</span></div>
      {assignments.length ? <div className="hq-gig-list">{assignments.map(item => { const event = events.get(item.eventId); return <article className="hq-gig-card" key={item.id}><div><span className="eyebrow">{members.get(item.teamMemberId)?.displayName ?? "Team member"} · {item.assignmentRole.replaceAll("_", " ")}</span><h3>{event?.title ?? "Gig"}</h3><p>{item.callTime ? `Call: ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.callTime))}` : "Call time still needs confirmation"}</p></div><Link className="secondary-button" href={`/admin/gigs/${item.eventId}#crew`}>Open crew details</Link></article>; })}</div> : <p className="workspace-empty">No assignments are visible for the next 90 days. Check Calendar for personal availability.</p>}
    </section>
    {snapshot.canManageAssignments || snapshot.canManageTeam ? <Link className="secondary-button" href="/admin/calendar#team">Manage team in Calendar</Link> : null}
  </div>;
}
