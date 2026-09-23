import { redirect } from "next/navigation";
import { QuickAddWorkspace } from "@/components/quick-add-workspace";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { quickAddAction } from "./actions";

export const metadata = { title: "Quick Add | EVENTSible HQ" };

type Row = Record<string, unknown>;

export default async function QuickAddPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await authorizeHqCapability("data.readiness.manage");
  if (!auth.ok) redirect(auth.reason === "unauthenticated" ? "/login" : "/access-denied");

  const params = searchParams ? await searchParams : {};
  const initialValue = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = ["contact", "lead", "event", "booking", "note"].includes(String(initialValue)) ? String(initialValue) : "contact";

  const [contactsResult, eventsResult, leadsResult, bookingsResult, servicesResult] = await Promise.all([
    auth.supabase.from("os_contacts").select("id,display_name,organization_name,status").neq("status", "archived").order("display_name"),
    auth.supabase.from("os_events").select("id,title,status,historical_date,starts_at,primary_contact_id").neq("status", "archived").order("starts_at", { ascending: false, nullsFirst: false }).limit(300),
    auth.supabase.from("os_leads").select("id,contact_id,event_id,status,inquiry_summary").neq("status", "archived").order("created_at", { ascending: false }).limit(300),
    auth.supabase.from("os_bookings").select("id,event_id,status").neq("status", "cancelled").order("created_at", { ascending: false }).limit(300),
    auth.supabase.from("os_service_catalog").select("id,code,name,category").eq("is_active", true).order("sort_order").order("name"),
  ]);
  const loadError = [contactsResult, eventsResult, leadsResult, bookingsResult, servicesResult].some((result) => result.error);
  if (loadError) {
    return <div className="admin-main quick-add-main"><div className="alert warning" role="alert"><b>Quick Add is unavailable.</b><p>The canonical record choices could not be loaded, so all write controls remain disabled.</p></div></div>;
  }

  return <QuickAddWorkspace
    action={quickAddAction}
    bookings={(bookingsResult.data ?? []) as Row[]}
    contacts={(contactsResult.data ?? []) as Row[]}
    events={(eventsResult.data ?? []) as Row[]}
    initialType={initialType}
    leads={(leadsResult.data ?? []) as Row[]}
    services={(servicesResult.data ?? []) as Row[]}
  />;
}
