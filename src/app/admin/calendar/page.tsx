import { redirect } from "next/navigation";
import { manageAssignmentAction, manageTeamMemberAction, removeAvailabilityAction, upsertAvailabilityAction } from "@/app/admin/calendar/actions";
import { HqCalendar, type CalendarEvent, type StaffAssignment, type TeamAvailability, type TeamMember } from "@/components/hq-calendar";
import { HQ_CALENDAR_TIME_ZONE, localDateKey, shapeCalendarEvent } from "@/lib/hq-calendar.mjs";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { operationalConflictWindow } from "@/lib/team-availability.mjs";

export const metadata = { title: "Team Calendar | EVENTSible HQ" };

type SearchParams = Promise<{ notice?: string; error?: string }>;
type Snapshot = {
  currentTeamMemberId?: string | null;
  canManageTeam?: boolean;
  canManageAssignments?: boolean;
  teamMembers?: TeamMember[];
  availability?: TeamAvailability[];
  assignments?: StaffAssignment[];
};

function dateOffsetKey(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const authorization = await authorizeHqCapability("schedule.read");
  if (!authorization.ok) redirect(authorization.reason === "unauthenticated" ? "/login" : "/access-denied");
  const { supabase } = authorization;
  const params = await searchParams;

  const [dashboardResult, eventSettingsResult, factResult, snapshotResult] = await Promise.all([
    supabase.from("os_event_dashboard_v").select("event_id,title,event_type,event_status,starts_at,ends_at,timezone,venue_name,venue_summary,booking_id,booking_status,booked_services").order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.from("os_events").select("id,settings"),
    supabase.from("os_event_facts").select("event_id,fact_key,value").in("fact_key", ["event.arrival_time", "event.load_in_window", "event.breakdown_start", "event.must_be_out"]),
    supabase.rpc("os_team_calendar_snapshot", { p_from: dateOffsetKey(-90), p_to: dateOffsetKey(310) }),
  ]);

  const settingsByEvent = new Map((eventSettingsResult.data ?? []).map((row) => [String(row.id), row.settings ?? {}]));
  const facts = factResult.data ?? [];
  const shaped = (dashboardResult.data ?? []).map((row) => {
    const event = shapeCalendarEvent(row) as CalendarEvent;
    return { ...event, ...operationalConflictWindow(event, settingsByEvent.get(event.id), facts) };
  });
  const scheduled = shaped.filter((event) => event.id && event.dateKey);
  const unscheduledCount = shaped.filter((event) => !event.dateKey).length;
  const todayKey = localDateKey(new Date(), HQ_CALENDAR_TIME_ZONE) ?? new Date().toISOString().slice(0, 10);
  const snapshot = (snapshotResult.data ?? {}) as Snapshot;
  const loadError = dashboardResult.error || eventSettingsResult.error || factResult.error;

  return (
    <div className="admin-main calendar-main">
      <header className="admin-header calendar-header">
        <div><span className="eyebrow">Shared Master Calendar</span><h1>One scheduling picture for the EVENTSible team.</h1><p>Canonical gigs, tentative dates, staff assignments, outside bookings, and privacy-safe availability—without turning personal commitments into customer records.</p></div>
        <div className="header-actions"><a className="secondary-button" href="/admin">Mission Control</a><a className="primary-button" href="#add-availability">Add availability</a></div>
      </header>
      {params.notice ? <div className="alert success" role="status">{params.notice}</div> : null}
      {params.error ? <div className="alert warning" role="alert">{params.error}</div> : null}
      {loadError ? <div className="alert warning"><b>Some canonical event timing details could not be loaded.</b><p>Unknown timing is not treated as proof of availability.</p></div> : null}
      {snapshotResult.error ? <div className="alert warning"><b>Team availability is not available in this environment.</b><p>Canonical gigs remain visible; no personal schedule is represented as complete.</p></div> : null}
      <HqCalendar
        events={scheduled}
        todayKey={todayKey}
        unscheduledCount={unscheduledCount}
        teamMembers={snapshot.teamMembers ?? []}
        availability={snapshot.availability ?? []}
        assignments={snapshot.assignments ?? []}
        currentTeamMemberId={snapshot.currentTeamMemberId ?? null}
        canManageTeam={Boolean(snapshot.canManageTeam)}
        canManageAssignments={Boolean(snapshot.canManageAssignments)}
        upsertAvailabilityAction={upsertAvailabilityAction}
        removeAvailabilityAction={removeAvailabilityAction}
        manageAssignmentAction={manageAssignmentAction}
        manageTeamMemberAction={manageTeamMemberAction}
      />
    </div>
  );
}
