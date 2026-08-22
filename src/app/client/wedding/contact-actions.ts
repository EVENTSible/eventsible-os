"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import { validateWeddingHeroContactRequest } from "@/lib/wedding-hero-contact.mjs";
import {
  sendWeddingHeroOwnerNotification,
  WEDDING_HERO_CALLBACK_NOTIFICATION,
} from "@/lib/notifications/wedding-hero-email.mjs";
import { weddingProgress } from "@/lib/wedding-companion.mjs";

export type WeddingHeroContactInput = {
  name: string;
  email?: string;
  phone?: string;
  preferredChannel: "email" | "text" | "call";
  bestTime?: string;
  notes?: string;
  company?: string;
  coupleNames?: string;
  eventDate?: string;
  progress?: number;
  mode: "homepage" | "guided" | "form" | "print";
  source: "weddinghero_homepage" | "public_planner" | "private_plan";
  eventId?: string;
  assignmentId?: string;
};

export type WeddingHeroContactResult = {
  ok: boolean;
  message: string;
  errors?: {
    name?: string;
    email?: string;
    phone?: string;
    contact?: string;
    plan?: string;
  };
  requestId?: string;
  createdAt?: string;
  storage?: "private_plan" | "device_draft";
};

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export async function requestWeddingHeroCallbackAction(input: WeddingHeroContactInput): Promise<WeddingHeroContactResult> {
  const validation = validateWeddingHeroContactRequest(input);
  if (!validation.ok) {
    return validation.blocked
      ? { ok: true, message: "Thanks. Your request has been received." }
      : { ok: false, message: validation.message, errors: validation.errors };
  }

  if (!validation.data) return { ok: false, message: "This callback request could not be validated." };

  const requestId = randomUUID();
  const createdAt = new Date().toISOString();
  const request = validation.data;
  let context = {
    coupleNames: request.coupleNames,
    eventDate: request.eventDate,
    progress: request.progress,
    mode: request.mode,
    source: request.source,
    eventId: request.eventId,
    assignmentId: request.assignmentId,
  };
  let storage: WeddingHeroContactResult["storage"] = "device_draft";

  if (request.eventId && request.assignmentId) {
    const supabase = await createServerSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return { ok: false, message: "Your session expired. Sign in again before requesting a callback." };

    const assignmentResult = await supabase
      .from("os_planning_assignments")
      .select("id,event_id,settings,progress_percent")
      .eq("id", request.assignmentId)
      .eq("event_id", request.eventId)
      .maybeSingle();
    if (assignmentResult.error || !assignmentResult.data) {
      return { ok: false, message: "This private Wedding Hero plan could not be verified." };
    }

    if (!isStaffRole(user.app_metadata?.role)) {
      const memberResult = await supabase
        .from("os_event_members")
        .select("id")
        .eq("event_id", request.eventId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (memberResult.error || !memberResult.data) {
        return { ok: false, message: "This private Wedding Hero plan could not be verified." };
      }
    }

    const answersResult = await supabase
      .from("os_planning_answers")
      .select("question_key,value")
      .eq("assignment_id", request.assignmentId);
    const answers = Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.value]));
    const admin = createAdminSupabase();
    const eventResult = await admin
      .from("os_events")
      .select("id,title,starts_at,primary_contact_id")
      .eq("id", request.eventId)
      .maybeSingle();
    let primaryContact: { display_name?: string | null; primary_email?: string | null; primary_phone?: string | null } | null = null;
    const contactId = eventResult.data?.primary_contact_id;
    if (contactId) {
      const contactResult = await admin
        .from("os_contacts")
        .select("display_name,primary_email,primary_phone")
        .eq("id", contactId)
        .maybeSingle();
      primaryContact = contactResult.data;
    }

    const partnerNames = [answerText(answers.partner_one_name), answerText(answers.partner_two_name)].filter(Boolean).join(" & ");
    context = {
      ...context,
      coupleNames: partnerNames || answerText(eventResult.data?.title) || context.coupleNames,
      eventDate: answerText(answers.event_date) || answerText(eventResult.data?.starts_at) || context.eventDate,
      progress: answersResult.error ? assignmentResult.data.progress_percent ?? context.progress : weddingProgress(answers),
    };
    const previousSettings = assignmentResult.data.settings && typeof assignmentResult.data.settings === "object"
      ? assignmentResult.data.settings
      : {};
    const previousRequests = Array.isArray((previousSettings as Record<string, unknown>).wedding_hero_contact_requests)
      ? (previousSettings as Record<string, unknown>).wedding_hero_contact_requests as unknown[]
      : [];
    const storedRequest = {
      request_id: requestId,
      created_at: createdAt,
      status: "requested",
      name: request.name,
      email: request.email,
      phone: request.phone,
      preferred_channel: request.preferredChannel,
      best_time: request.bestTime,
      notes: request.notes,
      mode: request.mode,
      source: request.source,
    };
    const updateResult = await admin.from("os_planning_assignments").update({
      settings: {
        ...previousSettings,
        wedding_hero_contact_requests: [...previousRequests, storedRequest].slice(-10),
      },
    }).eq("id", request.assignmentId).eq("event_id", request.eventId);
    if (updateResult.error) {
      return { ok: false, message: "Your callback request could not be saved. Please call or text EVENTSible instead." };
    }

    await admin.from("os_activity_events").insert({
      event_id: request.eventId,
      actor_user_id: user.id,
      event_type: "wedding.contact_requested",
      visibility: "staff",
      payload: {
        summary: "Wedding Hero callback requested.",
        request_id: requestId,
        preferred_channel: request.preferredChannel,
        mode: request.mode,
        source: request.source,
      },
    });
    storage = "private_plan";

    if (!request.email && primaryContact?.primary_email) request.email = primaryContact.primary_email;
    if (!request.phone && primaryContact?.primary_phone) request.phone = primaryContact.primary_phone;
  }

  try {
    await sendWeddingHeroOwnerNotification({
      kind: WEDDING_HERO_CALLBACK_NOTIFICATION,
      context,
      request,
      requestId,
      createdAt,
    });
  } catch {
    return {
      ok: true,
      message: "Your request was saved, but the notification could not be sent. Please call or text EVENTSible for immediate help.",
      requestId,
      createdAt,
      storage,
    };
  }

  if (request.eventId) {
    revalidatePath(`/client/wedding/${request.eventId}`);
    revalidatePath(`/admin/wedding/${request.eventId}`);
  }

  return {
    ok: true,
    message: `Thanks, ${request.name}. EVENTSible will follow up by ${request.preferredChannel}.`,
    requestId,
    createdAt,
    storage,
  };
}
