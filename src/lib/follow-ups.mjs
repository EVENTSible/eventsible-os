import { isActiveLeadStatus } from "./mission-control.mjs";

export const FOLLOW_UP_KEY_PREFIX = "hq-follow-up:";
export const followUpKey = (leadId) => `${FOLLOW_UP_KEY_PREFIX}${leadId}`;

export function followUpState(lead, task, quote) {
  if (lead.status === "won") return "Booked";
  if (["lost", "archived"].includes(lead.status)) return "Closed";
  if (!isActiveLeadStatus(lead.status)) return "Needs Review";
  if (task?.status === "waiting") return "Waiting on Client";
  if (task?.priority === "urgent") return "Needs Owner Decision";
  if (lead.assigned_to || task?.assigned_to) return "Assigned";
  if (quote?.status === "draft") return "Needs Owner Decision";
  return lead.status === "new" ? "Needs Review" : "Ready for Follow-Up";
}

export function followUpDue(lead, task, now = Date.now()) {
  const due = lead.next_follow_up_at ?? task?.due_at;
  const timestamp = due ? Date.parse(due) : NaN;
  return isActiveLeadStatus(lead.status) && Number.isFinite(timestamp) && timestamp < now && task?.status !== "completed" && task?.status !== "cancelled";
}

export function safeGigSaladUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!/(^|\.)gigsalad\.com$/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
