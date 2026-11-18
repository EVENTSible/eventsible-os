"use server";

import { revalidatePath } from "next/cache";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { buildWeddingOperations } from "@/lib/wedding-operations.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ZONES = new Set(["", "America/Detroit", "America/Chicago", "America/Indiana/Indianapolis"]);
const DECISIONS = new Set(["pending", "accommodate", "clarify", "propose_change"]);

/** Internal review only. This never edits booking coverage or publishes a run sheet. */
export async function recordWeddingScheduleReviewAction(form: FormData) {
  const auth = await authorizeHqCapability("system.manage");
  if (!auth.ok || auth.role !== "owner") throw new Error("Owner access required.");
  const eventId = String(form.get("eventId") ?? "");
  const assignmentId = String(form.get("assignmentId") ?? "");
  const sourceDigest = String(form.get("sourceDigest") ?? "");
  const planningZone = String(form.get("planningZone") ?? "");
  const decision = String(form.get("decision") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!UUID.test(eventId) || !UUID.test(assignmentId) || !/^[a-f0-9]{64}$/.test(sourceDigest) || !ZONES.has(planningZone) || !DECISIONS.has(decision) || note.length > 1000) throw new Error("Invalid review input.");

  const { supabase, user } = auth;
  const [eventResult, bookingResult, assignmentResult, answersResult] = await Promise.all([
    supabase.from("os_events").select("id,status,starts_at,ends_at").eq("id", eventId).maybeSingle(),
    supabase.from("os_bookings").select("id,status,contract_status").eq("event_id", eventId).eq("status", "confirmed").eq("contract_status", "signed").limit(1).maybeSingle(),
    supabase.from("os_planning_assignments").select("id,event_id,status,submitted_at,settings").eq("id", assignmentId).maybeSingle(),
    supabase.from("os_planning_answers").select("question_key,value").eq("assignment_id", assignmentId),
  ]);
  if (eventResult.error || bookingResult.error || assignmentResult.error || answersResult.error || !eventResult.data || !bookingResult.data || !assignmentResult.data) throw new Error("Review records unavailable.");
  const assignment = assignmentResult.data;
  const linked = assignment.event_id === eventId;
  if (!linked) {
    const source = await supabase.from("os_events").select("id,status,source").eq("id", assignment.event_id).maybeSingle();
    if (source.error || source.data?.status !== "inquiry" || source.data?.source !== "wedding_hero_public_submission" || assignment.status !== "submitted") throw new Error("Planning candidate is no longer eligible for review.");
  }
  const packet = buildWeddingOperations({ event: { id: assignment.event_id }, assignment, answers: Object.fromEntries((answersResult.data ?? []).map(row => [row.question_key, row.value])) });
  if (packet.sourceDigest !== sourceDigest) throw new Error("Planning changed. Reload before recording a decision.");
  const value = { assignmentId, sourceDigest, planningZone: planningZone || null, decision, note, state: "PENDING CLIENT CONFIRMATION", reviewedBy: user.id, reviewedAt: new Date().toISOString(), bookedStartsAt: eventResult.data.starts_at, bookedEndsAt: eventResult.data.ends_at };
  const write = await supabase.from("os_event_facts").upsert({ event_id: eventId, fact_key: "event.schedule_review", value, source: "owner", source_reference: assignmentId, is_confirmed: false, updated_by: user.id }, { onConflict: "event_id,fact_key" });
  if (write.error) throw new Error("Schedule review could not be saved.");
  revalidatePath(`/admin/gigs/${eventId}`);
}
