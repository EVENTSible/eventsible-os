import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function safeClientNext(requestedNext: string | null) {
  if (!requestedNext) return null;
  try {
    const decoded = decodeURIComponent(requestedNext);
    return decoded.startsWith("/client") && !decoded.startsWith("//") ? decoded : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const queryNext = searchParams.get("next");
  const cookieNext = request.cookies.get("eventsible_client_next")?.value ?? null;
  const requestedNext = safeClientNext(queryNext) ?? safeClientNext(cookieNext) ?? "/client";
  const next = queryNext?.startsWith("/admin") && !queryNext.startsWith("//") ? queryNext : requestedNext;

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost ? `https://${forwardedHost}` : origin;
      const response = NextResponse.redirect(`${host}${next}`);
      response.cookies.delete("eventsible_client_next");
      return response;
    }
  }

  const failurePath = next.startsWith("/client") ? "/client/login?error=auth" : "/login?error=auth";
  const response = NextResponse.redirect(`${origin}${failurePath}`);
  response.cookies.delete("eventsible_client_next");
  return response;
}
