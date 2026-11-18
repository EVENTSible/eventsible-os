import { redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/types";
import { OpportunityForm } from "./opportunity-form";
import { createOpportunityAction } from "./actions";

export const metadata = { title: "New Opportunity | EVENTSible HQ" };

export default async function NewOpportunityPage() {
  const auth = await authorizeHqCapability("data.readiness.manage");
  if (!auth.ok) redirect(auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  const [contacts, leads, profiles] = await Promise.all([
    auth.supabase.from("os_contacts").select("id,display_name,primary_email,primary_phone").neq("status", "archived").limit(300),
    auth.supabase.from("os_leads").select("id,contact_id,status,source,inquiry_summary").in("status", ["new","qualifying","quoted","follow_up"]).limit(300),
    auth.supabase.from("os_profiles").select("id,display_name").eq("is_active", true).limit(100),
  ]);
  const candidates = profiles.data ?? [];
  const identities = process.env.SUPABASE_SERVICE_ROLE_KEY ? await Promise.all(candidates.map(row => createAdminSupabase().auth.admin.getUserById(row.id))) : [];
  const staff = candidates.filter((_, index) => isStaffRole(identities[index]?.data.user?.app_metadata?.role));
  if (contacts.error || leads.error || profiles.error) return <main className="admin-main"><p role="alert" className="alert error">Opportunity intake is unavailable. No records were changed.</p></main>;
  return <OpportunityForm action={createOpportunityAction} contacts={contacts.data ?? []} leads={leads.data ?? []} staff={staff} />;
}
