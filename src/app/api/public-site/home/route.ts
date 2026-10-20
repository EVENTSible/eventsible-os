import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const publicHeaders = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=60", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const supabase = createAdminSupabase();
    const { data: page, error } = await supabase.from("os_site_content_revisions")
      .select("revision,content").eq("page_key", "home").eq("state", "published").maybeSingle();
    if (error) throw new Error("site content unavailable");
    if (!page) return NextResponse.json({ version: 1, content: null }, { headers: publicHeaders });

    const raw = page.content as Record<string, unknown>;
    const field = (key: string, limit: number) => typeof raw[key] === "string" ? String(raw[key]).slice(0, limit) : "";
    const content: Record<string, string | null> = {
      heading: field("heading", 110),
      highlight: field("highlight", 70),
      subheading: field("subheading", 600),
      portfolio_heading: field("portfolio_heading", 140),
      portfolio_body: field("portfolio_body", 600),
      hero_media_url: null,
      hero_media_alt: null,
    };
    if (typeof raw.hero_media_id === "string") {
      const { data: media } = await supabase.from("os_site_media").select("public_url,alt_text")
        .eq("id", raw.hero_media_id).eq("status", "approved")
        .eq("usage_approved", true).eq("permission_confirmed", true).maybeSingle();
      if (media?.public_url?.startsWith("https://")) {
        content.hero_media_url = media.public_url;
        content.hero_media_alt = media.alt_text;
      }
    }
    return NextResponse.json({ version: 1, revision: page.revision, content }, { headers: publicHeaders });
  } catch {
    return NextResponse.json({ error: "content_unavailable" }, { status: 503, headers: { ...publicHeaders, "Cache-Control": "no-store" } });
  }
}
