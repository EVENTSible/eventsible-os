import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EVENT_DAY_NOTE_BODY_LIMIT,
  eventDayNoteRpcArgs,
  eventDayNoteRpcError,
  normalizeEventDayNoteBody,
} from "../lib/event-day-notes.mjs";

const EVENT_ID = "00000000-0000-4000-8000-000000000401";
const NOTE_ID = "00000000-0000-4000-8000-000000000402";
const MIGRATION = new URL("../../supabase/migrations/20260902050555_event_day_notes_rpc.sql", import.meta.url);

test("event-day note input is trimmed and bounded", () => {
  assert.equal(EVENT_DAY_NOTE_BODY_LIMIT, 1500);
  assert.equal(normalizeEventDayNoteBody("  Use west dock.  "), "Use west dock.");
  assert.deepEqual(eventDayNoteRpcArgs({ eventId: EVENT_ID, body: "  Use west dock.  ", isPinned: true }), {
    p_event_id: EVENT_ID,
    p_note_id: null,
    p_body: "Use west dock.",
    p_is_pinned: true,
  });
  assert.throws(() => eventDayNoteRpcArgs({ eventId: EVENT_ID, body: "   ", isPinned: false }), /1 to 1,500/i);
  assert.throws(() => eventDayNoteRpcArgs({ eventId: EVENT_ID, body: "x".repeat(1501), isPinned: false }), /1 to 1,500/i);
});

test("RPC arguments accept only canonical event and optional note IDs", () => {
  assert.deepEqual(eventDayNoteRpcArgs({ eventId: EVENT_ID, noteId: NOTE_ID, body: "Backup mic ready", isPinned: "true" }), {
    p_event_id: EVENT_ID,
    p_note_id: NOTE_ID,
    p_body: "Backup mic ready",
    p_is_pinned: true,
  });
  assert.throws(() => eventDayNoteRpcArgs({ eventId: "bad-event", body: "Note", isPinned: false }), /canonical event/i);
  assert.throws(() => eventDayNoteRpcArgs({ eventId: EVENT_ID, noteId: "bad-note", body: "Note", isPinned: false }), /canonical event/i);
});

test("RPC errors map to controlled non-sensitive messages", () => {
  assert.match(eventDayNoteRpcError({ code: "28000" }), /not authorized/i);
  assert.match(eventDayNoteRpcError({ code: "42501" }), /not authorized/i);
  assert.match(eventDayNoteRpcError({ code: "22023" }), /check the event-day note/i);
  assert.match(eventDayNoteRpcError({ code: "P0002" }), /could not be found/i);
  assert.match(eventDayNoteRpcError({ code: "XX000" }), /nothing was changed/i);
});

test("migration is function-only with a fixed signature and least-privilege grant", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /create function public\.os_upsert_event_day_note\(\s*p_event_id uuid,\s*p_note_id uuid,\s*p_body text,\s*p_is_pinned boolean\s*\)/i);
  assert.match(sql, /security definer[^]*set search_path = ''/i);
  assert.match(sql, /revoke all on function[^]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[^]*to authenticated/i);
  assert.doesNotMatch(sql, /\b(create|alter|drop)\s+(table|policy|index|trigger)\b|\b(delete from|truncate)\b|grant\s+(insert|update|delete)/i);
});

test("migration enforces authenticated staff and event access with internal actor identity", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /v_actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(sql, /v_actor_user_id is null[^]*28000/i);
  assert.match(sql, /public\.os_is_staff\(\)/i);
  assert.match(sql, /public\.os_has_event_access\(p_event_id\)/i);
  assert.match(sql, /from public\.os_events[^]*where id = p_event_id[^]*for update/i);
  assert.doesNotMatch(sql, /p_actor|p_author|p_visibility|p_status|p_note_type|p_activity|p_payload/i);
});

test("create forces canonical event-day staff semantics and one focused activity", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /insert into public\.os_event_notes[^]*'event_day'[^]*v_body[^]*p_is_pinned[^]*'staff'[^]*'active'/i);
  assert.match(sql, /author_user_id[^]*v_actor_user_id/i);
  assert.equal((sql.match(/insert into public\.os_activity_events/gi) ?? []).length, 1);
  assert.match(sql, /event\.event_day_note_created/i);
  assert.match(sql, /event\.event_day_note_updated/i);
  const activityInsert = sql.slice(sql.indexOf("insert into public.os_activity_events"), sql.indexOf("return jsonb_build_object", sql.indexOf("insert into public.os_activity_events")));
  assert.doesNotMatch(activityInsert, /'body'|v_body/i);
});

test("update locks and verifies the event-scoped active staff event-day note", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /from public\.os_event_notes[^]*where id = p_note_id[^]*for update/i);
  assert.match(sql, /v_current_event_id <> p_event_id/i);
  assert.match(sql, /v_current_note_type <> 'event_day'/i);
  assert.match(sql, /v_current_visibility <> 'staff'/i);
  assert.match(sql, /v_current_status <> 'active'/i);
  assert.match(sql, /update public\.os_event_notes\s+set body = v_body,\s*is_pinned = p_is_pinned\s+where id = p_note_id/i);
  assert.doesNotMatch(sql, /set[^;]*(event_id|author_user_id|note_type|visibility|status)\s*=/i);
});

test("no-op returns before note and activity writes", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const noop = sql.indexOf("v_current_body = v_body and v_current_is_pinned = p_is_pinned");
  const update = sql.indexOf("update public.os_event_notes");
  const activity = sql.indexOf("insert into public.os_activity_events");
  assert.ok(noop > -1 && noop < update && update < activity);
  assert.match(sql, /'status', 'noop'/i);
});

test("Server Action validates and uses only the authenticated fixed RPC", async () => {
  const source = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const action = source.slice(source.indexOf("export async function upsertEventDayNoteAction"), source.indexOf("export async function activateWeddingCompanionAction"));
  assert.match(action, /EVENT_DAY_NOTE_BODY_LIMIT/);
  assert.match(action, /eventDayNoteRpcArgs/);
  assert.match(action, /requireStaffSupabase\(\)/);
  assert.match(action, /supabase\.rpc\("os_upsert_event_day_note", rpcArgs\)/);
  assert.match(action, /eventDayNoteRpcError/);
  assert.match(action, /revalidatePath\(`\/admin\/gigs\/\$\{eventId\}`\)/);
  assert.doesNotMatch(action, /createAdminSupabase|SUPABASE_SERVICE_ROLE_KEY|recordActivity\(|\.from\("os_event_notes"\)\.(insert|update)/s);
});

test("protected reader is event-scoped, staff-only, active event-day, and pinned-first", async () => {
  const source = await readFile(new URL("../app/admin/gigs/[eventId]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!authData\.user\) redirect\("\/login"\)/);
  assert.match(source, /if \(!isStaffRole/);
  const query = source.match(/supabase\.from\("os_event_notes"\)[^\n]+/)?.[0] ?? "";
  assert.match(query, /select\("id,body,is_pinned,created_at,updated_at"\)/);
  assert.match(query, /eq\("event_id", eventId\)/);
  assert.match(query, /eq\("note_type", "event_day"\)/);
  assert.match(query, /eq\("status", "active"\)/);
  assert.match(query, /eq\("visibility", "staff"\)/);
  assert.match(query, /order\("is_pinned", \{ ascending: false \}\).*order\("created_at", \{ ascending: false \}\)/);
});

test("editor supports add, edit, local pin toggle, Save, and Cancel without delete or archive", async () => {
  const source = await readFile(new URL("../components/event-day-notes-editor.tsx", import.meta.url), "utf8");
  assert.match(source, /Add Note/);
  assert.match(source, /Edit/);
  assert.match(source, /Pin note/);
  assert.match(source, /Unpin note/);
  assert.match(source, /Save note/);
  assert.match(source, /Cancel/);
  assert.match(source, /maxLength=\{EVENT_DAY_NOTE_BODY_LIMIT\}/);
  assert.match(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, />Delete<|>Archive<|name="(visibility|note_type|status)"|dangerouslySetInnerHTML/i);
});

test("event-day notes do not alter readiness helpers", async () => {
  const readiness = await readFile(new URL("../lib/gig-readiness.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(readiness, /os_event_notes|eventDayNotes|event-day note/i);
  const page = await readFile(new URL("../app/admin/gigs/[eventId]/page.tsx", import.meta.url), "utf8");
  const readinessCall = page.match(/buildGigReadiness\([^;]+/)?.[0] ?? "";
  assert.doesNotMatch(readinessCall, /notesResult|eventDayNotes/);
});
