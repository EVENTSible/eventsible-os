"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  buildManualExistingGigProposal,
  existingGigImportRpcError,
  EXISTING_GIG_CANDIDATE_VERSION,
} from "@/lib/existing-gig-intake.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export type ImportActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
  candidateId?: string;
  eventId?: string;
};

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function requireStaff() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return user && isStaffRole(user.app_metadata?.role) ? { supabase, user } : null;
}

function refreshIntake(eventId?: string) {
  revalidatePath("/admin/imports");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  if (eventId) revalidatePath(`/admin/gigs/${eventId}`);
}

export async function createManualImportCandidateAction(
  _previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Sign in with an approved staff account." };

  const eventQuery = await staff.supabase
    .from("os_event_dashboard_v")
    .select("event_id,title,event_status,starts_at,timezone,venue_name,primary_contact_id,primary_email")
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (eventQuery.error) return { status: "error", message: "Existing events could not be checked. No candidate was created." };

  const built = buildManualExistingGigProposal({
    event_title: value(formData, "event_title"),
    event_type: value(formData, "event_type"),
    event_date: value(formData, "event_date"),
    start_time: value(formData, "start_time"),
    end_time: value(formData, "end_time"),
    timezone: value(formData, "timezone"),
    venue_name: value(formData, "venue_name"),
    venue_address_1: value(formData, "venue_address_1"),
    venue_address_2: value(formData, "venue_address_2"),
    venue_city: value(formData, "venue_city"),
    venue_state: value(formData, "venue_state"),
    venue_postal_code: value(formData, "venue_postal_code"),
    contact_mode: value(formData, "contact_mode"),
    contact_id: value(formData, "contact_id"),
    contact_display_name: value(formData, "contact_display_name"),
    contact_email: value(formData, "contact_email"),
    contact_phone: value(formData, "contact_phone"),
    service_ids: formData.getAll("service_ids").map(String),
    booked_amount: value(formData, "booked_amount"),
    notes: value(formData, "notes"),
  }, eventQuery.data ?? []);

  if (!built.proposal) return { status: "error", message: "Check the reviewed candidate fields. Nothing was saved.", errors: built.errors as Record<string, string> };

  const write = await staff.supabase
    .from("os_event_import_candidates")
    .insert({
      contract_version: EXISTING_GIG_CANDIDATE_VERSION,
      source: "manual",
      external_reference: `manual:${randomUUID()}`,
      proposed_data: built.proposal,
      review_status: "pending",
      created_by_user_id: staff.user.id,
    })
    .select("id")
    .single();

  if (write.error || !write.data) return { status: "error", message: "The manual candidate could not be saved. No gig was created." };
  refreshIntake();
  return { status: "success", message: "Manual candidate added to Import Review. No gig has been created yet.", candidateId: write.data.id };
}

export async function reviewImportCandidateAction(
  _previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const candidateId = value(formData, "candidate_id");
  const decision = value(formData, "decision");
  const matchedEventId = value(formData, "matched_event_id");
  if (!candidateId || !["pending", "review_later", "ignored", "matched"].includes(decision)) {
    return { status: "error", message: "The review decision was not valid." };
  }
  if (decision === "matched" && !matchedEventId) return { status: "error", message: "Choose an existing event to match." };

  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Sign in with an approved staff account." };

  if (decision === "matched") {
    const target = await staff.supabase.from("os_events").select("id").eq("id", matchedEventId).maybeSingle();
    if (target.error || !target.data) return { status: "error", message: "The selected canonical event could not be verified." };
  }

  const update = await staff.supabase
    .from("os_event_import_candidates")
    .update({
      review_status: decision,
      reviewed_by_user_id: decision === "pending" ? null : staff.user.id,
      reviewed_at: decision === "pending" ? null : new Date().toISOString(),
      matched_event_id: decision === "matched" ? matchedEventId : null,
    })
    .eq("id", candidateId)
    .neq("review_status", "imported")
    .select("id,review_status,matched_event_id")
    .maybeSingle();

  if (update.error || !update.data) return { status: "error", message: "The candidate review state could not be changed." };
  refreshIntake(update.data.matched_event_id ?? undefined);
  const labels: Record<string, string> = { pending: "Pending review", review_later: "Review later", ignored: "Ignored", matched: "Matched to an existing gig" };
  return { status: "success", message: `${labels[decision]} saved. No new gig was created.` };
}

export async function importExistingGigAction(
  _previousState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const candidateId = value(formData, "candidate_id");
  if (!candidateId) return { status: "error", message: "The import candidate was missing." };
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Sign in with an approved staff account." };

  const result = await staff.supabase.rpc("os_import_existing_gig", { p_candidate_id: candidateId });
  if (result.error) return { status: "error", message: existingGigImportRpcError(result.error) };
  if (!result.data || !["imported", "replayed"].includes(String(result.data.status ?? "")) || !result.data.event_id) {
    return { status: "error", message: "The canonical import result could not be verified. No success state is shown." };
  }

  const eventId = String(result.data.event_id);
  refreshIntake(eventId);
  return {
    status: "success",
    message: result.data.status === "replayed" ? "This candidate was already imported; the existing canonical gig was reused." : "Existing gig imported atomically.",
    candidateId,
    eventId,
  };
}
