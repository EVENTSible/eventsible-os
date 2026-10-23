import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import type { SiteMediaOption } from "@/components/site-studio-home-editor";
import { SiteStudioView } from "@/components/site-studio-view-loader";
import {
  publishHomepageRevision,
  queueDriveMediaForReview,
  saveHomepageDraft,
} from "./actions";

export const metadata = { title: "Site Studio | EVENTSible HQ" };

type Revision = {
  id: string;
  revision: number;
  state: string;
  content: Record<string, unknown>;
  created_at: string;
};
type MediaCandidate = {
  id: string;
  drive_file_id: string;
  title: string;
  status: string;
};
const defaults = {
  heading: "We make more of your",
  highlight: "event possible.",
  subheading: "DJ, karaoke, interactive games, photo booths, and original experiences that make your event unforgettable.",
  portfolio_heading: "See EVENTSible in action",
  portfolio_body: "Real moments from real EVENTSible events.",
  hero_media_id: "",
  power_welcome: "Welcome To",
  power_subtitles: {
    hq: "Explore EVENTSible",
    "fast-track": "Quick Quote - Call - Text",
    builder: "Package Builder",
    stage: "Music - Artists - Shows",
    workshop: "The Workshop",
    "play-connect": "Join The Live Experience",
  },
  event_types_heading: "Discover your kind of celebration",
  services_heading: "What EVENTSible brings to the party",
  services_body: "Explore DJs, hosted games, photo booths, wedding experiences, kids parties, and custom creations.",
  featured_heading: "Original experiences worth getting excited about",
  featured_body: "Mix and match services or build a completely custom celebration.",
  final_cta_heading: "Ready to make it EVENTSible?",
  final_cta_body: "Tell us what you're imagining. We'll help turn it into an experience.",
};
const textField = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

export default async function SiteStudioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner") {
    redirect(auth.ok ? "/access-denied" : auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  }

  const params = searchParams ? await searchParams : {};
  const cursor = typeof params.before === "string" && /^[1-9]\d*$/.test(params.before)
    ? Number(params.before) : undefined;
  const before = cursor && Number.isSafeInteger(cursor) ? cursor : undefined;
  let history = auth.supabase.from("os_site_content_revisions")
    .select("id,revision,state,content,created_at").eq("page_key", "home")
    .order("revision", { ascending: false }).limit(21);
  if (before) history = history.lt("revision", before);

  const [revisionsResult, mediaResult, candidatesResult] = await Promise.all([
    history,
    before ? Promise.resolve({ data: [], error: null }) : auth.supabase.from("os_site_media")
      .select("id,title,alt_text,public_url").eq("status", "approved")
      .eq("usage_approved", true).eq("permission_confirmed", true).order("title"),
    before ? Promise.resolve({ data: [], error: null }) : auth.supabase.from("os_site_media")
      .select("id,drive_file_id,title,status")
      .eq("status", "candidate").order("created_at", { ascending: false }).limit(40),
  ]);

  let unavailable = Boolean(revisionsResult.error || mediaResult.error || candidatesResult.error);
  const hasOlder = (revisionsResult.data?.length ?? 0) > 20;
  const revisions = (revisionsResult.data ?? []).slice(0, 20) as Revision[];
  const approvedMedia = (mediaResult.data ?? []) as SiteMediaOption[];
  const candidates = (candidatesResult.data ?? []) as MediaCandidate[];
  let currentRevision = revisions.find((r) => r.state === "draft") ??
    revisions.find((r) => r.state === "published");
  // Restoring an old publication can put it outside the recent history window.
  // Never substitute default copy for that live revision merely due to paging.
  if (!before && !currentRevision && revisions.length) {
    const published = await auth.supabase.from("os_site_content_revisions")
      .select("content").eq("page_key", "home").eq("state", "published").maybeSingle();
    unavailable ||= Boolean(published.error);
    currentRevision = published.data ? { content: published.data.content } as Revision : undefined;
  }
  const current = currentRevision?.content ?? {};
  const initial = {
    heading: textField(current.heading, defaults.heading),
    highlight: textField(current.highlight, defaults.highlight),
    subheading: textField(current.subheading, defaults.subheading),
    portfolio_heading: textField(current.portfolio_heading, defaults.portfolio_heading),
    portfolio_body: textField(current.portfolio_body, defaults.portfolio_body),
    power_welcome: textField(current.power_welcome, defaults.power_welcome),
    power_subtitles: Object.fromEntries(
      Object.entries(defaults.power_subtitles).map(([id, fallback]) => [
        id,
        textField(
          current.power_subtitles &&
            typeof current.power_subtitles === "object" &&
            !Array.isArray(current.power_subtitles)
            ? (current.power_subtitles as Record<string, unknown>)[id]
            : undefined,
          fallback,
        ),
      ]),
    ),
    hero_media_id: approvedMedia.some((media) => media.id === current.hero_media_id)
      ? String(current.hero_media_id)
      : defaults.hero_media_id,
    event_types_heading: textField(current.event_types_heading, defaults.event_types_heading),
    services_heading: textField(current.services_heading, defaults.services_heading),
    services_body: textField(current.services_body, defaults.services_body),
    featured_heading: textField(current.featured_heading, defaults.featured_heading),
    featured_body: textField(current.featured_body, defaults.featured_body),
    final_cta_heading: textField(current.final_cta_heading, defaults.final_cta_heading),
    final_cta_body: textField(current.final_cta_body, defaults.final_cta_body),
    section_order: Array.isArray(current.section_order) ? current.section_order.filter((id): id is string => typeof id === "string") : [],
    visible_sections: Array.isArray(current.visible_sections) ? current.visible_sections.filter((id): id is string => typeof id === "string") : undefined,
    gallery_media_ids: Array.isArray(current.gallery_media_ids)
      ? current.gallery_media_ids.filter((id): id is string => typeof id === "string" && approvedMedia.some((m) => m.id === id)).slice(0,3)
      : [],
  };
  const notice = params.saved ? "Private draft saved. Public site unchanged." :
    params.published ? "Selected revision published to the OS public-content reader." :
    params.queued ? "Drive candidate queued for private review. Nothing was published." :
    params.error ? "Unable to complete the request. Check input, permissions, and local database readiness." : "";

  return <SiteStudioView initial={initial} approvedMedia={approvedMedia} saveAction={saveHomepageDraft}
    unavailable={unavailable} before={before} notice={notice} hasOlder={hasOlder}
    revisions={revisions.map(({id,revision,state,created_at})=>({id,revision,state,created_at}))}
    candidates={candidates} queueAction={queueDriveMediaForReview} publishAction={publishHomepageRevision} />;
}
