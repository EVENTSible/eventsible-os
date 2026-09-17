import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const databaseUrl=process.env.SUPABASE_LOCAL_DB_URL??"postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if(/supabase\.co/i.test(databaseUrl))throw new Error("Refusing to run Warren promotion verification against a remote database.");
function sql(statement,{fail=false}={}){let result;try{result={status:0,stdout:execFileSync("psql",[databaseUrl,"--no-password","--no-psqlrc","--quiet","--set","ON_ERROR_STOP=1","--tuples-only","--no-align","--command",statement],{encoding:"utf8",env:{...process.env,PGPASSWORD:process.env.PGPASSWORD??"postgres"}}),stderr:""};}catch(error){result={status:error.status||1,stdout:String(error.stdout??""),stderr:String(error.stderr??error.message??"")};}if(fail&&result.status===0)throw new Error("Expected Warren promotion call to fail.");if(!fail&&result.status!==0)throw new Error(`Warren promotion verification failed: ${(result.stderr||result.stdout).slice(0,1800)}`);return String(result.stdout??"").trim().split(/\r?\n/).filter(Boolean).at(-1)??"";}
const ids={owner:"12000000-0000-4000-8000-000000000071",manager:"12000000-0000-4000-8000-000000000072",staff:"12000000-0000-4000-8000-000000000073",host:"12000000-0000-4000-8000-000000000074",other:"12000000-0000-4000-8000-000000000075"};
const testPhone="+15555550199";
const testContactName="Synthetic Reviewed Contact";
const testPhoneHash=createHash("sha256").update(testPhone).digest("hex");
const testContactNameHash=createHash("sha256").update(testContactName.toLowerCase()).digest("hex");
const claims=(id,role)=>JSON.stringify({sub:id,role:"authenticated",aud:"authenticated",app_metadata:role?{role}:{}}).replaceAll("'","''");
const asUser=(id,role,statement)=>sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${statement}; commit;`);
const denied=(id,role,statement)=>sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${statement}; commit;`,{fail:true});

if(sql("select exists(select 1 from supabase_migrations.schema_migrations where version='20260917172431')")!=="t")throw new Error("Warren promotion migration is absent from the isolated ledger.");
if(sql("select bool_and(c.relrowsecurity) from pg_class c where c.oid in ('public.os_owner_candidate_promotion_scopes'::regclass,'public.os_owner_candidate_promotion_audits'::regclass)")!=="t")throw new Error("Promotion RLS is disabled.");
if(sql("select bool_and(p.prosecdef and r.rolname='postgres' and 'search_path=\"\"'=any(p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname in ('os_preview_warren_owner_attestation','os_apply_warren_owner_attestation','os_compensate_warren_owner_attestation')")!=="t")throw new Error("Promotion RPC ownership or search path is unsafe.");
if(sql("select not has_table_privilege('authenticated','public.os_owner_candidate_promotion_audits','select') and not has_table_privilege('anon','public.os_owner_candidate_promotion_scopes','select') and not has_function_privilege('public','public.os_apply_warren_owner_attestation(text,text,text,text)','execute') and not has_function_privilege('anon','public.os_apply_warren_owner_attestation(text,text,text,text)','execute')")!=="t")throw new Error("Promotion raw grants are too broad.");

// The preceding Vera/Warren fixture ends compensated. Restore only that local
// synthetic fixture to the exact deployed applied state needed by this test.
sql(`
do $$
declare v_fixture_candidate uuid;
begin
  select id into v_fixture_candidate
  from public.os_event_import_candidates
  where source='owner_correction' and external_reference='warren-70th-birthday:2026-09-26';
  if v_fixture_candidate is distinct from '15ce422a-18e3-4a53-a005-2e5a919be572'::uuid then
    update public.os_owner_maintenance_corrections
    set review_candidate_id=null
    where correction_key='vera-warren-separation-v1';
    update public.os_event_import_candidates
    set id='15ce422a-18e3-4a53-a005-2e5a919be572'::uuid
    where id=v_fixture_candidate;
    update public.os_owner_maintenance_corrections
    set review_candidate_id='15ce422a-18e3-4a53-a005-2e5a919be572'::uuid
    where correction_key='vera-warren-separation-v1';
  end if;
end $$;
update public.os_events set title='70th Birthday Karaoke' where id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5';
update public.os_import_source_provenance set source_ref='Vera service agreement' where id='ca45d79e-bb12-4113-911c-360c9a7b411d';
update public.os_event_notes set status='archived' where id='d4549943-7e9b-40eb-9ffb-888d75ed62a2';
update public.os_event_import_candidates set review_status='pending',reviewed_by_user_id=null,reviewed_at=null,matched_event_id=null,imported_event_id=null,imported_contact_id=null,imported_booking_id=null where id='15ce422a-18e3-4a53-a005-2e5a919be572';
update public.os_owner_maintenance_corrections set status='applied',compensated_by=null,compensated_at=null where correction_key='vera-warren-separation-v1';
update public.os_owner_candidate_promotion_scopes set expected_contact_name_hash='${testContactNameHash}',expected_phone_hash='${testPhoneHash}' where promotion_key='warren-owner-attestation-v1';
`);

for(const [id,role] of [[ids.manager,"manager"],[ids.staff,"staff"],[ids.host,"host"],[ids.other,null]])denied(id,role,"select public.os_preview_warren_owner_attestation()");
sql("set role anon; select public.os_preview_warren_owner_attestation()",{fail:true});
denied(ids.owner,"owner","select count(*) from public.os_owner_candidate_promotion_audits");

const beforeCounts=sql("select jsonb_build_object('contacts',(select count(*) from public.os_contacts),'leads',(select count(*) from public.os_leads),'events',(select count(*) from public.os_events),'bookings',(select count(*) from public.os_bookings),'services',(select count(*) from public.os_booking_services),'payments',(select count(*) from public.os_booking_payment_facts),'assignments',(select count(*) from public.os_staff_assignments),'provenance',(select count(*) from public.os_import_source_provenance),'notifications',(select count(*) from public.os_notification_deliveries),'integration',(select count(*) from public.os_integration_outbox),'automation',(select count(*) from public.os_automation_outbox),'batchItems',(select count(*) from public.os_import_batch_items where batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'))");
const preview=JSON.parse(asUser(ids.owner,"owner","select public.os_preview_warren_owner_attestation()"));
if(preview.status!=="ready"||preview.candidateId!=="15ce422a-18e3-4a53-a005-2e5a919be572"||preview.event?.startsAt!=="2026-09-26T21:00:00Z"||preview.booking?.serviceLines!==0)throw new Error("Owner preview did not return the exact bounded proposal.");
if(Object.values(preview.duplicates??{}).some((rows)=>!Array.isArray(rows)||rows.length))throw new Error("Synthetic preview did not have a clear duplicate scan.");
denied(ids.owner,"owner",`select public.os_apply_warren_owner_attestation('${preview.currentFingerprint}','${testContactName}','${testPhone}','WRONG CONFIRMATION')`);
denied(ids.owner,"owner",`select public.os_apply_warren_owner_attestation('${"0".repeat(64)}','${testContactName}','${testPhone}','PROMOTE WARREN OWNER ATTESTATION')`);
if(sql("select count(*) from public.os_owner_candidate_promotion_audits")!=="0")throw new Error("Rejected promotion left audit state.");

// Force a late unique-key failure so every earlier insert must roll back.
sql("insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key) values('12000000-0000-4000-8000-000000000071','synthetic.blocker','staff','{}','owner_candidate_promotion:warren-owner-attestation-v1:apply')");
denied(ids.owner,"owner",`select public.os_apply_warren_owner_attestation('${preview.currentFingerprint}','${testContactName}','${testPhone}','PROMOTE WARREN OWNER ATTESTATION')`);
if(sql("select count(*) from public.os_owner_candidate_promotion_audits")!=="0"||sql("select count(*) from public.os_contacts where metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'")!=="0"||sql("select review_status from public.os_event_import_candidates where id='15ce422a-18e3-4a53-a005-2e5a919be572'")!=="pending")throw new Error("Atomic failure left a partial promotion.");
sql("delete from public.os_activity_events where idempotency_key='owner_candidate_promotion:warren-owner-attestation-v1:apply'");

const applied=JSON.parse(asUser(ids.owner,"owner",`select public.os_apply_warren_owner_attestation('${preview.currentFingerprint}','${testContactName}','${testPhone}','PROMOTE WARREN OWNER ATTESTATION')`));
if(applied.status!=="applied")throw new Error("Owner promotion did not apply.");
if(sql(`select count(*) from public.os_contacts where id='${applied.contactId}' and display_name='${testContactName}' and primary_phone='${testPhone}' and primary_email is null and status='active'`)!=="1")throw new Error("Exact synthetic contact was not created.");
if(sql(`select count(*) from public.os_events where id='${applied.eventId}' and primary_contact_id='${applied.contactId}' and title='Warren’s 70th Birthday' and event_type='birthday_party' and status='booked' and starts_at='2026-09-26T21:00:00Z' and ends_at='2026-09-27T02:00:00Z' and timezone='America/Indiana/Indianapolis' and venue_name='Wingate by Wyndham' and venue_address_1 is null and venue_city='South Bend' and venue_state='Indiana'`)!=="1")throw new Error("Exact timed birthday event was not created.");
if(sql(`select count(*) from public.os_leads where id='${applied.leadId}' and contact_id='${applied.contactId}' and event_id='${applied.eventId}' and status='won' and estimated_value=300`)!=="1")throw new Error("Exact inquiry was not created.");
if(sql(`select count(*) from public.os_bookings where id='${applied.bookingId}' and event_id='${applied.eventId}' and status='confirmed' and payment_status='unpaid' and total_amount=300 and deposit_amount is null and balance_due=300 and metadata->>'suppressAutomations' is null`)!=="1")throw new Error("Zero-service unpaid booking was not preserved correctly.");
if(sql(`select count(*) from public.os_booking_services where booking_id='${applied.bookingId}'`)!=="0"||sql(`select count(*) from public.os_booking_payment_facts where booking_id='${applied.bookingId}'`)!=="0"||sql(`select count(*) from public.os_staff_assignments where event_id='${applied.eventId}'`)!=="0"||sql(`select count(*) from public.os_import_source_provenance where event_id='${applied.eventId}'`)!=="0")throw new Error("Promotion fabricated a service, payment, assignment, or provenance row.");
if(sql(`select count(*) from public.os_planning_assignments where event_id='${applied.eventId}'`)!=="0"||sql(`select count(*) from public.os_message_threads where event_id='${applied.eventId}'`)!=="0"||sql(`select count(*) from public.os_event_facts where event_id='${applied.eventId}'`)!=="0")throw new Error("Promotion triggered normal booking bootstrap side effects.");
if(sql(`select count(*) from public.os_activity_events where id='${applied.activityId}' and event_id='${applied.eventId}' and contact_id='${applied.contactId}' and event_type='data_readiness.owner_attested_candidate_promoted' and payload->>'evidenceClassification'='Owner attestation by Travis'`)!=="1")throw new Error("Owner attestation audit activity is missing.");
if(sql(`select count(*) from public.os_event_import_candidates where id='15ce422a-18e3-4a53-a005-2e5a919be572' and review_status='imported' and imported_contact_id='${applied.contactId}' and imported_event_id='${applied.eventId}' and imported_booking_id='${applied.bookingId}'`)!=="1")throw new Error("Candidate was not resolved and linked.");

const replay=JSON.parse(asUser(ids.owner,"owner",`select public.os_apply_warren_owner_attestation('${preview.currentFingerprint}','${testContactName}','${testPhone}','PROMOTE WARREN OWNER ATTESTATION')`));
if(replay.status!=="replayed"||replay.eventId!==applied.eventId||sql("select count(*) from public.os_owner_candidate_promotion_audits")!=="1")throw new Error("Identical promotion replay was not idempotent.");

const compensated=JSON.parse(asUser(ids.owner,"owner",`select public.os_compensate_warren_owner_attestation('${applied.afterFingerprint}','COMPENSATE WARREN OWNER ATTESTATION')`));
if(compensated.status!=="compensated"||sql(`select status from public.os_contacts where id='${applied.contactId}'`)!=="archived"||sql(`select status from public.os_leads where id='${applied.leadId}'`)!=="archived"||sql(`select status from public.os_events where id='${applied.eventId}'`)!=="archived"||sql(`select status from public.os_bookings where id='${applied.bookingId}'`)!=="cancelled"||sql("select review_status from public.os_event_import_candidates where id='15ce422a-18e3-4a53-a005-2e5a919be572'")!=="pending")throw new Error("Compensation did not archive created records and restore the candidate.");
const compensationReplay=JSON.parse(asUser(ids.owner,"owner",`select public.os_compensate_warren_owner_attestation('${applied.afterFingerprint}','COMPENSATE WARREN OWNER ATTESTATION')`));
if(compensationReplay.status!=="replayed"||sql("select count(*) from public.os_owner_candidate_promotion_audits")!=="1")throw new Error("Compensation replay was not idempotent.");

const afterProtected=JSON.parse(sql("select jsonb_build_object('services',(select count(*) from public.os_booking_services),'payments',(select count(*) from public.os_booking_payment_facts),'assignments',(select count(*) from public.os_staff_assignments),'provenance',(select count(*) from public.os_import_source_provenance),'notifications',(select count(*) from public.os_notification_deliveries),'integration',(select count(*) from public.os_integration_outbox),'automation',(select count(*) from public.os_automation_outbox),'batchItems',(select count(*) from public.os_import_batch_items where batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'))"));
const before=JSON.parse(beforeCounts);
for(const key of ["services","payments","assignments","provenance","notifications","integration","automation","batchItems"])if(afterProtected[key]!==before[key])throw new Error(`Protected ${key} count changed.`);
if(sql("select count(*) from public.os_import_batches where id='4beb47eb-3087-4e51-9fda-ddb2eaa84893' and status='completed' and row_count=243 and created_count=243")!=="1")throw new Error("Completed import batch changed.");
if(sql("select count(*) from public.os_events where id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5' and title='70th Birthday Karaoke'")!=="1")throw new Error("Vera's corrected chain changed.");

console.log("Warren Owner-attestation verification passed: preview, exact fingerprint, Owner-only authorization, duplicate rejection, atomic rollback, zero-service apply, no payment/automation side effects, idempotent replay, bounded compensation, and protected history non-change.");
