import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { GOOGLE_CALENDAR_SCOPE, GoogleCalendarError, listGoogleCalendars, listGoogleEvents, openRefreshToken, refreshAccessToken, sealRefreshToken, shapeGoogleEvent } from "@/lib/google-calendar/protocol.mjs";

type CalendarSource = { calendar_id: string; label: string; timezone: string | null; selected: boolean; share_busy: boolean; sync_token: string | null; last_successful_sync_at: string | null };
type Connection = { owner_user_id: string; refresh_token_ciphertext: string; status: string; last_successful_sync_at: string | null; last_error_code: string | null };

export function googleCalendarConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const tokenKey = process.env.GOOGLE_CALENDAR_TOKEN_KEY;
  if (!clientId || !clientSecret || !redirectUri || !tokenKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  let redirect: URL;
  try { redirect = new URL(redirectUri); } catch { return null; }
  if (redirect.pathname !== "/api/google-calendar/callback" || redirect.search || redirect.hash ||
      (redirect.protocol !== "https:" && !(process.env.NODE_ENV === "development" && redirect.hostname === "localhost"))) return null;
  return { clientId, clientSecret, redirectUri, tokenKey };
}

export function googleAuthorizationUrl(state: string, config: NonNullable<ReturnType<typeof googleCalendarConfig>>) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({ client_id:config.clientId, redirect_uri:config.redirectUri, response_type:"code", access_type:"offline", prompt:"consent", scope:GOOGLE_CALENDAR_SCOPE, state })) url.searchParams.set(key, value);
  return url.toString();
}

export async function loadGoogleOwnerSettings(ownerId: string) {
  const config = googleCalendarConfig();
  if (!config) return { configured:false, connected:false, sources:[] as CalendarSource[], status:"not_configured", lastSync:null as string | null };
  const admin = createAdminSupabase();
  const [connection, sources] = await Promise.all([
    admin.from("os_google_calendar_connections").select("owner_user_id,status,last_successful_sync_at,last_error_code").eq("owner_user_id", ownerId).maybeSingle(),
    admin.from("os_google_calendar_sources").select("calendar_id,label,timezone,selected,share_busy,sync_token,last_successful_sync_at").eq("owner_user_id", ownerId).order("label"),
  ]);
  if (connection.error || sources.error) return { configured:false, connected:false, sources:[] as CalendarSource[], status:"schema_pending", lastSync:null as string | null };
  return { configured:true, connected:Boolean(connection.data), sources:(sources.data ?? []) as CalendarSource[], status:connection.data?.status ?? "disconnected", lastSync:connection.data?.last_successful_sync_at ?? null };
}

export async function saveGoogleConnection(ownerId: string, refreshToken: string, accessToken: string, config: NonNullable<ReturnType<typeof googleCalendarConfig>>) {
  const calendars = await listGoogleCalendars(accessToken) as Array<Record<string, unknown>>;
  if (!calendars.length) throw new GoogleCalendarError("no_calendars");
  const admin = createAdminSupabase();
  const primary = calendars.find(row => row.primary);
  const connection = await admin.from("os_google_calendar_connections").upsert({
    owner_user_id:ownerId,refresh_token_ciphertext:sealRefreshToken(refreshToken,config.tokenKey),
    primary_calendar_id:typeof primary?.id === "string" ? primary.id : null,
    status:"connected",last_error_code:null,updated_at:new Date().toISOString(),
  }, { onConflict:"owner_user_id" });
  if (connection.error) throw new GoogleCalendarError("connection_save_failed");
  const rows = calendars.filter(row => typeof row.id === "string" && row.id.length <= 512).map(row => ({
    owner_user_id:ownerId,calendar_id:row.id as string,
    label:String(row.summary ?? "Calendar").slice(0,200),timezone:typeof row.timeZone === "string" ? row.timeZone.slice(0,100) : null,
  }));
  for (const row of rows) {
    const existing = await admin.from("os_google_calendar_sources").select("calendar_id").eq("owner_user_id",ownerId).eq("calendar_id",row.calendar_id).maybeSingle();
    if (existing.error) throw new GoogleCalendarError("calendar_save_failed");
    const saved = existing.data
      ? await admin.from("os_google_calendar_sources").update({label:row.label,timezone:row.timezone}).eq("owner_user_id",ownerId).eq("calendar_id",row.calendar_id)
      : await admin.from("os_google_calendar_sources").insert(row);
    if (saved.error) throw new GoogleCalendarError("calendar_save_failed");
  }
  const known = await admin.from("os_google_calendar_sources").select("calendar_id").eq("owner_user_id",ownerId);
  if (known.error) throw new GoogleCalendarError("calendar_save_failed");
  const permitted = new Set(rows.map(row => row.calendar_id));
  for (const stale of known.data ?? []) {
    if (permitted.has(stale.calendar_id)) continue;
    const removed = await admin.from("os_google_calendar_sources").delete().eq("owner_user_id",ownerId).eq("calendar_id",stale.calendar_id);
    if (removed.error) throw new GoogleCalendarError("calendar_save_failed");
  }
}

export async function selectGoogleCalendars(ownerId: string, selectedIds: string[], sharedIds: string[]) {
  const admin = createAdminSupabase();
  const { data, error } = await admin.from("os_google_calendar_sources").select("calendar_id,selected,share_busy").eq("owner_user_id",ownerId);
  if (error) throw new GoogleCalendarError("calendar_read_failed");
  const ids = new Set((data ?? []).map(row => row.calendar_id));
  if (selectedIds.some(id => !ids.has(id)) || sharedIds.some(id => !selectedIds.includes(id))) throw new GoogleCalendarError("calendar_selection_invalid");
  for (const row of data ?? []) {
    const selected = selectedIds.includes(row.calendar_id);
    const shareBusy = selected && sharedIds.includes(row.calendar_id);
    if (row.selected !== selected || row.share_busy !== shareBusy) {
      const changed = await admin.from("os_google_calendar_sources").update({selected,share_busy:shareBusy}).eq("owner_user_id",ownerId).eq("calendar_id",row.calendar_id);
      if (changed.error) throw new GoogleCalendarError("calendar_selection_failed");
    }
    if (!selected) {
      const purged = await admin.from("os_google_calendar_entries").delete().eq("owner_user_id",ownerId).eq("calendar_id",row.calendar_id);
      if (purged.error) throw new GoogleCalendarError("calendar_selection_failed");
    }
  }
}

export async function syncSelectedGoogleCalendars(ownerId: string) {
  const config = googleCalendarConfig();
  if (!config) throw new GoogleCalendarError("not_configured");
  const admin = createAdminSupabase();
  const { data:connection,error:connectionError } = await admin.from("os_google_calendar_connections")
    .select("owner_user_id,refresh_token_ciphertext,status,last_successful_sync_at,last_error_code").eq("owner_user_id",ownerId).maybeSingle();
  if (connectionError || !connection) throw new GoogleCalendarError("not_connected");
  const { data:sources,error:sourcesError } = await admin.from("os_google_calendar_sources")
    .select("calendar_id,label,timezone,selected,share_busy,sync_token,last_successful_sync_at").eq("owner_user_id",ownerId).eq("selected",true);
  if (sourcesError || !sources?.length) throw new GoogleCalendarError("no_calendar_selected");
  let count = 0;
  try {
    const token = await refreshAccessToken(openRefreshToken((connection as Connection).refresh_token_ciphertext,config.tokenKey),config.clientId,config.clientSecret);
    if (!token.access_token) throw new GoogleCalendarError("reauthorize");
    for (const source of sources as CalendarSource[]) {
      let full = !source.sync_token;
      let fetched;
      try { fetched = await listGoogleEvents(token.access_token,source.calendar_id,source.sync_token); }
      catch (error) {
        if (!(error instanceof GoogleCalendarError) || error.code !== "sync_token_expired") throw error;
        fetched = await listGoogleEvents(token.access_token,source.calendar_id,null);
        full = true;
      }
      const generation = randomUUID();
      const rows = fetched.events.map((event: Record<string, unknown>) => shapeGoogleEvent(event,source.calendar_id,ownerId,generation,source.timezone)).filter(Boolean);
      if (rows.length !== fetched.events.length) throw new GoogleCalendarError("invalid_event_data");
      const applied = await admin.rpc("os_google_calendar_apply", {
        p_owner:ownerId,p_calendar:source.calendar_id,p_expected_token:source.sync_token,
        p_next_token:fetched.syncToken,p_generation:generation,p_full:full,p_entries:rows,
      });
      if (applied.error) throw new GoogleCalendarError(applied.error.code === "40001" ? "stale_sync" : "sync_save_failed");
      count += Number(applied.data ?? 0);
    }
    return { calendars:sources.length,changed:count };
  } catch (error) {
    const code = error instanceof GoogleCalendarError ? error.code : "provider_error";
    await admin.from("os_google_calendar_connections").update({last_error_code:code,status:code === "reauthorize" ? "reauthorize" : "connected",updated_at:new Date().toISOString()}).eq("owner_user_id",ownerId);
    throw new GoogleCalendarError(code);
  }
}

export async function disconnectGoogleCalendar(ownerId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin.from("os_google_calendar_connections").select("refresh_token_ciphertext").eq("owner_user_id",ownerId).maybeSingle();
  let revoked = false;
  const config = googleCalendarConfig();
  if (data && config) {
    try {
      const token = openRefreshToken(data.refresh_token_ciphertext,config.tokenKey);
      const response = await fetch("https://oauth2.googleapis.com/revoke", { method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token}),signal:AbortSignal.timeout(10000),cache:"no-store" });
      revoked = response.ok;
    } catch { /* Local disconnection still removes every stored credential and calendar entry. */ }
  }
  const removed = await admin.from("os_google_calendar_connections").delete().eq("owner_user_id",ownerId);
  if (removed.error) throw new GoogleCalendarError("disconnect_failed");
  return revoked;
}
