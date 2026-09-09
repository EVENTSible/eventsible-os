import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { duplicateWarnings, manifestHash, validateIntakeManifest } from "../lib/data-readiness.mjs";

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

test("duplicate warnings are advisory and never merge records", () => {
  const warnings = duplicateWarnings(candidate(), { contacts: [{ id: "redacted-contact", primaryEmail: "PERSON@example.invalid", primaryPhone: null }] });
  assert.deepEqual(warnings, [{ kind: "exact_email", recordId: "redacted-contact" }]);
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
  assert.doesNotMatch(migration, /delete\s+from|truncate|drop\s+table/i);
  assert.doesNotMatch(migration, /user_metadata|insert into auth\.|update auth\./i);
});

test("local fixture and verifiers are synthetic, isolated, and excluded from Production migrations", async () => {
  const [fixture, verifier, browserVerifier, workflow, guard] = await Promise.all([
    read("supabase/local-verification/20260731000000_ecosystem_integration_local_foundation.sql"),
    read("scripts/data-readiness-local-supabase-verify.mjs"),
    read("scripts/data-readiness-browser-verify.mjs"),
    read(".github/workflows/ecosystem-integration-local-supabase.yml"),
    read("scripts/guard-local-supabase-ci.mjs"),
  ]);
  assert.match(fixture, /BEGIN DATA READINESS CI COLUMN FIXTURES/);
  assert.match(fixture, /never part of a Production migration or deployment/);
  assert.match(fixture, /contains no user, customer, or event fixture rows/);
  assert.match(verifier, /Refusing to run Data Readiness verification against a remote or Production database/);
  assert.match(verifier, /example\.invalid/);
  assert.match(browserVerifier, /Isolated local Supabase browser-test environment is incomplete/);
  assert.match(browserVerifier, /example\.invalid/);
  assert.match(workflow, /LOCAL_VERIFICATION_SCHEMA: supabase\/local-verification\//);
  assert.match(workflow, /test:data-readiness:local-supabase/);
  assert.match(workflow, /db advisors --local --type security/);
  assert.match(workflow, /test:data-readiness:browser/);
  assert.match(guard, /productionMigrationRoot = "supabase\/migrations"/);
  assert.doesNotMatch(verifier + browserVerifier, /gmail\.com|yahoo\.com|hotmail\.com/i);
});
