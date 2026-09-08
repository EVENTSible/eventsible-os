export type { StaffRole } from "@/lib/hq-authorization";
export { isStaffRole } from "@/lib/hq-authorization";

export type EventDashboardRow = {
  event_id: string | null;
  lead_id?: string | null;
  booking_id?: string | null;
  assignment_id?: string | null;
  primary_contact_id?: string | null;
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
  planning_status?: string | null;
  current_section_key?: string | null;
  planning_template_name: string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
  booked_services: unknown;
};
