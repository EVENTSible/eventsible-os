"use server";

import { revalidatePath } from "next/cache";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { validateIntakeManifest } from "@/lib/data-readiness.mjs";
import { localDateTimeToIso } from "@/lib/team-availability.mjs";

export type DataReadinessActionState = { status: "idle" | "success" | "error"; message: string; errors?: string[]; result?: Record<string, unknown> };
const fail = (message: string, errors?: string[]): DataReadinessActionState => ({ status: "error", message, errors });
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const actionValue = (form: FormData) => String(form.getAll("action").at(-1) ?? "").trim();

async function owner() {
  const auth = await authorizeHqCapability("data.readiness.manage");
  return auth.ok ? auth : null;
}

function refresh() {
  revalidatePath("/admin/data-readiness");
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}

function rpcFailure(error: { code?: string } | null, fallback: string) {
  if (error?.code === "42501") return "Owner authorization is required.";
  if (error?.code === "P0002") return "That record or approved batch is no longer available.";
  if (["22023", "22P02", "23503", "23505", "23514"].includes(String(error?.code ?? ""))) return "Review the bounded fields and duplicate warnings. Nothing was changed.";
  return fallback;
}

export async function manageContactAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth = await owner(); if (!auth) return fail("Owner authorization is required.");
  const result = await auth.supabase.rpc("os_manage_contact", { p_action: actionValue(form), p_contact_id: value(form,"contact_id") || null, p_payload: {
    displayName:value(form,"display_name"), firstName:value(form,"first_name"), lastName:value(form,"last_name"), organizationName:value(form,"organization_name"),
    primaryEmail:value(form,"primary_email"), primaryPhone:value(form,"primary_phone"), preferredChannel:value(form,"preferred_channel"), notes:value(form,"notes"),
  }});
  if (result.error) return fail(rpcFailure(result.error,"Contact could not be changed."));
  const warningCount = Array.isArray(result.data?.duplicateWarnings) ? result.data.duplicateWarnings.length : 0;
  refresh(); return { status:"success", message:`Contact ${String(result.data?.status ?? "change")} recorded with provenance.${warningCount ? ` Review ${warningCount} duplicate warning${warningCount === 1 ? "" : "s"}.` : ""}`, result:result.data };
}

export async function manageEventAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth = await owner(); if (!auth) return fail("Owner authorization is required.");
  const timezone=value(form,"timezone") || "America/Indiana/Indianapolis";
  const start=value(form,"starts_at"), end=value(form,"ends_at");
  const payload: Record<string, unknown> = {
    title:value(form,"title"),eventType:value(form,"event_type"),status:value(form,"status"),startsAt:start?localDateTimeToIso(start,timezone):null,endsAt:end?localDateTimeToIso(end,timezone):null,timezone,
    venueName:value(form,"venue_name"),venueAddress1:value(form,"venue_address_1"),venueAddress2:value(form,"venue_address_2"),venueCity:value(form,"venue_city"),venueState:value(form,"venue_state"),venuePostalCode:value(form,"venue_postal_code"),guestCount:value(form,"guest_count"),
  };
  if (value(form, "replace_services") === "true") payload.serviceIds = form.getAll("service_ids").map(String);
  const result=await auth.supabase.rpc("os_manage_event",{p_action:actionValue(form),p_event_id:value(form,"event_id")||null,p_payload:payload});
  if(result.error)return fail(rpcFailure(result.error,"Event could not be changed.")); refresh(); return {status:"success",message:`Event ${String(result.data?.status??"change")} recorded with provenance.`,result:result.data};
}

export async function manageLeadAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const follow=value(form,"next_follow_up_at");
  const result=await auth.supabase.rpc("os_manage_lead",{p_action:actionValue(form),p_lead_id:value(form,"lead_id")||null,p_payload:{status:value(form,"status"),nextFollowUpAt:follow?new Date(`${follow}T12:00:00Z`).toISOString():null}});
  if(result.error)return fail(rpcFailure(result.error,"Lead could not be changed.")); refresh(); return {status:"success",message:`Lead ${String(result.data?.status??"change")} recorded with provenance.`,result:result.data};
}

export async function stageManifestAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const raw=value(form,"manifest"); if(new TextEncoder().encode(raw).length>524288)return fail("Manifest exceeds the 512 KiB review limit.");
  let parsed:unknown; try{parsed=JSON.parse(raw);}catch{return fail("Manifest is not valid JSON.");}
  const checked=validateIntakeManifest(parsed); if(!checked.ok)return fail("Manifest validation failed. Nothing was staged.",checked.errors);
  const result=await auth.supabase.rpc("os_stage_intake_manifest",{p_manifest:checked.manifest});
  if(result.error)return fail(rpcFailure(result.error,"Manifest could not be staged.")); refresh(); return {status:"success",message:`Dry run staged. Confirm hash ${String(result.data?.manifestHash??"").slice(0,12)}… before approval.`,result:result.data};
}

export async function approveBatchAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const result=await auth.supabase.rpc("os_approve_intake_batch",{p_batch_id:value(form,"batch_id"),p_manifest_hash:value(form,"manifest_hash"),p_item_keys:form.getAll("item_keys").map(String)});
  if(result.error)return fail(rpcFailure(result.error,"Exact batch approval failed.")); refresh(); return {status:"success",message:"Exact manifest hash and selected item set approved. No canonical data has been applied yet.",result:result.data};
}

export async function applyBatchAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const result=await auth.supabase.rpc("os_apply_intake_batch",{p_batch_id:value(form,"batch_id"),p_manifest_hash:value(form,"manifest_hash")});
  if(result.error)return fail(rpcFailure(result.error,"Approved batch could not be applied.")); refresh(); return {status:result.data?.failed?"error":"success",message:result.data?.failed?"Batch completed partially. Failed items remain retryable after exact reapproval.":"Approved items applied idempotently.",result:result.data};
}

export async function compensateBatchAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  if(value(form,"confirmation")!=="ARCHIVE BATCH")return fail("Type ARCHIVE BATCH to confirm non-destructive compensation.");
  const result=await auth.supabase.rpc("os_compensate_intake_batch",{p_batch_id:value(form,"batch_id"),p_manifest_hash:value(form,"manifest_hash")});
  if(result.error)return fail(rpcFailure(result.error,"Batch compensation could not be completed.")); refresh(); return {status:"success",message:"Imported records were archived or compensated without erasing history.",result:result.data};
}

export async function previewCleanupAction(_state: DataReadinessActionState, form: FormData): Promise<DataReadinessActionState> {
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const upload=form.get("cleanup_manifest");
  if(!(upload instanceof File)||!upload.size||upload.size>524288)return fail("Choose the exact reviewed cleanup manifest (512 KiB maximum).");
  const encoded=Buffer.from(await upload.arrayBuffer()).toString("base64");
  const result=await auth.supabase.rpc("os_preview_cleanup_manifest",{p_manifest_base64:encoded});
  if(result.error)return fail(rpcFailure(result.error,"The reviewed cleanup manifest could not be verified."));
  refresh(); return {status:"success",message:"Exact Owner-reviewed manifest verified. Customer archival and outbox quarantine remain separate actions.",result:result.data};
}

async function cleanupAction(form:FormData,rpc:string,success:string):Promise<DataReadinessActionState>{
  const auth=await owner(); if(!auth)return fail("Owner authorization is required.");
  const result=await auth.supabase.rpc(rpc,{p_batch_id:value(form,"batch_id"),p_manifest_hash:value(form,"manifest_hash"),p_confirmation:value(form,"confirmation")});
  if(result.error)return fail(rpcFailure(result.error,"The bounded cleanup action was stopped without a partial change."));
  refresh(); return {status:"success",message:success,result:result.data};
}

export async function archiveCleanupCustomersAction(_state:DataReadinessActionState,form:FormData){return cleanupAction(form,"os_execute_cleanup_customer_archive","The exact reviewed customer set was archived. History was preserved.");}
export async function restoreCleanupCustomersAction(_state:DataReadinessActionState,form:FormData){return cleanupAction(form,"os_restore_cleanup_customer_archive","The exact customer batch was restored to its recorded prior states.");}
export async function quarantineCleanupOutboxAction(_state:DataReadinessActionState,form:FormData){return cleanupAction(form,"os_execute_cleanup_outbox_quarantine","The exact reviewed synthetic outbox set was quarantined without replay or deletion.");}
export async function restoreCleanupOutboxAction(_state:DataReadinessActionState,form:FormData){return cleanupAction(form,"os_restore_cleanup_outbox_quarantine","The exact outbox batch was restored to its recorded prior states.");}
