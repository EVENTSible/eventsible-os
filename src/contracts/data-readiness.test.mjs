import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { COMPLETE_INTAKE_SOURCE_BASELINE, completeItemCounts, duplicateWarnings, manifestFileHash, manifestHash, validateCompleteIntakeManifest, validateIntakeManifest } from "../lib/data-readiness.mjs";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const candidate = (overrides = {}) => ({ key: "contact.synthetic-1", type: "contact", sourceHash: "a".repeat(64), sourceRef: "redacted/source-1", uncertainFields: [], data: { displayName: "Synthetic contact", primaryEmail: "person@example.invalid" }, ...overrides });
const manifest = (items = [candidate()]) => ({ contractVersion: "intake_manifest_v1", sourceLabel: "Synthetic contract verification", items });

test("intake_manifest_v1 validates bounded, certain candidate records", () => {
  const valid = validateIntakeManifest(manifest());
  assert.equal(valid.ok, true);
  assert.match(valid.hash, /^[a-f0-9]{64}$/);
  assert.equal(manifestHash({ b: 2, a: 1 }), manifestHash({ a: 1, b: 2 }));

  assert.equal(validateIntakeManifest({ ...manifest(), contractVersion: "future" }).ok, false);
  assert.equal(validateIntakeManifest(manifest([candidate({ uncertainFields: ["primaryEmail"] })])).ok, false);
  assert.equal(validateIntakeManifest(manifest([candidate(), candidate()])).ok, false);
  assert.equal(validateIntakeManifest(manifest([candidate({ sourceHash: "not-a-hash" })])).ok, false);
  assert.equal(validateIntakeManifest(manifest([candidate({ data: { displayName: "No contact channel" } })])).ok, false);
});

test("linked candidates require certain canonical or prior-item references", () => {
  const event = candidate({ key: "event.synthetic-1", type: "event", data: { title: "Synthetic event", eventType: "test" } });
  assert.equal(validateIntakeManifest(manifest([event])).ok, false);
  assert.equal(validateIntakeManifest(manifest([candidate(), { ...event, data: { ...event.data, primaryContactItemKey: "contact.synthetic-1" } }])).ok, true);
  const inquiry = candidate({ key: "inquiry.synthetic-1", type: "inquiry", data: { status: "new", contactItemKey: "contact.synthetic-1", eventItemKey: "event.synthetic-1" } });
  assert.equal(validateIntakeManifest(manifest([candidate(), { ...event, data: { ...event.data, primaryContactItemKey: "contact.synthetic-1" } }, inquiry])).ok, true);
});

test("intake_manifest_v2 binds the exact 24-event source baseline and complete relationship keys", () => {
  const contacts = Array.from({ length: 24 }, (_, index) => ({ key:`contact.complete-${index}`,type:"contact",sourceHash:(index+1).toString(16).padStart(64,"0"),sourceRef:`synthetic/contact-${index}`,uncertainFields:[],data:{displayName:`Synthetic ${index}`,primaryEmail:`complete-${index}@example.invalid`} }));
  const events = contacts.map((contact,index) => ({ key:`event.complete-${index}`,type:"event",sourceHash:(index+101).toString(16).padStart(64,"0"),sourceRef:`synthetic/event-${index}`,uncertainFields:[],data:{primaryContactItemKey:contact.key,title:`Synthetic gig ${index}`,eventType:"test",status:index===22?"inquiry":index===23?"pending":"completed",recordDisposition:index===22?"lower_confidence_review":index===23?"pending_unbooked":"confirmed"} }));
  const items=[...contacts,...events];
  const complete={contractVersion:"intake_manifest_v2",sourceBaselineHash:COMPLETE_INTAKE_SOURCE_BASELINE,sourceLabel:"Synthetic complete importer contract",recordCount:24,itemCounts:completeItemCounts(items),items};
  assert.equal(validateCompleteIntakeManifest(complete).ok,true);
  assert.match(manifestFileHash(JSON.stringify(complete)),/^[a-f0-9]{64}$/);
  assert.equal(validateCompleteIntakeManifest({...complete,recordCount:23}).ok,false);
  const invalidBooking={key:"booking.lower",type:"booking",sourceHash:"f".repeat(64),sourceRef:"synthetic/lower",uncertainFields:[],data:{eventItemKey:"event.complete-22",status:"confirmed",contractStatus:"signed"}};
  const invalidItems=[...items,invalidBooking];
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(invalidItems),items:invalidItems}).ok,false);
  const linkedContact={...contacts[0],data:{...contacts[0].data,recordMode:"link_existing",existingRecordId:"12000000-0000-4000-8000-000000000001",expectedRecordHash:"b".repeat(64),sourcePrecedence:"preserve_existing_native"}};
  const linkedItems=[linkedContact,...contacts.slice(1),...events];
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(linkedItems),items:linkedItems}).ok,true);
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(linkedItems),items:linkedItems.map((item)=>item.key===linkedContact.key?{...item,data:{...item.data,sourcePrecedence:"overwrite_native"}}:item)}).ok,false);
});

test("intake_manifest_v2 permits only bounded contactless operational events", () => {
  const contacts = Array.from({ length: 22 }, (_, index) => ({ key:`contact.operational-${index}`,type:"contact",sourceHash:(index+1).toString(16).padStart(64,"0"),sourceRef:`synthetic/contact-${index}`,uncertainFields:[],data:{displayName:`Synthetic client ${index}`,primaryEmail:`operational-${index}@example.invalid`} }));
  const clientEvents = contacts.map((contact,index) => ({ key:`event.operational-${index}`,type:"event",sourceHash:(index+101).toString(16).padStart(64,"0"),sourceRef:`synthetic/event-${index}`,uncertainFields:[],data:{primaryContactItemKey:contact.key,title:`Synthetic client gig ${index}`,eventType:"test",status:"completed",recordDisposition:"confirmed"} }));
  const vendor = { key:"event.synthetic-vendor",type:"event",sourceHash:"e".repeat(64),sourceRef:"synthetic/vendor",uncertainFields:[],data:{title:"Synthetic vendor appearance",eventType:"vendor_market",status:"completed",recordDisposition:"vendor_appearance"} };
  const community = { key:"event.synthetic-community",type:"event",sourceHash:"d".repeat(64),sourceRef:"synthetic/community",uncertainFields:[],data:{title:"Synthetic community event",eventType:"community_event",status:"active",recordDisposition:"operational_event"} };
  const items = [...contacts,...clientEvents,vendor,community];
  const complete = { contractVersion:"intake_manifest_v2",sourceBaselineHash:COMPLETE_INTAKE_SOURCE_BASELINE,sourceLabel:"Synthetic operational compatibility",recordCount:24,itemCounts:completeItemCounts(items),items };
  assert.equal(validateCompleteIntakeManifest(complete).ok,true);

  const ordinaryWithoutContact = {...vendor,key:"event.misused",data:{...vendor.data,recordDisposition:"confirmed"}};
  const badOrdinaryItems = items.map((item)=>item.key===vendor.key?ordinaryWithoutContact:item);
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(badOrdinaryItems),items:badOrdinaryItems}).ok,false);

  const booking = {key:"booking.synthetic-vendor",type:"booking",sourceHash:"c".repeat(64),sourceRef:"synthetic/vendor-booking",uncertainFields:[],data:{eventItemKey:vendor.key,status:"completed",contractStatus:"signed"}};
  const bookedItems = [...items,booking];
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(bookedItems),items:bookedItems}).ok,false);

  const inquiry = {key:"inquiry.synthetic-community",type:"inquiry",sourceHash:"b".repeat(64),sourceRef:"synthetic/community-inquiry",uncertainFields:[],data:{contactItemKey:contacts[0].key,eventItemKey:community.key,status:"new"}};
  const inquiryItems = [...items,inquiry];
  assert.equal(validateCompleteIntakeManifest({...complete,itemCounts:completeItemCounts(inquiryItems),items:inquiryItems}).ok,false);
});

test("duplicate warnings are advisory and never merge records", () => {
  const warnings = duplicateWarnings(candidate(), { contacts: [{ id: "redacted-contact", primaryEmail: "PERSON@example.invalid", primaryPhone: null }] });
  assert.deepEqual(warnings, [{ kind: "exact_email", recordId: "redacted-contact" }]);
});

test("contactless operational migration preserves Owner-only atomic boundaries", async () => {
  const migration = await read("supabase/migrations/20260915223726_hq_contactless_operational_import.sql");
  assert.match(migration, /recordDisposition' in \('vendor_appearance','operational_event'\)/);
  assert.match(migration, /'contactRelationship',case when v_operational then 'none_operational' end/);
  assert.match(migration, /Contactless operational events cannot become bookings/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /os_has_hq_capability\('data\.readiness\.manage'\)/);
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /revoke all on function public\.os_apply_complete_intake_batch\(uuid,text,integer,jsonb\) from public, anon, authenticated/);
  assert.doesNotMatch(migration, /delete from|service_role key|gigs@gigsalad/i);
});

test("Data Readiness route and actions remain Owner-only and server mediated", async () => {
  const [page, actions, component, authorization] = await Promise.all([
    read("src/app/admin/data-readiness/page.tsx"), read("src/app/admin/data-readiness/actions.ts"),
    read("src/components/data-readiness-workspace.tsx"), read("src/lib/hq-authorization.ts"),
  ]);
  assert.match(page, /hasHqCapability\(role,"data\.readiness\.manage"\)/);
  assert.match(page, /redirect\("\/access-denied"\)/);
  assert.match(page, /os_data_readiness_snapshot/);
  assert.doesNotMatch(page, /\.from\(/);
  assert.match(page, /every write control is disabled/);
  assert.match(actions, /authorizeHqCapability\("data\.readiness\.manage"\)/);
  assert.doesNotMatch(actions + component, /createAdminSupabase|SERVICE_ROLE|SUPABASE_SECRET|\.from\([^)]*\)\.insert/);
  assert.match(authorization, /"data\.readiness\.manage"/);
  assert.match(component, /ARCHIVE BATCH/);
  assert.match(component, /<option key=\{v\} value=\{v\}>\{v\.replace\("_"," "\)\}<\/option>/);
  assert.match(component, /rollbackState\.status!=="idle"\?rollbackState:applyState\.status!=="idle"\?applyState:approveState/);
  assert.doesNotMatch(component, /hard delete|Delete permanently/i);
});

test("Owner-only navigation is omitted from bounded staff shells", async () => {
  const [navigation, shell] = await Promise.all([read("src/lib/hq-navigation.mjs"), read("src/components/hq-shell.tsx")]);
  assert.match(navigation, /id: "data-readiness"[^\n]+ownerOnly: true/);
  assert.match(shell, /!\("ownerOnly" in item\)[^\n]+role === "owner"/);
});

test("migration uses RLS, exact approval, internal identity, bounded grants, and no deletes", async () => {
  const migration = await read("supabase/migrations/20260909042244_hq_data_readiness_foundation.sql");
  assert.match(migration, /alter table public\.os_import_batch_items enable row level security/);
  assert.match(migration, /revoke all on table public\.os_import_batch_items from public, anon, authenticated/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /approved_manifest_hash=p_manifest_hash/);
  assert.match(migration, /item_key=any\(p_item_keys\)/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.os_apply_intake_batch\(uuid,text\) from public, anon, authenticated/);
  assert.match(migration, /status='failed'/);
  assert.match(migration, /status='rolled_back'/);
  assert.match(migration, /status='archived'/);
  assert.match(migration, /case candidate_type when 'contact' then 1 when 'event' then 2 when 'inquiry' then 3 else 4 end/);
  assert.match(migration, /'active'::text as status from public\.os_service_catalog where is_active is true/);
  assert.doesNotMatch(migration, /public\.os_service_catalog where status='active'/);
  assert.doesNotMatch(migration, /delete\s+from|truncate|drop\s+table/i);
  assert.doesNotMatch(migration, /user_metadata|insert into auth\.|update auth\./i);
});

test("complete importer migration is atomic, source-bound, automation-isolated, and reversible", async () => {
  const migration=await read("supabase/migrations/20260915035447_hq_complete_manifest_importer.sql");
  assert.match(migration,/create table public\.os_booking_payment_facts/);
  assert.match(migration,/gross_client_amount numeric\(12,2\)/);
  assert.match(migration,/platform_fee_amount numeric\(12,2\)/);
  assert.match(migration,/net_payout_amount numeric\(12,2\)/);
  assert.match(migration,/create table public\.os_import_source_provenance/);
  assert.match(migration,/p_expected_record_count<>24/);
  assert.match(migration,/c9b2f167f8ea2ac2255e01ba52891a9e23df9f09646918cd8468cc1c22cff643/);
  assert.match(migration,/Production duplicate detection stopped the complete import/);
  assert.match(migration,/recordMode','create'\)='link_existing'/);
  assert.match(migration,/coalesce\(v_data->>'sourcePrecedence',''\)<>'preserve_existing_native'/);
  assert.match(migration,/Native submission or canonical record changed after preview/);
  assert.match(migration,/pg_advisory_xact_lock\(hashtextextended\('eventsible\.complete_intake\.native_compatibility',0\)\)/);
  assert.match(migration,/pg_try_advisory_xact_lock\(hashtextextended\('eventsible\.complete_intake\.native_compatibility',0\)\)/);
  assert.match(migration,/create trigger os_builder_intake_complete_import_serialization/);
  assert.match(migration,/create trigger os_planning_answer_complete_import_serialization/);
  assert.match(migration,/lock table public\.os_bookings, public\.os_builder_intake_requests, public\.os_builder_submissions/);
  assert.match(migration,/linkedExisting/);
  assert.match(migration,/suppressAutomations/);
  assert.match(migration,/status='archived'/);
  assert.match(migration,/status='cancelled'/);
  assert.match(migration,/set search_path = ''/);
  assert.match(migration,/revoke all on function public\.os_apply_complete_intake_batch/);
  assert.doesNotMatch(migration,/delete\s+from|truncate/i);
  assert.doesNotMatch(migration,/insert into auth\.|update auth\.|user_metadata/i);
});

test("complete importer preserves native Wedding Hero and Event Builder records", async () => {
  const [migration,builder,wedding]=await Promise.all([
    read("supabase/migrations/20260915035447_hq_complete_manifest_importer.sql"),
    read("supabase/migrations/20260719053712_fix_event_builder_contact_merge.sql"),
    read("src/app/client/wedding/submission-actions.ts"),
  ]);
  assert.match(builder,/source_session_id[\s\S]+on conflict\(source_session_id\)/);
  assert.match(wedding,/submission_id === request\.submissionId/);
  assert.match(wedding,/os_planning_answers/);
  assert.match(migration,/A reviewed import is being applied; retry the native submission/);
  assert.doesNotMatch(migration,/(update|delete from) public\.os_(builder_submissions|builder_intake_requests|planning_assignments|planning_answers)/i);
  assert.doesNotMatch(migration,/set\s+(raw_payload|normalized_payload|value)\s*=/i);
});

test("verifiers use the canonical migration chain and remain synthetic and isolated", async () => {
  const [history, verifier, browserVerifier, workflow, guard] = await Promise.all([
    read("supabase/migration-history.json"),
    read("scripts/data-readiness-local-supabase-verify.mjs"),
    read("scripts/data-readiness-browser-verify.mjs"),
    read(".github/workflows/ecosystem-integration-local-supabase.yml"),
    read("scripts/guard-local-supabase-ci.mjs"),
  ]);
  assert.match(history, /"canonicalThrough": "20260915035447"/);
  assert.match(history, /"version": "20260909042244"/);
  assert.match(history, /"version": "20260915035447"/);
  assert.match(history, /"version": "20260915223726"/);
  assert.match(verifier, /Refusing to run Data Readiness verification against a remote or Production database/);
  assert.match(verifier, /example\.invalid/);
  assert.match(browserVerifier, /Isolated local Supabase browser-test environment is incomplete/);
  assert.match(browserVerifier, /example\.invalid/);
  assert.match(workflow, /db reset --local/);
  assert.match(workflow, /test:migration-history/);
  assert.doesNotMatch(workflow, /supabase\/local-verification|LOCAL_VERIFICATION_SCHEMA/);
  assert.match(workflow, /test:data-readiness:local-supabase/);
  assert.match(workflow, /db advisors --local --type security/);
  assert.match(workflow, /test:data-readiness:browser/);
  assert.match(guard, /productionMigrationRoot = "supabase\/migrations"/);
  assert.doesNotMatch(verifier + browserVerifier, /gmail\.com|yahoo\.com|hotmail\.com/i);
});
