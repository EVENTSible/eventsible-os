"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { answerHasValue, EVENT_HERO_VERSION, eventHeroProgress, normalizeEventAnswer } from "@/lib/event-hero.mjs";
import { isStaffRole } from "@/lib/types";

type SaveInput = {
  eventId: string;
  assignmentId: string;
  sectionKey: string;
  answers: Record<string, unknown>;
  submit?: boolean;
};

export type EventHeroSaveResult = {
  ok: boolean;
  message: string;
  progress?: number;
  savedAt?: string;
  status?: string;
};

function safeId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function saveEventHeroSectionAction(input: SaveInput): Promise<EventHeroSaveResult> {
  const eventId = safeId(input?.eventId);
  const assignmentId = safeId(input?.assignmentId);
  if (!eventId || !assignmentId || !input?.sectionKey || !input.answers || typeof input.answers !== "object") {
    return { ok: false, message: "This Event Hero save request was incomplete." };
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
  if (assignmentResult.error || !assignmentResult.data) return { ok: false, message: "You do not have access to this Event Hero workspace." };

  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) {
    const memberResult = await supabase
      .from("os_event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (memberResult.error || !memberResult.data) return { ok: false, message: "You do not have access to this Event Hero workspace." };
  }

  const sectionResult = await supabase
    .from("os_planning_sections")
    .select("id")
    .eq("template_id", assignmentResult.data.template_id)
    .eq("section_key", input.sectionKey)
    .maybeSingle();
  if (sectionResult.error || !sectionResult.data) return { ok: false, message: "This Event Hero section could not be loaded." };

  const questionResult = await supabase
    .from("os_planning_questions")
    .select("id,question_key,field_type,is_required")
    .eq("section_id", sectionResult.data.id)
    .order("sort_order");
  if (questionResult.error) return { ok: false, message: "Event Hero questions could not be loaded." };

  const submittedEntries = Object.entries(input.answers).filter(([key]) => questionResult.data.some((question) => question.question_key === key));
  if (questionResult.data.length && !submittedEntries.length) return { ok: false, message: "There were no answers to save in this section." };

  if (submittedEntries.length) {
    const questionMap = new Map(questionResult.data.map((question) => [question.question_key, question]));
    const saveResult = await supabase.from("os_planning_answers").upsert(submittedEntries.map(([key, value]) => {
      const question = questionMap.get(key)!;
      return {
        assignment_id: assignmentId,
        question_id: question.id,
        question_key: key,
        value: normalizeEventAnswer(question, value),
        source: isStaffRole(role) ? "staff" : "client",
        is_confirmed: false,
        updated_by: user.id,
      };
    }), { onConflict: "assignment_id,question_key" });
    if (saveResult.error) return { ok: false, message: "Your Event Hero answers could not be saved. Please try again." };
  }

  const allSectionsResult = await supabase.from("os_planning_sections").select("id").eq("template_id", assignmentResult.data.template_id);
  const sectionIds = (allSectionsResult.data ?? []).map((section) => section.id);
  const [allQuestionsResult, allAnswersResult] = await Promise.all([
    sectionIds.length
      ? supabase.from("os_planning_questions").select("question_key,field_type,is_required").in("section_id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("os_planning_answers").select("question_key,value").eq("assignment_id", assignmentId),
  ]);
  if (allSectionsResult.error || allQuestionsResult.error || allAnswersResult.error) {
    return { ok: false, message: "Your answers saved, but progress could not be refreshed." };
  }

  const allAnswers = Object.fromEntries((allAnswersResult.data ?? []).map((answer) => [answer.question_key, answer.value]));
  const questions = (allQuestionsResult.data ?? []).map((question) => ({
    key: question.question_key,
    fieldType: question.field_type,
    required: question.is_required,
  }));
  const progress = eventHeroProgress(questions, allAnswers);
  const missingRequired = questions.filter((question) => question.required && !answerHasValue(allAnswers[question.key]));
  if (input.submit && missingRequired.length) {
    return { ok: false, progress, message: `Saved, but ${missingRequired.length} required answer${missingRequired.length === 1 ? " is" : "s are"} still missing.` };
  }

  const savedAt = new Date().toISOString();
  const status = input.submit ? "submitted" : "in_progress";
  const settings = assignmentResult.data.settings && typeof assignmentResult.data.settings === "object" ? assignmentResult.data.settings : {};
  const admin = createAdminSupabase();
  const updateResult = await admin.from("os_planning_assignments").update({
    status,
    progress_percent: progress,
    current_section_key: input.sectionKey,
    first_opened_at: assignmentResult.data.first_opened_at ?? savedAt,
    last_opened_at: savedAt,
    last_saved_at: savedAt,
    submitted_at: input.submit ? savedAt : assignmentResult.data.submitted_at,
    settings: { ...settings, source: EVENT_HERO_VERSION },
  }).eq("id", assignmentId).eq("event_id", eventId);
  if (updateResult.error) return { ok: false, progress, message: "Your answers saved, but the completion status could not be updated." };

  if (input.submit) {
    await admin.from("os_activity_events").insert({
      event_id: eventId,
      actor_user_id: user.id,
      event_type: "planning.submitted",
      visibility: "staff",
      payload: { summary: "Event Hero submitted for EVENTSible review.", source: EVENT_HERO_VERSION },
    });
  }

  revalidatePath("/client");
  revalidatePath(`/client/event/${eventId}`);
  revalidatePath(`/admin/event/${eventId}`);
  return { ok: true, progress, savedAt, status, message: input.submit ? "Event Hero submitted to EVENTSible." : "Saved." };
}
