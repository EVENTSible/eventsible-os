import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (path) => fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const migration = read("../../supabase/migrations/20260917210520_hq_owner_quick_add.sql");
const actions = read("../app/admin/quick-add/actions.ts");
const page = read("../app/admin/quick-add/page.tsx");
const workspace = read("../components/quick-add-workspace.tsx");
const mission = read("../app/admin/page.tsx");

test("Quick Add is a prominent Owner-only ordinary-entry surface", () => {
  assert.match(mission, /href="\/admin\/quick-add">\+ Add/);
  assert.match(mission, /Add Contact/);
  assert.match(mission, /Add Lead/);
  assert.match(mission, /Add Gig/);
  assert.match(page, /authorizeHqCapability\("data\.readiness\.manage"\)/);
  assert.match(workspace, /Contact[\s\S]+Lead[\s\S]+Gig \/ Event[\s\S]+Booking[\s\S]+Note/);
  assert.doesNotMatch(workspace, /manifest|fingerprint|staged batch|compensation/i);
});

test("server action validates the signed-in Owner and writes through one bounded RPC", () => {
  assert.match(actions, /authorizeHqCapability\("data\.readiness\.manage"\)/);
  assert.match(actions, /supabase\.rpc\("os_owner_quick_add"/);
  assert.doesNotMatch(actions, /createAdminSupabase|SERVICE_ROLE|NEXT_PUBLIC_.*SECRET|actor_user_id/);
  assert.match(actions, /revalidatePath\("\/admin"\)/);
  assert.match(actions, /revalidatePath\("\/admin\/calendar"\)/);
});

test("database boundary is Owner-only, atomic, explicit, and provenance preserving", () => {
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /os_has_hq_capability\('data\.readiness\.manage'\)/);
  assert.match(migration, /revoke all on function public\.os_owner_quick_add\(text,jsonb,boolean\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.os_owner_quick_add\(text,jsonb,boolean\) to authenticated, service_role/i);
  assert.match(migration, /public\.os_manage_contact\('create'/);
  assert.match(migration, /owner_truth\.(lead|event|booking|note)_/);
  assert.doesNotMatch(migration, /delete from|truncate|auth\.users|os_team_members/);
});

test("duplicate, date-only, booking, and note semantics retain unknown facts", () => {
  assert.match(migration, /status','duplicate_warning'/);
  assert.match(migration, /status <> 'archived'/);
  assert.match(migration, /historical_date/);
  assert.match(migration, /Date-only events cannot include a time or timezone/);
  assert.match(migration, /v_total,null,null/);
  assert.match(migration, /'paymentStatusKnown',nullif\(p_payload->>'paymentStatus',''\) is not null/);
  assert.match(migration, /else 'unknown' end/);
  assert.match(migration, /payment_status in \('unknown','unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded'\)/);
  assert.match(migration, /public\.os_event_notes/);
  assert.match(migration, /public\.os_activity_events/);
  assert.match(workspace, /Zero services is valid/);
  assert.match(workspace, /HQ will not invent midnight or a timezone/);
});

test("Quick Add keeps specialist and Warren workflows outside normal entry", () => {
  assert.doesNotMatch(actions + workspace + page + migration, /os_(?:preview|apply|compensate)_warren|vera_warren|Warren/);
  assert.doesNotMatch(migration, /os_import_batches|os_import_batch_items|os_event_import_candidates/);
});
