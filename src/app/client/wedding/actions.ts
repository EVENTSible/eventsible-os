"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import {
  normalizeWeddingAnswer,
  requiredQuestionKeys,
  weddingProgress,
  weddingQuestionMap,
  WEDDING_COMPANION_VERSION,
  WEDDING_SECTIONS,
} from "@/lib/wedding-companion.mjs";

export type WeddingSaveInput = {
  eventId: string;
  assignmentId: string;
  sectionKey: string;
  answers: Record<string, unknown>;
  submit?: boolean;
};

export type WeddingSaveResult = {
  ok: boolean;
  message: string;
  progress?: number;
  savedAt?: string;
  status?: string;
};

function safeId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function saveWeddingSectionAction(input: WeddingSaveInput): Promise<WeddingSaveResult> {
  const eventId = safeId(input?.eventId);
  const assignmentId = safeId(input?.assignmentId);
  const section = WEDDING_SECTIONS.find((candidate) => candidate.key === input?.sectionKey);
  if (!eventId || !assignmentId || !section || !input.answers || typeof input.answers !== "object") {
    return { ok: false, message: "This Wedding Companion save request was incomplete." };
  }

  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { ok: false, message: "Your session expired. Sign in again before saving." };

  const assignmentResult = await supabase
    .from("os_planning_assignments")
    .select("id,event_id,template_id,status,first_opened_at,submitted_at,settings")
    .eq("id", assignmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (assignmentResult.error || !assignmentResult.data) {
    return { ok: false, message: "You do not have access to this wedding workspace." };
  }

  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) {
    const memberResult = await supabase
      .from("os_event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (memberResult.error || !memberResult.data) {
      return { ok: false, message: "You do not have access to this wedding workspace." };
    }
  }

  const questionMap = weddingQuestionMap();
  const allowedKeys = new Set(section.questions.map((questionItem) => questionItem.key));
  const submittedEntries = Object.entries(input.answers).filter(([key]) => allowedKeys.has(key));
  if (!submittedEntries.length) return { ok: false, message: "There were no answers to save in this section." };

  const sectionResult = await supabase
    .from("os_planning_sections")
    .select("id")
    .eq("template_id", assignmentResult.data.template_id);
  const sectionIds = (sectionResult.data ?? []).map((row) => row.id);
  const databaseQuestions = sectionIds.length
    ? await supabase.from("os_planning_questions").select("id,question_key").in("section_id", sectionIds)
    : { data: [], error: null };
  if (sectionResult.error || databaseQuestions.error) {
    return { ok: false, message: "Wedding Companion question details could not be loaded." };
  }

  const questionIds = new Map((databaseQuestions.data ?? []).map((row) => [row.question_key, row.id]));
  const source = isStaffRole(role) ? "staff" : "client";
  const answerRows = submittedEntries.map(([key, rawValue]) => ({
    assignment_id: assignmentId,
    question_id: questionIds.get(key) ?? null,
    question_key: key,
    value: normalizeWeddingAnswer(questionMap.get(key), rawValue),
    source,
    is_confirmed: false,
    updated_by: user.id,
  }));

  const saveResult = await supabase
    .from("os_planning_answers")
    .upsert(answerRows, { onConflict: "assignment_id,question_key" });
  if (saveResult.error) return { ok: false, message: "Your answers could not be saved. Please try again." };

  const allAnswersResult = await supabase
    .from("os_planning_answers")
    .select("question_key,value")
    .eq("assignment_id", assignmentId);
  if (allAnswersResult.error) return { ok: false, message: "Your answers saved, but progress could not be refreshed." };

  const allAnswers = Object.fromEntries((allAnswersResult.data ?? []).map((row) => [row.question_key, row.value]));
  const progress = weddingProgress(allAnswers);
  const missingRequired = requiredQuestionKeys(allAnswers).filter((key) => {
    const value = allAnswers[key];
    return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  });
  if (input.submit && missingRequired.length) {
    return {
      ok: false,
      progress,
      message: `Saved, but ${missingRequired.length} required answer${missingRequired.length === 1 ? " is" : "s are"} still missing.`,
    };
  }

  const savedAt = new Date().toISOString();
  const status = input.submit ? "submitted" : "in_progress";
  const admin = createAdminSupabase();
  const previousSettings = assignmentResult.data.settings && typeof assignmentResult.data.settings === "object"
    ? assignmentResult.data.settings
    : {};
  const assignmentUpdate = await admin.from("os_planning_assignments").update({
    status,
    progress_percent: progress,
    current_section_key: section.key,
    first_opened_at: assignmentResult.data.first_opened_at ?? savedAt,
    last_opened_at: savedAt,
    last_saved_at: savedAt,
    submitted_at: input.submit ? savedAt : assignmentResult.data.submitted_at,
    settings: { ...previousSettings, source: WEDDING_COMPANION_VERSION },
  }).eq("id", assignmentId).eq("event_id", eventId);
  if (assignmentUpdate.error) {
    return { ok: false, progress, message: "Your answers saved, but the completion status could not be updated." };
  }

  if (input.submit) {
    await admin.from("os_activity_events").insert({
      event_id: eventId,
      actor_user_id: user.id,
      event_type: "planning.submitted",
      visibility: "staff",
      payload: { summary: "Wedding Companion submitted for EVENTSible review.", source: WEDDING_COMPANION_VERSION },
    });
  }

  revalidatePath("/client");
  revalidatePath(`/client/wedding/${eventId}`);
  revalidatePath(`/admin/wedding/${eventId}`);

  return {
    ok: true,
    progress,
    savedAt,
    status,
    message: input.submit ? "Wedding Companion submitted to EVENTSible." : "Saved.",
  };
}
