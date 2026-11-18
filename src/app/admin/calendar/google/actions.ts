"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { localDateKey } from "@/lib/hq-calendar.mjs";
import { disconnectGoogleCalendar, googleAuthorizationUrl, googleCalendarConfig, selectGoogleCalendars, syncSelectedGoogleCalendars } from "@/lib/google-calendar/server";

async function owner() {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.role !== "owner") redirect("/access-denied");
  return auth.user.id;
}

function go(message: string, error = false): never {
  redirect(`/admin/calendar?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function connectGoogleAction() {
  const ownerId = await owner();
  const config = googleCalendarConfig();
  if (!config) go("Google Calendar is not configured for this environment.",true);
  const nonce = randomBytes(32).toString("base64url");
  (await cookies()).set("hq_google_oauth_state",`${ownerId}.${nonce}`,{
    httpOnly:true,secure:process.env.NODE_ENV !== "development",sameSite:"lax",
    path:"/api/google-calendar/callback",maxAge:600,
  });
  redirect(googleAuthorizationUrl(nonce,config));
}

export async function selectGoogleCalendarsAction(formData: FormData) {
  const ownerId = await owner();
  try {
    await selectGoogleCalendars(ownerId,formData.getAll("calendar_id").map(String),formData.getAll("share_busy").map(String));
    revalidatePath("/admin/calendar");
  } catch { go("Calendar selection could not be saved. No gig was changed.",true); }
  go("Google Calendar selection saved. Use Sync Now to read its events.");
}

export async function syncGoogleCalendarsAction() {
  const ownerId = await owner();
  let message: string;
  try {
    const result = await syncSelectedGoogleCalendars(ownerId);
    revalidatePath("/admin/calendar");
    message = `${result.calendars} Google calendar(s) synced; ${result.changed} external item(s) updated.`;
  } catch { go("Google Calendar could not sync. Check the connection status; HQ gigs are unchanged.",true); }
  go(message);
}

export async function disconnectGoogleAction() {
  const ownerId = await owner();
  let message: string;
  try {
    const revoked = await disconnectGoogleCalendar(ownerId);
    revalidatePath("/admin/calendar");
    message = revoked ? "Google Calendar disconnected and access revoked." : "Google Calendar disconnected locally. Check your Google account access to confirm remote revocation.";
  } catch { go("Google Calendar could not disconnect. Try again.",true); }
  go(message);
}

export async function matchGoogleEntryAction(formData: FormData) {
  const ownerId = await owner();
  const calendarId = String(formData.get("calendar_id") ?? "");
  const googleId = String(formData.get("google_event_id") ?? "");
  const eventId = String(formData.get("hq_event_id") ?? "");
  if (!calendarId || !googleId || !eventId) go("Choose a suggested HQ gig to link.", true);
  const admin = createAdminSupabase();
  const [external, canonical, calendar] = await Promise.all([
    admin.from("os_google_calendar_entries").select("starts_at,starts_on,timezone,visibility,status,title,calendar_id")
      .eq("owner_user_id",ownerId).eq("calendar_id",calendarId).eq("event_id",googleId).maybeSingle(),
    admin.from("os_event_dashboard_v").select("event_id,starts_at,timezone").eq("event_id",eventId).maybeSingle(),
    admin.from("os_google_calendar_sources").select("selected").eq("owner_user_id",ownerId).eq("calendar_id",calendarId).maybeSingle(),
  ]);
  const entry = external.data;
  const event = canonical.data;
  const googleDay = entry?.starts_on || localDateKey(entry?.starts_at,entry?.timezone || undefined);
  const eventDay = localDateKey(event?.starts_at,event?.timezone || undefined);
  if (external.error || canonical.error || calendar.error || !entry || !calendar.data?.selected || !event || entry.status === "cancelled" ||
      ["private","confidential"].includes(entry.visibility) || entry.title === "Busy" || !googleDay || googleDay !== eventDay) {
    go("The selected external entry and HQ gig could not be safely matched.", true);
  }
  const result = await admin.from("os_google_calendar_entries").update({matched_event_id:eventId})
    .eq("owner_user_id",ownerId).eq("calendar_id",calendarId).eq("event_id",googleId)
    .is("matched_event_id",null).select("event_id").maybeSingle();
  if (result.error || !result.data) go("This entry is already linked or could not be linked.", true);
  revalidatePath("/admin/calendar");
  go("External calendar event linked to the existing HQ gig. No gig was created or changed.");
}
