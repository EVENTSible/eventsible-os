import { redirect } from "next/navigation";
import { RecordsIntakeWorkspace } from "@/components/records-intake-workspace";
import { archiveCleanupCustomersAction, compensateBatchAction, applyBatchAction, approveBatchAction, manageContactAction, manageEventAction, manageLeadAction, previewCleanupAction, quarantineCleanupOutboxAction, restoreCleanupCustomersAction, restoreCleanupOutboxAction, stageManifestAction } from "./actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasHqCapability } from "@/lib/hq-authorization";
import { isStaffRole } from "@/lib/types";

export const metadata={title:"Records & Intake | EVENTSible HQ"};

export default async function DataReadinessPage(){
  const supabase=await createServerSupabase(); const {data}=await supabase.auth.getUser(); const user=data.user;
  if(!user)redirect("/login"); const role=user.app_metadata?.role; if(!isStaffRole(role))redirect("/access-denied");
  if(!hasHqCapability(role,"data.readiness.manage"))redirect("/access-denied");
  const [snapshot,cleanup]=await Promise.all([supabase.rpc("os_data_readiness_snapshot"),supabase.rpc("os_cleanup_snapshot")]);
  if(snapshot.error)return <main className="admin-main data-readiness-main"><header className="admin-header compact"><div><span className="eyebrow">Owner tools</span><h1>Records &amp; Intake</h1></div></header><div className="alert warning" role="alert"><b>Records &amp; Intake is unavailable.</b><p>The complete protected data view could not be loaded, so every write control is disabled. Try again after the migration and authorization checks are healthy.</p></div></main>;
  const snapshotData=(snapshot.data && typeof snapshot.data==="object" ? snapshot.data : {}) as {contacts?:Record<string,unknown>[];events?:Record<string,unknown>[];leads?:Record<string,unknown>[];services?:Record<string,unknown>[];batches?:Record<string,unknown>[];items?:Record<string,unknown>[];activity?:Record<string,unknown>[]};
  const cleanupData=(cleanup.data&&typeof cleanup.data==="object"?cleanup.data:{}) as {batches?:Record<string,unknown>[];items?:Record<string,unknown>[]};
  return <RecordsIntakeWorkspace contacts={snapshotData.contacts??[]} events={snapshotData.events??[]} leads={snapshotData.leads??[]} services={snapshotData.services??[]} batches={snapshotData.batches??[]} items={snapshotData.items??[]} activity={snapshotData.activity??[]} cleanupBatches={cleanupData.batches??[]} cleanupItems={cleanupData.items??[]} cleanupEnabled={!cleanup.error} warning={cleanup.error?"Cleanup history could not be loaded. Cleanup controls are disabled.":null}
    manageContactAction={manageContactAction} manageEventAction={manageEventAction} manageLeadAction={manageLeadAction} stageManifestAction={stageManifestAction} approveBatchAction={approveBatchAction} applyBatchAction={applyBatchAction} compensateBatchAction={compensateBatchAction} previewCleanupAction={previewCleanupAction} archiveCleanupCustomersAction={archiveCleanupCustomersAction} restoreCleanupCustomersAction={restoreCleanupCustomersAction} quarantineCleanupOutboxAction={quarantineCleanupOutboxAction} restoreCleanupOutboxAction={restoreCleanupOutboxAction}/>;
}
