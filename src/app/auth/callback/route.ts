import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/admin";
  const next = requestedNext.startsWith("/") ? requestedNext : "/admin";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${host}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
