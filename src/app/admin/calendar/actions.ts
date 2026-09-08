"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { localDateTimeToIso } from "@/lib/team-availability.mjs";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function calendarRedirect(message: string, type: "notice" | "error" = "notice"): never {
  redirect(`/admin/calendar?${type}=${encodeURIComponent(message)}`);
}

async function authorized(capability: "schedule.self.manage" | "schedule.team.manage" | "schedule.assignments.manage") {
  const result = await authorizeHqCapability(capability);
  if (!result.ok) calendarRedirect(result.reason === "unauthenticated" ? "Sign in with an approved staff account." : "You do not have permission for that schedule action.", "error");
  return result;
}

function rpcMessage(code: string, fallback: string) {
  if (["28000", "42501"].includes(code)) return "Your staff session is not authorized for that schedule action.";
  if (["22023", "23505"].includes(code)) return "Check the schedule details. Nothing was changed.";
  if (code === "P0002") return "That schedule record is no longer available.";
  return fallback;
}

export async function upsertAvailabilityAction(formData: FormData) {
  const auth = await authorized("schedule.self.manage");
  let teamMemberId = value(formData, "team_member_id");
  const timezone = value(formData, "timezone") || "America/Indiana/Indianapolis";

  if (!teamMemberId) {
    const preferredName = String(auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.display_name ?? auth.user.email?.split("@")[0] ?? "Team member").trim();
    const memberResult = await auth.supabase.rpc("os_ensure_my_team_member", { p_display_name: preferredName, p_timezone: timezone });
    teamMemberId = String(memberResult.data?.team_member_id ?? "");
    if (memberResult.error || !teamMemberId) calendarRedirect("Your team schedule could not be initialized.", "error");
  }

  const allDay = value(formData, "all_day") === "true";
  const startsAt = allDay ? null : localDateTimeToIso(value(formData, "starts_at"), timezone);
  const endsAt = allDay ? null : localDateTimeToIso(value(formData, "ends_at"), timezone);
  if (!allDay && (!startsAt || !endsAt)) calendarRedirect("Enter a valid start and end time.", "error");

  const result = await auth.supabase.rpc("os_upsert_team_availability", {
    p_entry_id: value(formData, "entry_id") || null,
    p_team_member_id: teamMemberId,
    p_payload: {
      entryType: value(formData, "entry_type"),
      allDay,
      startsAt,
      endsAt,
      startsOn: allDay ? value(formData, "starts_on") : null,
      endsOn: allDay ? value(formData, "ends_on") : null,
      timezone,
      title: value(formData, "title") || null,
      privateNotes: value(formData, "private_notes") || null,
      privacy: value(formData, "privacy"),
    },
  });
  if (result.error) calendarRedirect(rpcMessage(String(result.error.code ?? ""), "Availability could not be saved."), "error");
  revalidatePath("/admin/calendar");
  calendarRedirect(result.data?.status === "updated" ? "Availability updated." : "Availability added.");
}

export async function removeAvailabilityAction(formData: FormData) {
  const auth = await authorized("schedule.self.manage");
  const result = await auth.supabase.rpc("os_remove_team_availability", { p_entry_id: value(formData, "entry_id") });
  if (result.error) calendarRedirect(rpcMessage(String(result.error.code ?? ""), "Availability could not be removed."), "error");
  revalidatePath("/admin/calendar");
  calendarRedirect("Availability removed.");
}

export async function manageAssignmentAction(formData: FormData) {
  const auth = await authorized("schedule.assignments.manage");
  const callTimeInput = value(formData, "call_time");
  const timezone = value(formData, "timezone") || "America/Indiana/Indianapolis";
  const callTime = callTimeInput ? localDateTimeToIso(callTimeInput, timezone) : null;
  if (callTimeInput && !callTime) calendarRedirect("Enter a valid call time.", "error");
  const result = await auth.supabase.rpc("os_manage_staff_assignment", {
    p_action: value(formData, "action") || "upsert",
    p_assignment_id: value(formData, "assignment_id") || null,
    p_event_id: value(formData, "event_id") || null,
    p_team_member_id: value(formData, "team_member_id") || null,
    p_assignment_role: value(formData, "assignment_role") || null,
    p_call_time: callTime,
  });
  if (result.error) calendarRedirect(rpcMessage(String(result.error.code ?? ""), "The assignment could not be changed."), "error");
  revalidatePath("/admin/calendar");
  calendarRedirect(result.data?.status === "removed" ? "Assignment removed." : "Assignment saved.");
}

export async function manageTeamMemberAction(formData: FormData) {
  const auth = await authorized("schedule.team.manage");
  const result = await auth.supabase.rpc("os_manage_team_member", {
    p_team_member_id: value(formData, "team_member_id"),
    p_display_name: value(formData, "display_name"),
    p_timezone: value(formData, "timezone"),
    p_status: value(formData, "status"),
  });
  if (result.error) calendarRedirect(rpcMessage(String(result.error.code ?? ""), "The team member could not be updated."), "error");
  revalidatePath("/admin/calendar");
  calendarRedirect("Team member updated.");
}
