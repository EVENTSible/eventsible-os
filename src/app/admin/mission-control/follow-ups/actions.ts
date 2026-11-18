"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";

const board = "/admin/mission-control/follow-ups";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function finish(message: string, error = false): never {
  revalidatePath(board);
  revalidatePath("/admin");
  redirect(`${board}?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

async function operate(action: string, form: FormData, payload: Record<string, unknown> = {}) {
  const permission = action === "assign" ? "lead.lifecycle.manage" : "task.write";
  const auth = await authorizeHqCapability(permission);
  if (!auth.ok) finish("Sign in with an authorized HQ account.", true);
  const leadId = value(form, "lead_id");
  const operationId = value(form, "operation_id");
  if (!UUID.test(leadId) || !UUID.test(operationId)) finish("Reload this lead before saving.", true);
  // One authenticated database call: lead/task updates and staff-only activity commit together.
  const result = await auth.supabase.rpc("os_follow_up_operation", {
    p_action: action, p_lead_id: leadId, p_operation_id: operationId, p_payload: payload,
  });
  if (result.error) {
    if (result.error.code === "PGRST202") finish("Opportunity Desk database update is not installed. No changes were saved.", true);
    if (result.error.code === "23505") finish("This follow-up or task already belongs to someone. Refresh the board.", true);
    if (result.error.code === "42501") finish("Claim this lead or ask the Owner for access.", true);
    finish("The update could not be saved. No partial follow-up change was made.", true);
  }
  finish(action === "draft" ? "Private draft saved. No client was contacted." :
    action === "attempt" ? "Contact attempt recorded. HQ sent no message." : "Follow-up saved with its activity history.");
}

export async function claimFollowUpAction(form: FormData) { await operate("claim", form); }
export async function assignFollowUpAction(form: FormData) {
  const assignee = value(form, "assignee");
  if (!UUID.test(assignee)) finish("Choose a team member.", true);
  await operate("assign", form, { assignee });
}
export async function saveFollowUpAction(form: FormData) {
  const kind = value(form, "kind");
  if (!["note", "draft", "attempt"].includes(kind)) finish("Choose an update type.", true);
  const body = value(form, "body");
  if (!body || body.length > 4000) finish("Enter an update of 1 to 4,000 characters.", true);
  await operate(kind, form, { body });
}
export async function scheduleFollowUpAction(form: FormData) {
  const date = value(form, "due_at");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) finish("Enter a valid date.", true);
  await operate("schedule", form, { dueAt: `${date}T12:00:00Z` });
}
export async function createFollowUpTaskAction(form: FormData) {
  const priority = value(form, "priority");
  if (!["normal", "high", "urgent"].includes(priority)) finish("Choose a priority.", true);
  await operate("task_create", form, { priority });
}
export async function completeFollowUpTaskAction(form: FormData) { await operate("task_complete", form); }
