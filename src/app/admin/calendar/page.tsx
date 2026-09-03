import { redirect } from "next/navigation";
import { HqCalendar, type CalendarEvent } from "@/components/hq-calendar";
import { HQ_CALENDAR_TIME_ZONE, localDateKey, shapeCalendarEvent } from "@/lib/hq-calendar.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Calendar | EVENTSible HQ" };

export default async function CalendarPage() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");
  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/login?error=access");

  const result = await supabase
    .from("os_event_dashboard_v")
    .select("event_id,title,event_type,event_status,starts_at,ends_at,timezone,venue_name,venue_summary,booking_id,booking_status,booked_services")
    .order("starts_at", { ascending: true, nullsFirst: false });
  const shaped = (result.data ?? []).map(shapeCalendarEvent) as CalendarEvent[];
  const scheduled = shaped.filter((event) => event.id && event.dateKey);
  const unscheduledCount = shaped.filter((event) => !event.dateKey).length;
  const todayKey = localDateKey(new Date(), HQ_CALENDAR_TIME_ZONE) ?? new Date().toISOString().slice(0, 10);

  return (
      <div className="admin-main calendar-main">
        <header className="admin-header calendar-header"><div><span className="eyebrow">Calendar / Date Book</span><h1>Know what is booked before the day gets complicated.</h1><p>Canonical EVENTSible OS events, conservative booked/open dates, and one path back to each Gig Workspace.</p></div><div className="header-actions"><a className="secondary-button" href="/admin">Mission Control</a><a className="primary-button" href="/admin#gig-workspace">Booked Gigs</a></div></header>
        {result.error ? <div className="alert warning"><b>Calendar data could not be loaded.</b><p>No date is being represented as Open or Booked from an unavailable query.</p></div> : <HqCalendar events={scheduled} todayKey={todayKey} unscheduledCount={unscheduledCount} />}
      </div>
  );
}
