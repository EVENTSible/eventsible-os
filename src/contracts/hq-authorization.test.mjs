import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { HQ_CAPABILITIES, capabilitiesForRole, hasHqCapability, isStaffRole, staffRole } from "../lib/hq-authorization.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

test("role matrix keeps Owner broad and Manager, Staff, and Host equally bounded", () => {
  for (const capability of HQ_CAPABILITIES) assert.equal(hasHqCapability("owner", capability), true, capability);

  for (const role of ["manager", "staff", "host"]) {
    assert.deepEqual(capabilitiesForRole(role).sort(), [
      "event.notes.write",
      "event.operations.write",
      "hq.read",
      "import.review",
      "schedule.read",
      "schedule.self.manage",
      "task.write",
    ]);
    for (const capability of [
      "lead.lifecycle.manage", "quote.approve", "gig.convert", "client.activate",
      "import.candidate.create", "import.finalize", "catalog.manage",
      "planning.structure.manage", "data.delete", "staff.manage", "system.manage",
    ]) assert.equal(hasHqCapability(role, capability), false, `${role}:${capability}`);
  }
});

test("unknown and user-controlled metadata never become HQ roles", () => {
  assert.equal(staffRole("MANAGER"), "manager");
  assert.equal(staffRole("customer"), null);
  assert.equal(staffRole({ role: "owner" }), null);
  assert.equal(isStaffRole(undefined), false);
});

test("server actions guard every approved mutation with a named capability", async () => {
  const actions = await read("src/app/admin/actions.ts");
  const imports = await read("src/app/admin/imports/actions.ts");
  const actionMatrix = [
    ["updateLeadStatusAction", "lead.lifecycle.manage"],
    ["approveQuoteAction", "quote.approve"],
    ["convertToGigAction", "gig.convert"],
    ["updateOperationalTimingAction", "event.operations.write"],
    ["updateEventDayLogisticsAction", "event.operations.write"],
    ["updateDayOfContactAction", "event.operations.write"],
    ["upsertEventDayNoteAction", "event.notes.write"],
    ["activateWeddingCompanionAction", "client.activate"],
  ];
  for (const [name, capability] of actionMatrix) {
    const start = actions.indexOf(`export async function ${name}`);
    const next = actions.indexOf("export async function ", start + 1);
    const block = actions.slice(start, next < 0 ? undefined : next);
    assert.match(block, new RegExp(`requireActionCapability\\(\\"${capability.replaceAll(".", "\\.")}\\"\\)`), name);
  }
  const importMatrix = [
    ["syncGigSaladCandidatesAction", "import.candidate.create"],
    ["createManualImportCandidateAction", "import.candidate.create"],
    ["reviewImportCandidateAction", "import.review"],
    ["importExistingGigAction", "import.finalize"],
  ];
  for (const [name, capability] of importMatrix) {
    const start = imports.indexOf(`export async function ${name}`);
    const next = imports.indexOf("export async function ", start + 1);
    const block = imports.slice(start, next < 0 ? undefined : next);
    assert.match(block, new RegExp(`requireCapability\\(\\"${capability.replaceAll(".", "\\.")}\\"\\)`), name);
  }
  assert.match(imports, /os_review_event_import_candidate/);
  assert.match(imports, /os_finalize_existing_gig_import/);

  const calendarActions = await read("src/app/admin/calendar/actions.ts");
  assert.match(calendarActions, /authorized\("schedule\.self\.manage"\)/);
  assert.match(calendarActions, /authorized\("schedule\.assignments\.manage"\)/);
  assert.match(calendarActions, /authorized\("schedule\.team\.manage"\)/);
  assert.match(calendarActions, /os_upsert_team_availability/);
  assert.match(calendarActions, /os_manage_staff_assignment/);
});

test("unauthorized authenticated users get a stable access-denied route and logout", async () => {
  const [login, layout, denied, form] = await Promise.all([
    read("src/app/login/page.tsx"),
    read("src/app/admin/layout.tsx"),
    read("src/app/access-denied/page.tsx"),
    read("src/components/login-form.tsx"),
  ]);
  assert.match(login, /isStaffRole\(data\.user\.app_metadata\?\.role\) \? "\/admin" : "\/access-denied"/);
  assert.match(layout, /redirect\("\/access-denied"\)/);
  assert.match(denied, /HQ access has not been assigned/);
  assert.match(denied, /<LogoutButton \/>/);
  assert.doesNotMatch(denied, /user_metadata/);
  assert.match(form, /If this address is approved/);
  assert.doesNotMatch(form, /error instanceof Error|error\.message/);
});

test("database migration uses app_metadata, restrictive boundaries, and fixed RPCs", async () => {
  const migration = await read("supabase/migrations/20260907215620_hq_manager_authorization_boundary.sql");
  assert.match(migration, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/);
  assert.doesNotMatch(migration, /user_metadata/);
  assert.match(migration, /as restrictive for delete/);
  assert.match(migration, /public\.os_has_hq_capability\(''data\.delete''\)/);
  assert.match(migration, /public\.os_has_hq_capability\('task\.write'\)/);
  assert.match(migration, /'os_service_catalog', 'os_tasks',\s*'os_leads'/);
  assert.match(migration, /'os_service_catalog', 'os_leads'/);
  assert.match(migration, /os_owner_bootstrap_owner_read_boundary/);
  assert.match(migration, /create or replace function public\.os_review_event_import_candidate\(/);
  assert.match(migration, /create or replace function public\.os_finalize_existing_gig_import\(/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.os_import_existing_gig\(uuid\) from authenticated/);
  assert.match(migration, /revoke all on function public\.os_staff_role\(\) from public, anon/);
  assert.match(migration, /revoke all on function public\.os_has_hq_capability\(text\) from public, anon/);
  assert.match(migration, /revoke all on function public\.os_is_owner\(\) from public, anon/);
  assert.doesNotMatch(migration, /grant execute on function public\.os_(?:staff_role|has_hq_capability|is_owner)[^;]*to anon/);
  assert.doesNotMatch(migration, /insert into auth\.|update auth\.|delete from auth\./i);
});

test("CI-local schema provides every pre-migration authorization policy target without data", async () => {
  const foundation = await read("supabase/local-verification/20260731000000_ecosystem_integration_local_foundation.sql");
  const stubBlock = foundation.match(
    /-- BEGIN HQ AUTHORIZATION CI TABLE STUBS([\s\S]*?)-- END HQ AUTHORIZATION CI TABLE STUBS/,
  )?.[1] ?? "";
  const expectedStubs = [
    "os_booking_services", "os_builder_intake_requests", "os_contact_users",
    "os_event_facts", "os_event_members", "os_event_notes",
    "os_event_page_messages", "os_event_page_modules", "os_event_pages",
    "os_files", "os_import_batches", "os_message_threads", "os_messages",
    "os_owner_bootstrap_state", "os_planning_answers", "os_planning_assignments",
    "os_planning_questions", "os_planning_sections", "os_planning_templates",
    "os_profiles", "os_rsvps", "os_service_catalog", "os_tasks",
  ];

  assert.ok(stubBlock, "marked CI-only authorization fixture block is required");
  for (const table of expectedStubs) assert.match(stubBlock, new RegExp(`'${table}'`), table);
  assert.match(stubBlock, /create table if not exists public\.%I \(id uuid primary key default gen_random_uuid\(\)\)/);
  assert.match(stubBlock, /alter table public\.%I enable row level security/);
  assert.match(stubBlock, /revoke all on public\.%I from anon, authenticated/);
  assert.match(stubBlock, /grant all on public\.%I to service_role/);
  assert.doesNotMatch(stubBlock, /\b(?:insert|update|delete)\b[\s\S]*\b(?:into|from|public\.)\b/i);
});

test("the administrative Supabase client is explicitly server-only", async () => {
  const [adminClient, config] = await Promise.all([
    read("src/lib/supabase/admin.ts"),
    read("src/lib/supabase/config.ts"),
  ]);
  assert.match(adminClient, /^import "server-only";/);
  assert.match(adminClient, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(adminClient, /NEXT_PUBLIC_|VITE_/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_URL \?\?/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \?\?/);
  assert.doesNotMatch(config, /SERVICE_ROLE|SECRET_KEY/);
});

test("non-owner UI omits commercial and provisioning controls", async () => {
  const [page, imports] = await Promise.all([
    read("src/app/admin/page.tsx"),
    read("src/components/existing-gig-import-review.tsx"),
  ]);
  assert.match(page, /canManageLeads \? <LeadStatusForm/);
  assert.match(page, /canApproveQuotes \? <QuoteActionForms/);
  assert.match(page, /canActivateClients/);
  assert.match(page, /Owner approval required/);
  assert.match(imports, /canCreateCandidates/);
  assert.match(imports, /canFinalizeImports/);
});
