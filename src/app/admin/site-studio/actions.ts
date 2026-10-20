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
  const heroMediaId = clean(form, "hero_media_id", 40);
  if (!heading || !highlight || !subheading) redirect("/admin/site-studio?error=required");
  if (heroMediaId && !uuid.test(heroMediaId)) redirect("/admin/site-studio?error=media");

  if (heroMediaId) {
    const { data, error } = await auth.supabase.from("os_site_media")
      .select("id").eq("id", heroMediaId).eq("status", "approved")
      .eq("usage_approved", true).eq("permission_confirmed", true).maybeSingle();
    if (error || !data) redirect("/admin/site-studio?error=media");
  }
  const { error } = await auth.supabase.from("os_site_content_revisions").insert({
    page_key: "home",
    state: "draft",
    content: {
      heading, highlight, subheading,
      portfolio_heading: portfolioHeading,
      portfolio_body: portfolioBody,
      hero_media_id: heroMediaId || null,
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
