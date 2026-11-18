"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { safeGigSaladUrl } from "@/lib/follow-ups.mjs";
import { validOpportunityScreenshot } from "@/lib/opportunity-evidence.mjs";
import { localDateTimeToIso } from "@/lib/team-availability.mjs";

export type OpportunityState = { status: "idle" | "error" | "warning" | "success"; message: string; leadId?: string; contactId?: string };
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string): OpportunityState => ({ status: "error", message });
const screenshotTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);

export async function createOpportunityAction(_state: OpportunityState, form: FormData): Promise<OpportunityState> {
  const auth = await authorizeHqCapability("data.readiness.manage");
  if (!auth.ok) return fail("Owner authorization is required.");
  const operationId = value(form, "operation_id");
  if (!UUID.test(operationId)) return fail("Reload the form before saving this opportunity.");
  const screenshot = form.get("screenshot");
  let screenshotBytes: Uint8Array | null = null;
  if (screenshot instanceof File && screenshot.size > 0) {
    if (!screenshotTypes.has(screenshot.type) || screenshot.size > 5 * 1024 * 1024) return fail("Use a PNG, JPG or WebP screenshot under 5 MB.");
    screenshotBytes = new Uint8Array(await screenshot.arrayBuffer());
    if (!validOpportunityScreenshot(screenshotBytes, screenshot.type)) return fail("The screenshot does not match its image type.");
  }
  const originalMessage = value(form, "original_message");
  if (!originalMessage && !screenshotBytes) return fail("Paste the original inquiry or attach its screenshot.");
  const source = value(form, "source");
  const thread = value(form, "thread_url");
  const threadUrl = source === "gigsalad" ? safeGigSaladUrl(thread) : (() => {
    if (!thread) return "";
    try { const url = new URL(thread); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  })();
  if (!threadUrl && (source === "gigsalad" || thread)) return fail("Enter the original HTTPS source thread URL.");
  if (value(form, "verified") !== "yes") return fail("Review the client, event, and quote facts before saving.");
  const quoteState = value(form, "quote_state");
  if (!["unknown", "draft", "confirmed_sent"].includes(quoteState)) return fail("Choose the verified quote state.");
  const quoteAmount = value(form, "quote_amount");
  const deposit = value(form, "deposit");
  if (quoteState !== "unknown" && (!quoteAmount || !Number.isFinite(Number(quoteAmount)) || Number(quoteAmount) < 0 || Number(deposit || 0) < 0 || Number(deposit || 0) > Number(quoteAmount))) return fail("Check the original quote and deposit amounts.");
  if (quoteState === "confirmed_sent" && (!value(form, "sent_at") || !value(form, "original_reply") || value(form, "sent_confirmed") !== "yes")) return fail("Confirm the actual sent reply and date before recording a sent quote.");
  let sentAt: string | null = null;
  if (quoteState === "confirmed_sent") {
    try { sentAt = localDateTimeToIso(value(form, "sent_at"), "America/Indiana/Indianapolis"); }
    catch { return fail("Enter a valid Indiana date and time for the sent reply."); }
  }
  const due = value(form, "due_at");
  const dueAt = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T12:00:00Z` : null;
  if (due && !dueAt) return fail("Choose a valid next-action date.");
  const contactId = value(form, "contact_id");
  const assignee = value(form, "assignee");
  if ((contactId && !UUID.test(contactId)) || (assignee && !UUID.test(assignee))) return fail("Choose an existing HQ contact or staff member.");
  const screenshotPath = screenshotBytes && screenshot instanceof File
    ? `intake/${operationId}.${screenshotTypes.get(screenshot.type)}` : "";
  let screenshotUploaded = false;
  if (screenshotPath && screenshotBytes && screenshot instanceof File) {
    const bucket = auth.supabase.storage.from("opportunity-evidence");
    const { error } = await bucket
      .upload(screenshotPath, screenshotBytes, { contentType: screenshot.type, upsert: false });
    if (error && error.statusCode !== "409") return fail("Private screenshot upload failed. No opportunity was created. Check the image and retry.");
    if (error) {
      const existing = await bucket.download(screenshotPath);
      if (existing.error || !existing.data ||
          createHash("sha256").update(new Uint8Array(await existing.data.arrayBuffer())).digest("hex") !==
          createHash("sha256").update(screenshotBytes).digest("hex")) {
        return fail("A different screenshot already exists for this intake attempt. Reload and review before saving.");
      }
    }
    screenshotUploaded = !error;
  }
  const result = await auth.supabase.rpc("os_create_opportunity", {
    p_operation_id: operationId,
    p_payload: {
      source, threadUrl, contactId, clientName: value(form, "client_name"), email: value(form, "email"), phone: value(form, "phone"),
      eventType: value(form, "event_type"), eventDate: value(form, "event_date"), venue: value(form, "venue"), city: value(form, "city"),
      summary: value(form, "summary"), originalMessage, originalReply: value(form, "original_reply"),
      quoteState, quoteAmount, deposit, serviceOptions: value(form, "service_options"), sentAt,
      assignee, dueAt, priority: value(form, "priority"),
      screenshotPath, screenshotType: screenshot instanceof File && screenshotPath ? screenshot.type : "",
      screenshotName: screenshot instanceof File && screenshotPath ? screenshot.name.slice(0, 180) : "",
    },
  });
  if (result.error) {
    // A timeout may mean the transaction committed. Keep the private upload for a safe retry.
    if (screenshotUploaded && screenshotPath && ["PGRST202", "23505", "22023", "42501"].includes(result.error.code)) {
      await auth.supabase.storage.from("opportunity-evidence").remove([screenshotPath]);
    }
    if (result.error.code === "PGRST202") return fail("Opportunity Desk database update is not installed. No records were created.");
    if (result.error.code === "23505") return fail("This GigSalad conversation already exists. Open the existing lead on the board.");
    if (result.error.code === "42501") return fail("Owner authorization is required.");
    return fail("Intake could not be saved. No partial opportunity was created. Review the required facts and retry.");
  }
  const data = result.data as { status?: string; leadId?: string; eventId?: string; contactId?: string } | null;
  if (data?.status === "duplicate_warning") {
    if (screenshotUploaded && screenshotPath) await auth.supabase.storage.from("opportunity-evidence").remove([screenshotPath]);
    return { status: "warning", message: "A matching contact or open lead already exists. Review it in HQ and choose that contact before attempting a separate inquiry.", contactId: data.contactId };
  }
  if (!data?.leadId || !data.eventId) return fail("Intake returned no lead. Review the record before retrying.");
  revalidatePath("/admin/mission-control/follow-ups");
  revalidatePath("/admin");
  return { status: "success", message: "Opportunity saved with its task and private source history. No message was sent.", leadId: data.leadId };
}
