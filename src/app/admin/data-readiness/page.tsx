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
  const snapshot=await supabase.rpc("os_data_readiness_snapshot");
  if(snapshot.error)return <main className="admin-main data-readiness-main"><header className="admin-header compact"><div><span className="eyebrow">Owner tools</span><h1>Data Readiness</h1></div></header><div className="alert warning" role="alert"><b>Data Readiness is unavailable.</b><p>The complete protected data view could not be loaded, so every write control is disabled. Try again after the migration and authorization checks are healthy.</p></div></main>;
  const snapshotData=(snapshot.data && typeof snapshot.data==="object" ? snapshot.data : {}) as {contacts?:Record<string,unknown>[];events?:Record<string,unknown>[];leads?:Record<string,unknown>[];services?:Record<string,unknown>[];batches?:Record<string,unknown>[];items?:Record<string,unknown>[];activity?:Record<string,unknown>[]};
  return <DataReadinessWorkspace contacts={snapshotData.contacts??[]} events={snapshotData.events??[]} leads={snapshotData.leads??[]} services={snapshotData.services??[]} batches={snapshotData.batches??[]} items={snapshotData.items??[]} activity={snapshotData.activity??[]} warning={null}
    manageContactAction={manageContactAction} manageEventAction={manageEventAction} manageLeadAction={manageLeadAction} stageManifestAction={stageManifestAction} approveBatchAction={approveBatchAction} applyBatchAction={applyBatchAction} compensateBatchAction={compensateBatchAction}/>;
}
