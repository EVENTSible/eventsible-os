import { NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { readSiteRows } from "@/lib/public-site-data";

export const dynamic = "force-dynamic";
const publicHeaders = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("site content unavailable");
    const read = (table: "os_site_content_revisions" | "os_site_media", query: Record<string, string>) =>
      readSiteRows(SUPABASE_URL, key, table, query);
    const pages = await read("os_site_content_revisions", {
      select: "revision,content", page_key: "eq.home", state: "eq.published", limit: "2",
    });
    if (pages.length > 1) throw new Error("ambiguous published content");
    const page = pages[0];
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
      power_welcome: field("power_welcome", 32),
      event_types_heading: field("event_types_heading", 140),
      services_heading: field("services_heading", 140),
      services_body: field("services_body", 600),
      featured_heading: field("featured_heading", 140),
      featured_body: field("featured_body", 600),
      final_cta_heading: field("final_cta_heading", 140),
      final_cta_body: field("final_cta_body", 600),
    };
    const allowMedia = process.env.NEXT_PUBLIC_EVENTSIBLE_MEDIA_FREE_RELEASE !== "true";
    if (allowMedia && typeof raw.hero_media_id === "string") {
      const [media] = await read("os_site_media", {
        select: "public_url,alt_text", id: `eq.${raw.hero_media_id}`, status: "eq.approved",
        usage_approved: "eq.true", permission_confirmed: "eq.true", limit: "1",
      });
      if (typeof media?.public_url === "string" && media.public_url.startsWith("https://")) {
        content.hero_media_url = media.public_url;
        content.hero_media_alt = typeof media.alt_text === "string" ? media.alt_text : "";
      }
    }
    // The server returns safe, reviewed media renditions only; never Drive file URLs.
    const allowedSectionIds = new Set(["home-event-types", "home-services", "home-trust", "home-featured-packages", "home-planning-tools", "home-faq"]);
    const sectionOrder = Array.isArray(raw.section_order)
      ? raw.section_order.filter((id): id is string => typeof id === "string" && allowedSectionIds.has(id)).slice(0, 6) : [];
    const visibleSections = Array.isArray(raw.visible_sections)
      ? raw.visible_sections.filter((id): id is string => typeof id === "string" && allowedSectionIds.has(id)).slice(0, 6) : null;
    const rawGalleryIds = allowMedia && Array.isArray(raw.gallery_media_ids)
      ? raw.gallery_media_ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 3) : [];
    let galleryMedia: Array<{ public_url: string; alt_text: string; title: string }> = [];
    if (rawGalleryIds.length) {
      const approved = await read("os_site_media", {
        select: "id,title,alt_text,public_url", id: `in.(${rawGalleryIds.join(",")})`,
        status: "eq.approved", usage_approved: "eq.true", permission_confirmed: "eq.true", limit: "3",
      });
      const byId = new Map((approved ?? []).filter((m) => typeof m.public_url === "string" && m.public_url.startsWith("https://")).map((m) => [m.id,m]));
      galleryMedia = rawGalleryIds.flatMap((id) => {
        const media = byId.get(id);
        return media && typeof media.public_url === "string" ? [{ public_url:media.public_url,
          alt_text:typeof media.alt_text === "string" ? media.alt_text : "",
          title:typeof media.title === "string" ? media.title : "" }] : [];
      });
    }
    const allowedPowerIds = [
      "hq", "fast-track", "builder", "stage", "workshop", "play-connect",
    ] as const;
    const rawPower = raw.power_subtitles &&
      typeof raw.power_subtitles === "object" && !Array.isArray(raw.power_subtitles)
      ? raw.power_subtitles as Record<string, unknown> : {};
    const powerSubtitles = Object.fromEntries(
      allowedPowerIds.map((id) => [
        id,
        typeof rawPower[id] === "string" ? String(rawPower[id]).slice(0, 52) : "",
      ]),
    );
    return NextResponse.json({
      version: 1, revision: page.revision,
      content: { ...content, power_subtitles:powerSubtitles, section_order:sectionOrder, visible_sections:visibleSections, gallery_media:galleryMedia },
    }, { headers: publicHeaders });
  } catch {
    return NextResponse.json({ error: "content_unavailable" }, { status: 503, headers: { ...publicHeaders, "Cache-Control": "no-store" } });
  }
}
