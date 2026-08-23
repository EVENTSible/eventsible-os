"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  sendWeddingHeroOwnerNotification,
  WEDDING_HERO_SUBMITTED_NOTIFICATION,
} from "@/lib/notifications/wedding-hero-email.mjs";
import { WEDDING_COMPANION_VERSION } from "@/lib/wedding-companion.mjs";
import { buildWeddingSubmissionDigest } from "@/lib/wedding-day-sheet.mjs";
import { validateWeddingHeroPlanSubmission } from "@/lib/wedding-hero-submission.mjs";

export type PublicWeddingHeroSubmissionInput = {
  draftId: string;
  submissionId: string;
  contactName: string;
  email?: string;
  phone?: string;
  company?: string;
  mode: "guided" | "form" | "print";
  sectionKey?: string;
  answers: Record<string, unknown>;
};

export type PublicWeddingHeroSubmissionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  submittedAt?: string;
  progress?: number;
  status?: "submitted";
  eventId?: string;
  assignmentId?: string;
};

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function splitName(displayName: string) {
  const parts = displayName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function submissionHistory(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return [];
  const history = (settings as Record<string, unknown>).wedding_hero_submissions;
  return Array.isArray(history) ? history.filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[] : [];
}

export async function submitPublicWeddingHeroPlanAction(input: PublicWeddingHeroSubmissionInput): Promise<PublicWeddingHeroSubmissionResult> {
  const validation = validateWeddingHeroPlanSubmission(input);
  if (!validation.ok) {
    return validation.blocked
      ? { ok: true, message: "Your Wedding Hero plan was received." }
      : {
          ok: false,
          message: validation.message,
          errors: validation.errors
            ? Object.fromEntries(Object.entries(validation.errors).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
            : undefined,
        };
  }
  if (!validation.data) return { ok: false, message: "This Wedding Hero plan could not be validated." };

  const request = validation.data;
  const submittedAt = new Date().toISOString();

  try {
    const admin = createAdminSupabase();
    const existingAssignment = await admin
      .from("os_planning_assignments")
      .select("id,event_id,template_id,status,submitted_at,settings")
      .eq("settings->>public_draft_id", request.draftId)
      .limit(1)
      .maybeSingle();
    if (existingAssignment.error) return { ok: false, message: "EVENTSible could not check this device draft. Please try again." };

    const previousSubmission = submissionHistory(existingAssignment.data?.settings)
      .find((entry) => entry.submission_id === request.submissionId);
    if (existingAssignment.data && previousSubmission) {
      return {
        ok: true,
        message: "Your Wedding Hero plan was already received by EVENTSible.",
        submittedAt: answerText(previousSubmission.submitted_at) || answerText(existingAssignment.data.submitted_at) || submittedAt,
        progress: request.progress,
        status: "submitted",
        eventId: existingAssignment.data.event_id,
        assignmentId: existingAssignment.data.id,
      };
    }

    const coupleNames = [answerText(request.answers.partner_one_name), answerText(request.answers.partner_two_name)]
      .filter(Boolean)
      .join(" & ");
    const eventDate = answerText(request.answers.event_date);
    let assignment = existingAssignment.data;
    let contactId: string | null = null;
    let eventId = answerText(assignment?.event_id);

    if (!assignment) {
      const templateResult = await admin
        .from("os_planning_templates")
        .select("id")
        .eq("slug", "wedding-hero")
        .eq("status", "published")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (templateResult.error || !templateResult.data) {
        return { ok: false, message: "Wedding Hero submissions are temporarily unavailable. Please call or text EVENTSible." };
      }

      const name = splitName(request.contactName);
      const contactWrite = await admin.from("os_contacts").insert({
        first_name: name.firstName,
        last_name: name.lastName,
        display_name: request.contactName,
        primary_email: request.email,
        primary_phone: request.phone,
        source: "wedding_hero_public_submission",
        status: "active",
        metadata: {
          source: "wedding_hero_public_submission",
          public_draft_id: request.draftId,
          contact_unverified: true,
        },
      }).select("id").single();
      if (contactWrite.error || !contactWrite.data) return { ok: false, message: "Your contact details could not be recorded. Please try again." };
      contactId = contactWrite.data.id;

      const eventWrite = await admin.from("os_events").insert({
        primary_contact_id: contactId,
        title: coupleNames ? `${coupleNames} wedding` : `${request.contactName} wedding`,
        event_type: "Wedding",
        status: "inquiry",
        starts_at: null,
        timezone: "America/Indiana/Indianapolis",
        source: "wedding_hero_public_submission",
        settings: {
          source: "wedding_hero_public_submission",
          public_draft_id: request.draftId,
          contact_unverified: true,
          wedding_date_from_planner: eventDate || null,
        },
      }).select("id").single();
      if (eventWrite.error || !eventWrite.data) return { ok: false, message: "Your wedding record could not be created. Please try again." };
      eventId = eventWrite.data.id;

      const assignmentWrite = await admin.from("os_planning_assignments").insert({
        event_id: eventId,
        template_id: templateResult.data.id,
        status: "in_progress",
        progress_percent: request.progress,
        current_section_key: request.sectionKey,
        first_opened_at: submittedAt,
        last_opened_at: submittedAt,
        last_saved_at: submittedAt,
        settings: {
          source: WEDDING_COMPANION_VERSION,
          intake_source: "wedding_hero_public_submission",
          public_draft_id: request.draftId,
          contact_unverified: true,
        },
      }).select("id,event_id,template_id,status,submitted_at,settings").single();
      if (assignmentWrite.error || !assignmentWrite.data) return { ok: false, message: "Your Wedding Hero plan could not be opened for EVENTSible. Please try again." };
      assignment = assignmentWrite.data;

      await admin.from("os_leads").insert({
        contact_id: contactId,
        event_id: eventId,
        status: "new",
        source: "wedding_hero_public_submission",
        inquiry_summary: `Wedding Hero plan submitted by ${request.contactName}.`,
        metadata: {
          planning_assignment_id: assignment.id,
          public_draft_id: request.draftId,
          contact_unverified: true,
        },
      });
    } else {
      const eventResult = await admin
        .from("os_events")
        .select("id,primary_contact_id,source,settings")
        .eq("id", eventId)
        .maybeSingle();
      if (eventResult.error || !eventResult.data) {
        return { ok: false, message: "Your wedding record could not be refreshed. Please try again." };
      }
      if (eventResult.data.source === "wedding_hero_public_submission") {
        const eventSettings = eventResult.data.settings && typeof eventResult.data.settings === "object" && !Array.isArray(eventResult.data.settings)
          ? eventResult.data.settings as Record<string, unknown>
          : {};
        const eventUpdate = await admin.from("os_events").update({
          title: coupleNames ? `${coupleNames} wedding` : `${request.contactName} wedding`,
          settings: {
            ...eventSettings,
            wedding_date_from_planner: eventDate || null,
          },
        }).eq("id", eventId);
        if (eventUpdate.error) {
          return { ok: false, message: "Your wedding date could not be refreshed. Please try again." };
        }
      }
      contactId = eventResult.data?.primary_contact_id ?? null;
      if (contactId) {
        const contactResult = await admin.from("os_contacts").select("source").eq("id", contactId).maybeSingle();
        if (contactResult.data?.source === "wedding_hero_public_submission") {
          await admin.from("os_contacts").update({
            display_name: request.contactName,
            primary_email: request.email,
            primary_phone: request.phone,
          }).eq("id", contactId);
        }
      }
    }

    const sectionResult = await admin
      .from("os_planning_sections")
      .select("id")
      .eq("template_id", assignment.template_id);
    const sectionIds = (sectionResult.data ?? []).map((row) => row.id);
    const questionResult = sectionIds.length
      ? await admin.from("os_planning_questions").select("id,question_key").in("section_id", sectionIds)
      : { data: [], error: null };
    if (sectionResult.error || questionResult.error) return { ok: false, message: "Wedding Hero question details could not be loaded." };

    const questionIds = new Map((questionResult.data ?? []).map((row) => [row.question_key, row.id]));
    const answerRows = Object.entries(request.answers).map(([key, value]) => ({
      assignment_id: assignment.id,
      question_id: questionIds.get(key) ?? null,
      question_key: key,
      value,
      source: "client",
      is_confirmed: false,
    }));
    const saveResult = await admin.from("os_planning_answers").upsert(answerRows, { onConflict: "assignment_id,question_key" });
    if (saveResult.error) return { ok: false, message: "Your answers could not be recorded. Please try again." };

    const previousSettings = assignment.settings && typeof assignment.settings === "object" && !Array.isArray(assignment.settings)
      ? assignment.settings as Record<string, unknown>
      : {};
    const history = submissionHistory(previousSettings);
    const submissionRecord = {
      submission_id: request.submissionId,
      submitted_at: submittedAt,
      progress_percent: request.progress,
      mode: request.mode,
      contact_name: request.contactName,
      email: request.email,
      phone: request.phone,
    };
    const assignmentUpdate = await admin.from("os_planning_assignments").update({
      status: "submitted",
      progress_percent: request.progress,
      current_section_key: request.sectionKey,
      last_opened_at: submittedAt,
      last_saved_at: submittedAt,
      submitted_at: submittedAt,
      settings: {
        ...previousSettings,
        source: WEDDING_COMPANION_VERSION,
        intake_source: "wedding_hero_public_submission",
        public_draft_id: request.draftId,
        latest_submission_id: request.submissionId,
        wedding_hero_submissions: [...history, submissionRecord].slice(-20),
      },
    }).eq("id", assignment.id).eq("event_id", eventId);
    if (assignmentUpdate.error) return { ok: false, message: "Your answers saved, but the submission status could not be recorded." };

    await admin.from("os_activity_events").insert({
      event_id: eventId,
      contact_id: contactId,
      event_type: "planning.submitted",
      visibility: "staff",
      payload: {
        summary: "Public Wedding Hero plan submitted for EVENTSible review.",
        submission_id: request.submissionId,
        progress_percent: request.progress,
        mode: request.mode,
        source: "wedding_hero_public_submission",
      },
    });

    const digest = buildWeddingSubmissionDigest(request.answers);
    let notificationWarning = "";
    try {
      await sendWeddingHeroOwnerNotification({
        kind: WEDDING_HERO_SUBMITTED_NOTIFICATION,
        context: {
          coupleNames: coupleNames || request.contactName,
          eventDate,
          progress: request.progress,
          mode: request.mode,
          source: "public_planner",
          eventId,
          assignmentId: assignment.id,
          contactName: request.contactName,
          email: request.email,
          phone: request.phone,
          privatePlanAvailable: false,
          ...digest,
        },
        requestId: request.submissionId,
        createdAt: submittedAt,
      });
    } catch {
      notificationWarning = " Your plan is recorded, but the owner alert needs staff follow-up.";
      await admin.from("os_activity_events").insert({
        event_id: eventId,
        contact_id: contactId,
        event_type: "planning.notification_failed",
        visibility: "staff",
        payload: { summary: "Public Wedding Hero submission owner notification failed.", submission_id: request.submissionId },
      });
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/wedding/${eventId}`);
    return {
      ok: true,
      message: `Your Wedding Hero plan was sent to EVENTSible.${notificationWarning}`,
      submittedAt,
      progress: request.progress,
      status: "submitted",
      eventId,
      assignmentId: assignment.id,
    };
  } catch {
    return { ok: false, message: "Wedding Hero could not send your plan right now. Please try again or contact EVENTSible." };
  }
}
