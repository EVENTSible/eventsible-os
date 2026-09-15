import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

import { COMPLETE_INTAKE_SOURCE_BASELINE, completeItemCounts } from "../src/lib/data-readiness.mjs";

const databaseUrl=process.env.SUPABASE_LOCAL_DB_URL??"postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dockerBin=process.env.EVENTSIBLE_DOCKER_BIN;
const container=process.env.EVENTSIBLE_SUPABASE_DB_CONTAINER??"supabase_db_eventsible-os-local-ci";
if(/supabase\.co/i.test(databaseUrl))throw new Error("Refusing to run complete-intake verification against a remote or Production database.");

function execute(sql,{expectFailure=false}={}){
  let result;
  if(dockerBin)result=spawnSync(dockerBin,["exec","-i",container,"psql","-U","postgres","-d","postgres","--no-psqlrc","--quiet","--set","ON_ERROR_STOP=1","--tuples-only","--no-align"],{input:sql,encoding:"utf8"});
  else{try{result={status:0,stdout:execFileSync("psql",[databaseUrl,"--no-password","--no-psqlrc","--quiet","--set","ON_ERROR_STOP=1","--tuples-only","--no-align","--command",sql],{encoding:"utf8",env:{...process.env,PGPASSWORD:process.env.PGPASSWORD??"postgres"}}),stderr:""};}catch(error){result={status:error.status||1,stdout:String(error.stdout??""),stderr:String(error.stderr??error.message??"")};}}
  if(expectFailure&&result.status===0)throw new Error(`Expected denial/failure but command succeeded: ${sql.slice(0,120)}`);
  if(!expectFailure&&result.status!==0)throw new Error(`Complete-intake database verification failed: ${(result.stderr||result.stdout).slice(0,1200)}`);
  return String(result.stdout??"").trim().split(/\r?\n/).filter(Boolean).at(-1)??"";
}

const ids={owner:"12000000-0000-4000-8000-000000000001",manager:"12000000-0000-4000-8000-000000000002",staff:"12000000-0000-4000-8000-000000000003",host:"12000000-0000-4000-8000-000000000004",other:"12000000-0000-4000-8000-000000000005",team:["52000000-0000-4000-8000-000000000001","52000000-0000-4000-8000-000000000002","52000000-0000-4000-8000-000000000003"]};
const claims=(id,role)=>JSON.stringify({sub:id,role:"authenticated",aud:"authenticated",app_metadata:role?{role}:{}}).replaceAll("'","''");
const asUser=(id,role,sql)=>execute(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${sql}; commit;`);
const denied=(id,role,sql)=>execute(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id,role)}',true); ${sql}; commit;`,{expectFailure:true});
const sourceHash=(value)=>createHash("sha256").update(`synthetic:${value}`).digest("hex");
const sqlText=(value)=>String(value).replaceAll("'","''");

execute(`
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','${ids.owner}','authenticated','authenticated','complete-owner@example.invalid','',now(),'','','','', '{"role":"owner"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.manager}','authenticated','authenticated','complete-manager@example.invalid','',now(),'','','','', '{"role":"manager"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.staff}','authenticated','authenticated','complete-staff@example.invalid','',now(),'','','','', '{"role":"staff"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.host}','authenticated','authenticated','complete-host@example.invalid','',now(),'','','','', '{"role":"host"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.other}','authenticated','authenticated','complete-other@example.invalid','',now(),'','','','','{}','{}',now(),now()) on conflict(id) do nothing;
insert into public.os_team_members(id,user_id,display_name,status,created_by_user_id) values
('${ids.team[0]}','${ids.owner}','Synthetic Trav','active','${ids.owner}'),
('${ids.team[1]}','${ids.manager}','Synthetic Missy','active','${ids.owner}'),
('${ids.team[2]}','${ids.staff}','Synthetic Choc','active','${ids.owner}') on conflict(id) do nothing;
`);

if(execute("select exists(select 1 from supabase_migrations.schema_migrations where version='20260915035447')")!=="t")throw new Error("Complete importer migration is absent from the isolated ledger.");
if(execute("select count(*) from pg_class where oid in ('public.os_booking_payment_facts'::regclass,'public.os_import_source_provenance'::regclass) and relrowsecurity")!=="2")throw new Error("Complete importer RLS is not enabled.");
if(execute("select not has_table_privilege('anon','public.os_booking_payment_facts','select') and not has_table_privilege('authenticated','public.os_booking_payment_facts','select') and not has_table_privilege('anon','public.os_import_source_provenance','select') and not has_table_privilege('authenticated','public.os_import_source_provenance','select')")!=="t")throw new Error("Complete importer raw table grants are too broad.");
if(execute("select bool_and(p.prosecdef and r.rolname='postgres' and 'search_path=\"\"'=any(p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname in ('os_stage_complete_intake_manifest','os_approve_complete_intake_batch','os_apply_complete_intake_batch','os_rollback_complete_intake_batch')")!=="t")throw new Error("Complete importer function owner, SECURITY DEFINER, or search_path contract failed.");
if(execute("select count(*) from pg_indexes where schemaname='public' and indexname in ('os_booking_payment_facts_booking_idx','os_booking_payment_facts_source_hash_idx','os_import_source_provenance_batch_idx','os_import_source_provenance_contact_idx','os_import_source_provenance_lead_idx','os_import_source_provenance_event_idx','os_import_source_provenance_booking_idx','os_contacts_import_source_hash_idx','os_events_import_source_hash_idx','os_leads_import_source_hash_idx','os_bookings_import_source_hash_idx','os_booking_services_import_source_hash_idx')")!=="12")throw new Error("Complete importer supporting indexes are incomplete.");
if(execute("select not has_function_privilege('public','public.os_apply_complete_intake_batch(uuid,text,integer,jsonb)','execute') and not has_function_privilege('anon','public.os_apply_complete_intake_batch(uuid,text,integer,jsonb)','execute') and has_function_privilege('authenticated','public.os_apply_complete_intake_batch(uuid,text,integer,jsonb)','execute')")!=="t")throw new Error("Complete importer execution grants are incorrect.");
denied(ids.owner,"owner","select count(*) from public.os_booking_payment_facts");
execute("set role anon; select public.os_apply_complete_intake_batch(null,'',24,'{}'::jsonb)",{expectFailure:true});

function buildManifest({suffix="success",badTeam=false,duplicateEmail=null}={}){
  const contacts=Array.from({length:24},(_,i)=>({key:`contact.${suffix}-${i}`,type:"contact",sourceHash:sourceHash(`${suffix}:contact:${i}`),sourceRef:`synthetic/${suffix}/contact-${i}`,uncertainFields:[],data:{displayName:`Synthetic contact ${suffix} ${i}`,primaryEmail:duplicateEmail&&i===0?duplicateEmail:`${suffix}-${i}@example.invalid`}}));
  const events=contacts.map((contact,i)=>({key:`event.${suffix}-${i}`,type:"event",sourceHash:sourceHash(`${suffix}:event:${i}`),sourceRef:`synthetic/${suffix}/event-${i}`,uncertainFields:[],data:{primaryContactItemKey:contact.key,title:`Synthetic gig ${suffix} ${i}`,eventType:i===23?"cross_country":"test",status:i===22?"inquiry":i===23?"pending":"completed",recordDisposition:i===22?"lower_confidence_review":i===23?"pending_unbooked":"confirmed",startsAt:`2027-0${(i%9)+1}-01T15:00:00Z`,endsAt:`2027-0${(i%9)+1}-01T18:00:00Z`,timezone:"America/Indiana/Indianapolis"}}));
  const inquiries=[22,23].map(i=>({key:`inquiry.${suffix}-${i}`,type:"inquiry",sourceHash:sourceHash(`${suffix}:inquiry:${i}`),sourceRef:`synthetic/${suffix}/inquiry-${i}`,uncertainFields:[],data:{contactItemKey:contacts[i].key,eventItemKey:events[i].key,status:"new",summary:i===23?"Synthetic pending, unbooked, no deposit":"Synthetic lower-confidence review"}}));
  const bookings=Array.from({length:22},(_,i)=>({key:`booking.${suffix}-${i}`,type:"booking",sourceHash:sourceHash(`${suffix}:booking:${i}`),sourceRef:`synthetic/${suffix}/booking-${i}`,uncertainFields:[],data:{eventItemKey:events[i].key,status:i===21?"confirmed":"completed",contractStatus:"signed",bookedAt:"2026-09-01T12:00:00Z"}}));
  const services=bookings.map((booking,i)=>({key:`service.${suffix}-${i}`,type:"booking_service",sourceHash:sourceHash(`${suffix}:service:${i}`),sourceRef:`synthetic/${suffix}/service-${i}`,uncertainFields:[],data:{bookingItemKey:booking.key,serviceCode:"dj_mc",serviceName:"DJ / Emcee",status:i===21?"booked":"delivered",quantity:"1",unitPrice:"500",lineTotal:"500"}}));
  const payments=bookings.map((booking,i)=>({key:`payment.${suffix}-${i}`,type:"payment_fact",sourceHash:sourceHash(`${suffix}:payment:${i}`),sourceRef:`synthetic/${suffix}/payment-${i}`,uncertainFields:[],data:{bookingItemKey:booking.key,grossClientAmount:i===0?"595":"500",platformFeeAmount:i===0?"14.88":"0",netPayoutAmount:i===0?"580.12":"500",depositAmount:i===0?"595":"500",balanceDue:"0",paymentMethod:i===0?"gigsalad":"check",paymentStatus:"paid",payoutStatus:"paid",currency:"USD"}}));
  const assignments=[0,1,2].map((i)=>({key:`assignment.${suffix}-${i}`,type:"staff_assignment",sourceHash:sourceHash(`${suffix}:assignment:${i}`),sourceRef:`synthetic/${suffix}/assignment-${i}`,uncertainFields:[],data:{eventItemKey:events[0].key,teamMemberId:badTeam&&i===2?"52000000-0000-4000-8000-000000000099":ids.team[i],assignmentRole:i===0?"dj":"assistant"}}));
  const notes=events.map((event,i)=>({key:`note.${suffix}-${i}`,type:"operational_note",sourceHash:sourceHash(`${suffix}:note:${i}`),sourceRef:`synthetic/${suffix}/note-${i}`,uncertainFields:[],data:{eventItemKey:event.key,noteType:"general",body:`Synthetic operational note ${i}`}}));
  const provenance=events.map((event,i)=>({key:`provenance.${suffix}-${i}`,type:"source_provenance",sourceHash:sourceHash(`${suffix}:provenance:${i}`),sourceRef:`synthetic/${suffix}/source-${i}`,uncertainFields:[],data:{targetItemKey:event.key,evidenceKind:i===22?"calendar":"invoice",confidence:i===22?"lower_confidence":"confirmed"}}));
  const items=[...contacts,...events,...inquiries,...bookings,...services,...payments,...assignments,...notes,...provenance];
  return {contractVersion:"intake_manifest_v2",sourceBaselineHash:COMPLETE_INTAKE_SOURCE_BASELINE,sourceLabel:`Synthetic complete ${suffix}`,recordCount:24,itemCounts:completeItemCounts(items),items};
}

function stage(manifest){const raw=JSON.stringify(manifest);const hash=createHash("sha256").update(raw).digest("hex");const base64=Buffer.from(raw).toString("base64");const counts=sqlText(JSON.stringify(manifest.itemCounts));const result=JSON.parse(asUser(ids.owner,"owner",`select public.os_stage_complete_intake_manifest('${base64}','${hash}',24,'${counts}'::jsonb)`));return {...result,hash,counts,keys:manifest.items.map(item=>item.key)};}
function approve(staged){return asUser(ids.owner,"owner",`select public.os_approve_complete_intake_batch('${staged.batchId}','${staged.hash}',24,'${staged.counts}'::jsonb,array[${staged.keys.map(key=>`'${sqlText(key)}'`).join(",")}])`);}
function apply(staged){return JSON.parse(asUser(ids.owner,"owner",`select public.os_apply_complete_intake_batch('${staged.batchId}','${staged.hash}',24,'${staged.counts}'::jsonb)`));}
function linkExisting(manifest,key,id,expectedRecordHash){const item=manifest.items.find((candidate)=>candidate.key===key);if(!item)throw new Error(`Missing synthetic link item ${key}`);item.data={...item.data,recordMode:"link_existing",existingRecordId:id,expectedRecordHash,sourcePrecedence:"preserve_existing_native"};}

const roleManifest=buildManifest({suffix:"role"});const roleRaw=JSON.stringify(roleManifest);const roleHash=createHash("sha256").update(roleRaw).digest("hex");const roleBase64=Buffer.from(roleRaw).toString("base64");
for(const [id,role] of [[ids.manager,"manager"],[ids.staff,"staff"],[ids.host,"host"],[ids.other,null]])denied(id,role,`select public.os_stage_complete_intake_manifest('${roleBase64}','${roleHash}',24,'${sqlText(JSON.stringify(roleManifest.itemCounts))}'::jsonb)`);
execute(`set role anon; select public.os_stage_complete_intake_manifest('${roleBase64}','${roleHash}',24,'${sqlText(JSON.stringify(roleManifest.itemCounts))}'::jsonb)`,{expectFailure:true});
denied(ids.owner,"owner",`select public.os_stage_complete_intake_manifest('${roleBase64}','${"0".repeat(64)}',24,'${sqlText(JSON.stringify(roleManifest.itemCounts))}'::jsonb)`);
denied(ids.owner,"owner",`select public.os_stage_complete_intake_manifest('${roleBase64}','${roleHash}',23,'${sqlText(JSON.stringify(roleManifest.itemCounts))}'::jsonb)`);

const native={contact:"61000000-0000-4000-8000-000000000001",submission:"61000000-0000-4000-8000-000000000002",event:"61000000-0000-4000-8000-000000000003",lead:"61000000-0000-4000-8000-000000000004",booking:"61000000-0000-4000-8000-000000000005",weddingContact:"61000000-0000-4000-8000-000000000006",weddingEvent:"61000000-0000-4000-8000-000000000007",assignment:"61000000-0000-4000-8000-000000000008",answer:"61000000-0000-4000-8000-000000000009"};
execute(`
insert into public.os_contacts(id,display_name,primary_email,source,status) values
('${native.contact}','Synthetic Builder native','native-builder@example.invalid','eventsible_event_builder','active'),
('${native.weddingContact}','Synthetic Wedding native','native-wedding@example.invalid','wedding_hero_public_submission','active');
insert into public.os_builder_submissions(id,contact_id,source_session_id,event_type,status,source,request_fingerprint,submitted_from,intake_version)
values('${native.submission}','${native.contact}','synthetic-native-session','Private Party','lead_created','eventsible_event_builder','synthetic-native-fingerprint','eventsible-event-builder',1);
insert into public.os_events(id,primary_contact_id,builder_submission_id,title,event_type,status,starts_at,timezone,source) values
('${native.event}','${native.contact}','${native.submission}','Synthetic Builder native gig','Private Party','inquiry','2027-01-01T15:00:00Z','America/Indiana/Indianapolis','eventsible_event_builder'),
('${native.weddingEvent}','${native.weddingContact}',null,'Synthetic Wedding native gig','Wedding','inquiry','2027-02-01T15:00:00Z','America/Indiana/Indianapolis','wedding_hero_public_submission');
insert into public.os_leads(id,contact_id,event_id,builder_submission_id,status,source) values('${native.lead}','${native.contact}','${native.event}','${native.submission}','new','eventsible_event_builder');
insert into public.os_bookings(id,event_id,status,contract_status,payment_status) values('${native.booking}','${native.event}','pending','sent','unpaid');
insert into public.os_planning_assignments(id,event_id,template_id,status,settings) select '${native.assignment}','${native.weddingEvent}',id,'submitted','{"public_draft_id":"synthetic-native-draft"}'::jsonb from public.os_planning_templates where slug='wedding-hero' order by version desc limit 1;
insert into public.os_planning_answers(id,assignment_id,question_key,value,source,is_confirmed) values('${native.answer}','${native.assignment}','synthetic_native_answer','"preserve me"'::jsonb,'client',true);
`);
const nativeHashes={contact:execute(`select private.os_complete_intake_record_fingerprint('contact','${native.contact}')`),event:execute(`select private.os_complete_intake_record_fingerprint('event','${native.event}')`),lead:execute(`select private.os_complete_intake_record_fingerprint('inquiry','${native.lead}')`),booking:execute(`select private.os_complete_intake_record_fingerprint('booking','${native.booking}')`),weddingContact:execute(`select private.os_complete_intake_record_fingerprint('contact','${native.weddingContact}')`),weddingEvent:execute(`select private.os_complete_intake_record_fingerprint('event','${native.weddingEvent}')`)};
const protectedNativeHash=execute(`select encode(extensions.digest(convert_to(jsonb_build_object('builder',(select to_jsonb(r) from public.os_builder_submissions r where id='${native.submission}'),'planning',(select to_jsonb(r) from public.os_planning_assignments r where id='${native.assignment}'),'answer',(select to_jsonb(r) from public.os_planning_answers r where id='${native.answer}'))::text,'UTF8'),'sha256'),'hex')`);
const compatibility=buildManifest({suffix:"compatibility"});
linkExisting(compatibility,"contact.compatibility-0",native.contact,nativeHashes.contact);
linkExisting(compatibility,"event.compatibility-0",native.event,nativeHashes.event);
linkExisting(compatibility,"booking.compatibility-0",native.booking,nativeHashes.booking);
linkExisting(compatibility,"contact.compatibility-1",native.weddingContact,nativeHashes.weddingContact);
linkExisting(compatibility,"event.compatibility-1",native.weddingEvent,nativeHashes.weddingEvent);
const linkedInquiry=compatibility.items.find((item)=>item.key==="inquiry.compatibility-22");
linkedInquiry.data={...linkedInquiry.data,contactItemKey:"contact.compatibility-0",eventItemKey:"event.compatibility-0",recordMode:"link_existing",existingRecordId:native.lead,expectedRecordHash:nativeHashes.lead,sourcePrecedence:"preserve_existing_native"};
const compatibilityStage=stage(compatibility);approve(compatibilityStage);const compatibilityApplied=apply(compatibilityStage);
if(compatibilityApplied.status!=="completed")throw new Error("Existing native chains could not be linked safely.");
if(execute(`select private.os_complete_intake_record_fingerprint('contact','${native.contact}')||':'||private.os_complete_intake_record_fingerprint('event','${native.event}')||':'||private.os_complete_intake_record_fingerprint('inquiry','${native.lead}')`)!==`${nativeHashes.contact}:${nativeHashes.event}:${nativeHashes.lead}`)throw new Error("Linking imported evidence overwrote native contact, event, or inquiry fields.");
if(execute(`select encode(extensions.digest(convert_to(jsonb_build_object('builder',(select to_jsonb(r) from public.os_builder_submissions r where id='${native.submission}'),'planning',(select to_jsonb(r) from public.os_planning_assignments r where id='${native.assignment}'),'answer',(select to_jsonb(r) from public.os_planning_answers r where id='${native.answer}'))::text,'UTF8'),'sha256'),'hex')`)!==protectedNativeHash)throw new Error("Import changed Builder submission or Wedding planning data.");
if(execute(`select count(*) from public.os_import_batch_items where batch_id='${compatibilityStage.batchId}' and proposed_data->>'recordMode'='link_existing' and result->'before'->>'sourcePrecedence'='preserve_existing_native'`)!=="6")throw new Error("Existing-link audit results do not preserve the source-precedence decision.");
const compatibilityRolled=JSON.parse(asUser(ids.owner,"owner",`select public.os_rollback_complete_intake_batch('${compatibilityStage.batchId}','${compatibilityStage.hash}',24,'${compatibilityStage.counts}'::jsonb)`));
if(compatibilityRolled.status!=="rolled_back")throw new Error("Compatibility import did not roll back.");
if(execute(`select private.os_complete_intake_record_fingerprint('contact','${native.contact}')||':'||private.os_complete_intake_record_fingerprint('event','${native.event}')||':'||private.os_complete_intake_record_fingerprint('inquiry','${native.lead}')||':'||private.os_complete_intake_record_fingerprint('booking','${native.booking}')`)!==`${nativeHashes.contact}:${nativeHashes.event}:${nativeHashes.lead}:${nativeHashes.booking}`)throw new Error("Import rollback harmed a linked native record.");
if(execute(`select encode(extensions.digest(convert_to(jsonb_build_object('builder',(select to_jsonb(r) from public.os_builder_submissions r where id='${native.submission}'),'planning',(select to_jsonb(r) from public.os_planning_assignments r where id='${native.assignment}'),'answer',(select to_jsonb(r) from public.os_planning_answers r where id='${native.answer}'))::text,'UTF8'),'sha256'),'hex')`)!==protectedNativeHash)throw new Error("Import rollback harmed Builder submission or Wedding planning data.");

const liveChange=stage(buildManifest({suffix:"live-change"}));approve(liveChange);
execute(`insert into public.os_builder_intake_requests(source_session_id,request_fingerprint,payload,status) values('synthetic-live-change','synthetic-live-change','{}'::jsonb,'received')`);
denied(ids.owner,"owner",`select public.os_apply_complete_intake_batch('${liveChange.batchId}','${liveChange.hash}',24,'${liveChange.counts}'::jsonb)`);
if(execute(`select count(*) from public.os_contacts where metadata->>'importBatchId'='${liveChange.batchId}'`)!=="0")throw new Error("A live native submission did not stop the import before canonical writes.");

const outboxBefore=execute("select (select count(*) from public.os_integration_outbox)||':'||(select count(*) from public.os_automation_outbox)");
const failed=stage(buildManifest({suffix:"atomic",badTeam:true}));approve(failed);
execute(`begin; set local role authenticated; select set_config('request.jwt.claims','${claims(ids.owner,"owner")}',true); select public.os_apply_complete_intake_batch('${failed.batchId}','${failed.hash}',24,'${failed.counts}'::jsonb); commit;`,{expectFailure:true});
if(execute(`select (select count(*) from public.os_contacts where metadata->>'importBatchId'='${failed.batchId}')+(select count(*) from public.os_events where settings->>'importBatchId'='${failed.batchId}')+(select count(*) from public.os_bookings where metadata->>'importBatchId'='${failed.batchId}')`)!=="0")throw new Error("Mid-transaction failure left canonical rows behind.");
if(execute(`select count(*) from public.os_import_batch_items where batch_id='${failed.batchId}' and status='approved'`)!==String(failed.keys.length))throw new Error("Atomic failure did not roll back item state.");

const staged=stage(buildManifest());approve(staged);const applied=apply(staged);
if(applied.status!=="completed"||applied.recordCount!==24||applied.applied!==staged.keys.length)throw new Error("The complete 24-record import did not apply atomically.");
const replay=apply(staged);if(replay.status!=="replayed"||replay.applied!==staged.keys.length)throw new Error("Manifest replay was not idempotent.");
const canonical=JSON.parse(execute(`select jsonb_build_object('contacts',(select count(*) from public.os_contacts where metadata->>'importBatchId'='${staged.batchId}'),'events',(select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}'),'bookings',(select count(*) from public.os_bookings where metadata->>'importBatchId'='${staged.batchId}'),'services',(select count(*) from public.os_booking_services where configuration->>'importBatchId'='${staged.batchId}'),'payments',(select count(*) from public.os_booking_payment_facts f join public.os_import_batch_items i on i.id=f.import_batch_item_id where i.batch_id='${staged.batchId}'),'assignments',(select count(*) from public.os_staff_assignments s join public.os_import_batch_items i on (i.canonical_record_ids->>'primaryId')::uuid=s.id where i.batch_id='${staged.batchId}' and i.candidate_type='staff_assignment'),'notes',(select count(*) from public.os_event_notes n join public.os_import_batch_items i on (i.canonical_record_ids->>'primaryId')::uuid=n.id where i.batch_id='${staged.batchId}' and i.candidate_type='operational_note'),'provenance',(select count(*) from public.os_import_source_provenance where batch_id='${staged.batchId}'))`));
const expectedCanonical={contacts:24,events:24,bookings:22,services:22,payments:22,assignments:3,notes:24,provenance:24};
if(Object.entries(expectedCanonical).some(([key,value])=>canonical[key]!==value))throw new Error(`Complete canonical counts differ: ${JSON.stringify(canonical)}`);
if(execute(`select count(*) from public.os_events e join public.os_import_batch_items i on (i.canonical_record_ids->>'primaryId')::uuid=e.id where i.batch_id='${staged.batchId}' and i.candidate_type='event' and e.primary_contact_id<>(select (c.canonical_record_ids->>'primaryId')::uuid from public.os_import_batch_items c where c.batch_id='${staged.batchId}' and c.item_key=i.proposed_data->>'primaryContactItemKey')`)!=="0")throw new Error("Stable contact-to-event key resolution failed.");
if(execute(`select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}' and settings->>'recordDisposition'='lower_confidence_review' and status='inquiry'`)!=="1")throw new Error("Lower-confidence record was not retained as an inquiry.");
if(execute(`select count(*) from public.os_events e where e.settings->>'importBatchId'='${staged.batchId}' and e.settings->>'recordDisposition'='pending_unbooked' and e.status='pending' and not exists(select 1 from public.os_bookings b where b.event_id=e.id)`)!=="1")throw new Error("Pending unbooked NIRCA-shaped record gained a booking or wrong status.");
if(execute(`select gross_client_amount||':'||platform_fee_amount||':'||net_payout_amount||':'||payment_method||':'||payment_status||':'||payout_status from public.os_booking_payment_facts where source_ref='synthetic/success/payment-0'`)!=="595.00:14.88:580.12:gigsalad:paid:paid")throw new Error("Separated financial fields were not preserved.");
if(execute("select count(*) from public.os_bookings where metadata ? 'suppressAutomations'")!=="0")throw new Error("Temporary automation suppression marker survived commit.");
if(execute("select (select count(*) from public.os_integration_outbox)||':'||(select count(*) from public.os_automation_outbox)")!==outboxBefore)throw new Error("Complete import touched an outbox.");

const duplicate=stage(buildManifest({suffix:"duplicate",duplicateEmail:"success-0@example.invalid"}));
denied(ids.owner,"owner",`select public.os_approve_complete_intake_batch('${duplicate.batchId}','${duplicate.hash}',24,'${duplicate.counts}'::jsonb,array[${duplicate.keys.map(key=>`'${sqlText(key)}'`).join(",")}])`);

const rolled=JSON.parse(asUser(ids.owner,"owner",`select public.os_rollback_complete_intake_batch('${staged.batchId}','${staged.hash}',24,'${staged.counts}'::jsonb)`));
if(rolled.status!=="rolled_back"||rolled.itemCount!==staged.keys.length)throw new Error("Bounded complete-import rollback failed.");
if(execute(`select count(*) from public.os_contacts where metadata->>'importBatchId'='${staged.batchId}' and status<>'archived'`)!=="0"||execute(`select count(*) from public.os_events where settings->>'importBatchId'='${staged.batchId}' and status<>'archived'`)!=="0"||execute(`select count(*) from public.os_bookings where metadata->>'importBatchId'='${staged.batchId}' and status<>'cancelled'`)!=="0")throw new Error("Rollback failed to archive/cancel imported parents.");
if(execute(`select count(*) from public.os_booking_payment_facts f join public.os_import_batch_items i on i.id=f.import_batch_item_id where i.batch_id='${staged.batchId}' and f.status<>'archived'`)!=="0")throw new Error("Rollback failed to archive payment facts.");
if(execute(`select count(*) from public.os_bookings where metadata->>'importBatchId'='${staged.batchId}' and (payment_status<>'unpaid' or total_amount is not null or deposit_amount is not null or balance_due is not null)`)!=="0")throw new Error("Rollback did not restore booking financial before-images.");
if(execute(`select count(*) from public.os_import_source_provenance where batch_id='${staged.batchId}'`)!=="24")throw new Error("Rollback erased source provenance history.");
if(execute("select (select count(*) from public.os_integration_outbox)||':'||(select count(*) from public.os_automation_outbox)")!==outboxBefore)throw new Error("Rollback touched an outbox.");

console.log("Complete intake local Supabase verification passed: exact 24-event source binding, native Builder/Wedding chain linking without overwrite, live-change duplicate stop, atomic rollback, replay idempotency, stable-key chains, financial separation, review-only and pending-unbooked preservation, Owner-only grants, outbox isolation, and reversible before-image restoration.");
