"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  buildManualExistingGigProposal,
  existingGigImportRpcError,
  EXISTING_GIG_CANDIDATE_VERSION,
} from "@/lib/existing-gig-intake.mjs";
import { executeGigSaladCandidateSync, GigSaladSyncError } from "@/lib/gigsalad-ical-sync.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export type ImportActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
  candidateId?: string;
  eventId?: string;
};

export type GigSaladSyncCounts = {
  discovered: number;
  new: number;
  refreshed: number;
  unchanged: number;
  preserved: number;
  skipped: number;
  warnings: number;
};

export type GigSaladSyncActionState = {
  status: "idle" | "success" | "error";
  message: string;
  counts?: GigSaladSyncCounts;
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

function gigSaladSyncErrorMessage(error: unknown) {
  const code = error instanceof GigSaladSyncError ? error.code : "unknown";
  const messages: Record<string, string> = {
    feed_not_configured: "GigSalad is not configured for this environment.",
    feed_configuration_invalid: "The server-side GigSalad feed configuration is invalid.",
    feed_fetch_timeout: "GigSalad did not respond within the bounded sync window. Nothing was imported.",
    feed_fetch_failed: "The GigSalad calendar could not be fetched. Nothing was imported.",
    feed_too_large: "The GigSalad calendar exceeds the 1 MiB safety limit. Nothing was imported.",
    feed_parse_failed: "The GigSalad calendar could not be parsed safely. Nothing was imported.",
    candidate_read_failed: "Existing import candidates could not be checked. No candidate was created.",
  };
  return messages[code] ?? "GigSalad sync could not be completed safely.";
}

export async function syncGigSaladCandidatesAction(
  _previousState: GigSaladSyncActionState,
  _formData: FormData,
): Promise<GigSaladSyncActionState> {
  void _previousState;
  void _formData;
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Sign in with an approved staff account." };

  try {
    const synced = await executeGigSaladCandidateSync({
      actorUserId: staff.user.id,
      feedUrl: process.env.GIGSALAD_ICAL_FEED_URL,
      loadExistingCandidates: async (references: string[]) => {
        const existing: Array<Record<string, unknown>> = [];
        for (let index = 0; index < references.length; index += 40) {
          const read = await staff.supabase
            .from("os_event_import_candidates")
            .select("id,source,external_reference,proposed_data,review_status")
            .eq("source", "gigsalad_ical")
            .in("external_reference", references.slice(index, index + 40));
          if (read.error) throw new Error("candidate_read_failed");
          existing.push(...(read.data ?? []));
        }
        return existing;
      },
      insertCandidate: async (candidate: Record<string, unknown>) => {
        const write = await staff.supabase
          .from("os_event_import_candidates")
          .insert(candidate)
          .select("id")
          .maybeSingle();
        if (write.error?.code === "23505") return "duplicate";
        if (write.error || !write.data) return "failed";
        return "created";
      },
    });

    if (synced.counts.new > 0) refreshIntake();
    if (synced.write_failures > 0) {
      return {
        status: "error",
        message: "GigSalad was read, but some candidate writes were skipped. No canonical gigs were created.",
        counts: synced.counts,
      };
    }
    return {
      status: "success",
      message: "GigSalad sync completed. Import Review candidates only; no canonical gigs were created.",
      counts: synced.counts,
    };
  } catch (error) {
    return { status: "error", message: gigSaladSyncErrorMessage(error) };
  }
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
