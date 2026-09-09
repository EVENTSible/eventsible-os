import { redirect } from "next/navigation";
import { DataReadinessWorkspace } from "@/components/data-readiness-workspace";
import { compensateBatchAction, applyBatchAction, approveBatchAction, manageContactAction, manageEventAction, manageLeadAction, stageManifestAction } from "./actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasHqCapability } from "@/lib/hq-authorization";
import { isStaffRole } from "@/lib/types";

export const metadata={title:"Data Readiness | EVENTSible HQ"};

export default async function DataReadinessPage(){
  const supabase=await createServerSupabase(); const {data}=await supabase.auth.getUser(); const user=data.user;
  if(!user)redirect("/login"); const role=user.app_metadata?.role; if(!isStaffRole(role))redirect("/access-denied");
  if(!hasHqCapability(role,"data.readiness.manage"))redirect("/access-denied");
  const [contacts,events,leads,services,snapshot,activity]=await Promise.all([
    supabase.from("os_contacts").select("id,display_name,first_name,last_name,organization_name,primary_email,primary_phone,preferred_channel,status,notes,source,updated_at").order("updated_at",{ascending:false}).limit(200),
    supabase.from("os_events").select("id,primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_address_2,venue_city,venue_state,venue_postal_code,guest_count,source,updated_at").order("updated_at",{ascending:false}).limit(200),
    supabase.from("os_leads").select("id,contact_id,event_id,status,source,next_follow_up_at,updated_at").order("updated_at",{ascending:false}).limit(200),
    supabase.from("os_service_catalog").select("id,code,name,status").eq("status","active").order("name"),
    supabase.rpc("os_data_readiness_snapshot"),
    supabase.from("os_activity_events").select("id,event_id,contact_id,event_type,occurred_at").like("event_type","data_readiness.%").order("occurred_at",{ascending:false}).limit(100),
  ]);
  const warning=[contacts,events,leads,services,snapshot,activity].find((result)=>result.error)?.error?.message ?? null;
  if(warning)return <main className="admin-main data-readiness-main"><header className="admin-header compact"><div><span className="eyebrow">Owner tools</span><h1>Data Readiness</h1></div></header><div className="alert warning" role="alert"><b>Data Readiness is unavailable.</b><p>The complete protected data view could not be loaded, so every write control is disabled. Try again after the migration and authorization checks are healthy.</p></div></main>;
  const snapshotData=(snapshot.data && typeof snapshot.data==="object" ? snapshot.data : {}) as {batches?:Record<string,unknown>[];items?:Record<string,unknown>[]};
  return <DataReadinessWorkspace contacts={contacts.data??[]} events={events.data??[]} leads={leads.data??[]} services={services.data??[]} batches={snapshotData.batches??[]} items={snapshotData.items??[]} activity={activity.data??[]} warning={null}
    manageContactAction={manageContactAction} manageEventAction={manageEventAction} manageLeadAction={manageLeadAction} stageManifestAction={stageManifestAction} approveBatchAction={approveBatchAction} applyBatchAction={applyBatchAction} compensateBatchAction={compensateBatchAction}/>;
}
