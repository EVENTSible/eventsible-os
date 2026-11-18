import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { googleCalendarConfig, saveGoogleConnection } from "@/lib/google-calendar/server";
import { exchangeCode, GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar/protocol.mjs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const finish = (code: string) => NextResponse.redirect(new URL(`/admin/calendar?${code === "connected" ? "notice=Google%20Calendar%20connected.%20Select%20a%20calendar%20to%20sync." : "error=Google%20Calendar%20authorization%20did%20not%20complete."}`,origin));
  const jar = await cookies();
  const stateCookie = jar.get("hq_google_oauth_state")?.value;
  jar.delete("hq_google_oauth_state");
  const config = googleCalendarConfig();
  if (!config || origin !== new URL(config.redirectUri).origin || request.nextUrl.searchParams.has("error")) return finish("error");
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.role !== "owner") return finish("error");
  const supplied = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const [ownerId,expected,extra] = String(stateCookie ?? "").split(".");
  const a = Buffer.from(supplied), b = Buffer.from(expected ?? "");
  if (extra || ownerId !== auth.user.id || !code || !supplied || a.length !== b.length || !timingSafeEqual(a,b)) return finish("error");
  try {
    const token = await exchangeCode(code,config.clientId,config.clientSecret,config.redirectUri);
    if (!token.refresh_token || !token.access_token || !String(token.scope ?? "").split(" ").includes(GOOGLE_CALENDAR_SCOPE)) return finish("error");
    await saveGoogleConnection(auth.user.id,token.refresh_token,token.access_token,config);
    return finish("connected");
  } catch { return finish("error"); }
}
