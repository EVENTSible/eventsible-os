"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";

const clean = (form: FormData, key: string, maximum: number) =>
  String(form.get(key) ?? "").trim().slice(0, maximum);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveHomepageDraft(form: FormData) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner") redirect("/access-denied");

  const heading = clean(form, "heading", 110);
  const highlight = clean(form, "highlight", 70);
  const subheading = clean(form, "subheading", 600);
  const portfolioHeading = clean(form, "portfolio_heading", 140);
  const portfolioBody = clean(form, "portfolio_body", 600);
  const powerWelcome = clean(form, "power_welcome", 32);
  const powerSubtitles = Object.fromEntries(
    (["hq", "fast-track", "builder", "stage", "workshop", "play-connect"] as const).map((id) => [
      id, clean(form, `power_subtitle_${id}`, 52),
    ]),
  );
  const heroMediaId = clean(form, "hero_media_id", 40);
  const sectionFields = {
    event_types_heading: clean(form, "event_types_heading", 140),
    services_heading: clean(form, "services_heading", 140),
    services_body: clean(form, "services_body", 600),
    featured_heading: clean(form, "featured_heading", 140),
    featured_body: clean(form, "featured_body", 600),
    final_cta_heading: clean(form, "final_cta_heading", 140),
    final_cta_body: clean(form, "final_cta_body", 600),
  };
  const editableSections = ["home-event-types", "home-services", "home-trust", "home-featured-packages", "home-planning-tools", "home-faq"] as const;
  const visible = form.getAll("visible_sections").map(String).filter((id) => editableSections.includes(id as typeof editableSections[number]));
  const chosenOrder = clean(form, "section_order", 350).split(",").filter((id) => editableSections.includes(id as typeof editableSections[number]));
  const sectionOrder = [...new Set([...chosenOrder, ...editableSections])];
  const galleryIds = [...new Set(form.getAll("gallery_media_ids").map(String).filter(Boolean))].slice(0,3);
  if (galleryIds.some((id) => !uuid.test(id))) redirect("/admin/site-studio?error=media");
  if (!heading || !highlight || !subheading) redirect("/admin/site-studio?error=required");
  if (heroMediaId && !uuid.test(heroMediaId)) redirect("/admin/site-studio?error=media");

  if (heroMediaId) {
    const { data, error } = await auth.supabase.from("os_site_media")
      .select("id").eq("id", heroMediaId).eq("status", "approved")
      .eq("usage_approved", true).eq("permission_confirmed", true).maybeSingle();
    if (error || !data) redirect("/admin/site-studio?error=media");
  }
  if (galleryIds.length) {
    const { data, error } = await auth.supabase.from("os_site_media")
      .select("id").in("id",galleryIds).eq("status","approved")
      .eq("usage_approved",true).eq("permission_confirmed",true);
    if (error || data?.length !== galleryIds.length) redirect("/admin/site-studio?error=media");
  }
  const { error } = await auth.supabase.from("os_site_content_revisions").insert({
    page_key: "home",
    state: "draft",
    content: {
      heading, highlight, subheading,
      portfolio_heading: portfolioHeading,
      portfolio_body: portfolioBody,
      hero_media_id: heroMediaId || null,
      power_welcome: powerWelcome,
      power_subtitles: powerSubtitles,
      gallery_media_ids: galleryIds,
      section_order: sectionOrder,
      visible_sections: visible,
      ...sectionFields,
    },
    created_by: auth.user.id,
  });
  if (error) redirect("/admin/site-studio?error=save");
  revalidatePath("/admin/site-studio");
  redirect("/admin/site-studio?saved=1");
}

export async function publishHomepageRevision(form: FormData) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner") redirect("/access-denied");
  const revisionId = clean(form, "revision_id", 40);
  if (!uuid.test(revisionId)) redirect("/admin/site-studio?error=revision");
  const result = await auth.supabase.rpc("os_site_publish_revision", { p_revision_id: revisionId });
  if (result.error) redirect("/admin/site-studio?error=publish");
  revalidatePath("/admin/site-studio");
  redirect("/admin/site-studio?published=1");
}

function driveFileId(value: string): string | null {
  const raw = value.trim();
  if (/^[A-Za-z0-9_-]{12,120}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "file" || segments[1] !== "d" || !segments[2]) return null;
    return /^[A-Za-z0-9_-]{12,120}$/.test(segments[2]) ? segments[2] : null;
  } catch {
    return null;
  }
}

export async function queueDriveMediaForReview(form: FormData) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.user.app_metadata?.role !== "owner") redirect("/access-denied");
  const id = driveFileId(String(form.get("drive_file") ?? ""));
  const title = clean(form, "media_title", 180);
  const altText = clean(form, "media_alt", 240);
  if (!id || !title) redirect("/admin/site-studio?error=drive-candidate");

  // This stores a private metadata-only candidate with both permission flags false.
  // No Drive file is downloaded, shared, moved, approved or published.
  const { error } = await auth.supabase.rpc("os_site_queue_drive_media", {
    p_drive_file_id: id,
    p_title: title,
    p_alt_text: altText,
  });
  if (error) redirect("/admin/site-studio?error=drive-queue");
  revalidatePath("/admin/site-studio");
  redirect("/admin/site-studio?queued=1");
}
