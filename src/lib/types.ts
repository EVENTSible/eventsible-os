export type StaffRole = "owner" | "manager" | "staff" | "host";

export type EventDashboardRow = {
  event_id: string | null;
  title: string | null;
  event_type: string | null;
  event_status: string | null;
  starts_at: string | null;
  venue_name: string | null;
  primary_contact_name: string | null;
  primary_email: string | null;
  lead_status: string | null;
  latest_quote_status: string | null;
  booking_status: string | null;
  contract_status: string | null;
  payment_status: string | null;
  progress_percent: number | null;
  planning_template_name: string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
  booked_services: unknown;
};

export function isStaffRole(value: unknown): value is StaffRole {
  return ["owner", "manager", "staff", "host"].includes(String(value));
}
