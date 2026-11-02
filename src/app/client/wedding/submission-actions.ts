"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendWeddingHeroOwnerNotification, WEDDING_HERO_SUBMITTED_NOTIFICATION } from "@/lib/notifications/wedding-hero-email.mjs";
import { WEDDING_COMPANION_VERSION } from "@/lib/wedding-companion.mjs";
import { buildWeddingSubmissionDigest } from "@/lib/wedding-day-sheet.mjs";
import { validateWeddingHeroPlanSubmission } from "@/lib/wedding-hero-submission.mjs";

export type PublicWeddingHeroSubmissionInput = {
  draftId: string; submissionId: string; contactName: string; email?: string; phone?: string; company?: string;
  mode: "guided" | "form" | "print"; sectionKey?: string; answers: Record<string, unknown>;
};
export type PublicWeddingHeroSubmissionResult = {
  ok: boolean; message: string; errors?: Record<string, string>; submittedAt?: string;
  progress?: number; status?: "submitted"; eventId?: string; assignmentId?: string;
};

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/** The database RPC serializes public draft writes with Owner reconciliation. No partial REST write is allowed. */
export async function submitPublicWeddingHeroPlanAction(input: PublicWeddingHeroSubmissionInput): Promise<PublicWeddingHeroSubmissionResult> {
  const validation = validateWeddingHeroPlanSubmission(input);
  if (!validation.ok) return validation.blocked
    ? { ok: true, message: "Your Wedding Hero plan was received." }
    : { ok: false, message: validation.message, errors: validation.errors as Record<string, string> | undefined };
  if (!validation.data) return { ok: false, message: "This Wedding Hero plan could not be validated." };
  const request = validation.data;
  const coupleNames = [answerText(request.answers.partner_one_name), answerText(request.answers.partner_two_name)].filter(Boolean).join(" & ");
  const eventDate = answerText(request.answers.event_date);
  try {
    const admin = createAdminSupabase();
    const result = await admin.rpc("os_submit_public_wedding_hero", { p_input: { ...request, coupleNames, eventDate, companionVersion: WEDDING_COMPANION_VERSION } });
    // Missing migration or database failure fails closed. Never fall back to the old multi-write path.
    if (result.error || !result.data || typeof result.data !== "object") return { ok: false, message: "Wedding Hero submissions are temporarily unavailable. Please contact EVENTSible." };
    const response = result.data as { state?: string; eventId?: string; assignmentId?: string; submittedAt?: string };
    if (response.state === "managed") return { ok: false, message: "This plan is now managed privately by EVENTSible. Contact EVENTSible for an approved update." };
    if (!response.eventId || !response.assignmentId || !["submitted", "duplicate"].includes(response.state ?? "")) return { ok: false, message: "Wedding Hero could not confirm your plan. Please contact EVENTSible." };
    const submittedAt = response.submittedAt ?? new Date().toISOString();
    if (response.state === "duplicate") return { ok: true, message: "Your Wedding Hero plan was already received by EVENTSible.", submittedAt, progress: request.progress, status: "submitted", eventId: response.eventId, assignmentId: response.assignmentId };
    const digest = buildWeddingSubmissionDigest(request.answers);
    let notificationWarning = "";
    try {
      await sendWeddingHeroOwnerNotification({
        kind: WEDDING_HERO_SUBMITTED_NOTIFICATION,
        context: { coupleNames: coupleNames || request.contactName, eventDate, progress: request.progress, mode: request.mode,
          source: "public_planner", eventId: response.eventId, assignmentId: response.assignmentId, contactName: request.contactName,
          email: request.email, phone: request.phone, privatePlanAvailable: false, ...digest },
        requestId: request.submissionId, createdAt: submittedAt,
      });
    } catch {
      notificationWarning = " Your plan is recorded, but the owner alert needs staff follow-up.";
    }
    revalidatePath("/admin");
    revalidatePath(`/admin/wedding/${response.eventId}`);
    return { ok: true, message: `Your Wedding Hero plan was sent to EVENTSible.${notificationWarning}`, submittedAt, progress: request.progress, status: "submitted", eventId: response.eventId, assignmentId: response.assignmentId };
  } catch {
    return { ok: false, message: "Wedding Hero could not send your plan right now. Please try again or contact EVENTSible." };
  }
}
