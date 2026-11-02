import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { buildWeddingOperations, weddingMusicRequests, weddingTaskProposals, weddingTimeline, weddingMusicCsv, weddingScheduleReview } from "../lib/wedding-operations.mjs";
import { publicWeddingDraftCanWrite } from "../lib/wedding-hero-submission.mjs";

const event = { id: "synthetic-event", status: "booked" };
const assignment = { id: "synthetic-plan", event_id: event.id, submitted_at: "2026-10-31T15:00:00Z" };
const answers = { event_date: "2026-11-07", event_date_confirmed: true, first_dance_song: { status: "chosen", songTitle: "Synthetic title", artist: "Synthetic artist", version: "Approved mix", cue: "0:42", fade: "Fade at 2:10" }, reception_timeline: [{ time: "19:00", moment: "Toasts", people: "Synthetic speaker" }, { time: "17:30", moment: "Entrance" }] };

test("operations refuse a different event's answers rather than infer a name/date match", () => {
  assert.throws(() => buildWeddingOperations({ event, assignment: { ...assignment, event_id: "other-event" }, answers }), /linked to this canonical event/);
  assert.throws(() => buildWeddingOperations({ event, assignment: null }), /linked/);
});
test("current-answer manifest is deterministic, changes on edits and does not invent historical revisions", () => {
  const a = buildWeddingOperations({ event, assignment, answers });
  const b = buildWeddingOperations({ event, assignment, answers: Object.fromEntries(Object.entries(answers).reverse()) });
  assert.equal(a.sourceDigest, b.sourceDigest);
  assert.notEqual(a.sourceDigest, buildWeddingOperations({ event, assignment, answers: { ...answers, guest_count: 100 } }).sourceDigest);
  assert.match(a.provenance, /not an immutable answer archive/);
  assert.equal(a.eventId, event.id);
});
test("music retains exact client versions/edits and separates unchosen and do-not-play instructions", () => {
  const rows = weddingMusicRequests({ ...answers, couple_entrance_song: { status: "need_help", songTitle: "Not approved" }, parent_dances: [{ songTitle: "Parent title", artist: "Parent artist", people: "Synthetic family" }], do_not_play_list: [{ songTitle: "Avoid this" }] });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { group: "Reception", moment: "First dance", sourceKey: "first_dance_song", title: "Synthetic title", artist: "Synthetic artist", version: "Approved mix", cue: "0:42", fade: "Fade at 2:10", notes: "", people: "", approval: "CLIENT SELECTED", localAvailability: "NOT VERIFIED" });
  assert.equal(rows[2].approval, "CLIENT DO-NOT-PLAY");
  assert.ok(!rows.some(x => x.title === "Not approved"));
});
test("chronological client clock times survive DST weekend and missing/invalid times stay unknown", () => {
  const rows = weddingTimeline({ ...answers, ceremony_included: false, ceremony_start_time: "15:00", venue_access_time: "25:30", cocktail_hour_included: true, cocktail_hour_start_time: "16:45", cocktail_hour_end_time: "17:30" });
  assert.deepEqual(rows.filter(x => x.time).map(x => x.time), ["16:45", "17:30", "17:30", "19:00"]);
  assert.ok(!rows.some(x => x.moment === "Ceremony start"));
  assert.equal(rows.find(x => x.sourceKey === "venue_access_time").time, null);
  assert.equal(rows.find(x => x.sourceKey === "venue_access_time").submittedTime, "25:30");
  assert.ok(rows.filter(x => !x.time).every(x => x.timeStatus === "NEEDS CONFIRMATION"));
  assert.ok(rows.filter(x => x.time).every(x => /TIMEZONE NEEDS CONFIRMATION/.test(x.timeStatus)));
});
test("schedule review separates Michigan client clock times from signed Central coverage", () => {
  const timeline = weddingTimeline({ cocktail_hour_included: true, cocktail_hour_start_time: "16:45", reception_timeline: [{ time: "17:45", moment: "Entrance" }, { time: "19:10", moment: "Dancing" }] });
  const coverage = { starts_at: "2026-11-08T00:00:00Z", ends_at: "2026-11-08T05:00:00Z", timezone: "America/Chicago" };
  assert.match(weddingScheduleReview(timeline, coverage).reason, /Confirm/);
  const review = weddingScheduleReview(timeline, coverage, "America/Detroit");
  assert.equal(review.status, "PENDING REVIEW");
  assert.deepEqual(review.outside.map(row => row.time), ["16:45", "17:45"]);
  assert.ok(review.outside.every(row => row.position === "BEFORE BOOKED COVERAGE"));
});
test("task suggestions repeat without duplicates and recognize existing stable event keys", () => {
  const services = [{ service_code: "karaoke" }, { service_code: "uplighting" }, { service_code: "selfie_booth_prints" }];
  const first = weddingTaskProposals(event.id, answers, services);
  assert.equal(new Set(first.map(x => x.key)).size, first.length);
  assert.deepEqual(weddingTaskProposals(event.id, answers, services), first);
  const current = weddingTaskProposals(event.id, answers, services, [{ id: "existing-task", metadata: { wedding_operations_key: first[0].key } }]);
  assert.equal(current[0].status, "EXISTING");
  assert.equal(current[0].existingTaskId, "existing-task");
  assert.ok(!weddingTaskProposals("other-event", answers, services).some(x => first.some(y => y.key === x.key)));
});
test("projection does not mutate input, create business records or represent an inquiry as booked", () => {
  const input = { event: { ...event, status: "inquiry" }, assignment, answers };
  const before = JSON.stringify(input);
  const packet = buildWeddingOperations(input);
  assert.equal(JSON.stringify(input), before);
  assert.match(packet.reviewWarnings.join(" "), /inquiry, not a confirmed booking/);
  assert.match(packet.reviewWarnings.join(" "), /Do-not-play/);
  assert.match(packet.reviewWarnings.join(" "), /clean-edit/);
});
test("music CSV quotes multiline data and neutralizes spreadsheet formulas", () => {
  const csv = weddingMusicCsv([{ title: '=HYPERLINK("https://invalid")', artist: 'A, B', notes: "line one\nline two", cue: " @formula" }]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/invalid""\)"/);
  assert.match(csv, /"A, B"/);
  assert.match(csv, /"' @formula"/);
  assert.match(csv, /"line one\nline two"/);
});

test("a public device draft remains limited to its matching public inquiry", () => {
  const own = { source: "wedding_hero_public_submission", status: "inquiry", settings: { public_draft_id: "synthetic-draft" } };
  assert.equal(publicWeddingDraftCanWrite(own, "synthetic-draft"), true);
  for (const candidate of [null, { ...own, status: "booked" }, { ...own, source: "owner_quick_add" }, { ...own, settings: {} }]) assert.equal(publicWeddingDraftCanWrite(candidate, "synthetic-draft"), false);
  assert.equal(publicWeddingDraftCanWrite(own, "other-draft"), false);
});

test("public action delegates all business writes to one RPC and fails closed before notifications", async () => {
  const require = createRequire(import.meta.url);
  const draftId = "11111111-1111-4111-8111-111111111111";
  const code = ts.transpileModule(readFileSync(new URL("../app/client/wedding/submission-actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const response of [{ data: { state: "managed" }, error: null }, { data: null, error: { message: "migration missing" } }]) {
    let writes = 0, sends = 0, calls = 0;
    const exports = {};
    runInNewContext(code, { exports, require: name => {
      if (name === "next/cache") return { revalidatePath: () => { writes++; } };
      if (name === "@/lib/supabase/admin") return { createAdminSupabase: () => ({ rpc: async (name, input) => { calls++; assert.equal(name, "os_submit_public_wedding_hero"); assert.equal(input.p_input.draftId, draftId); return response; }, from: () => { writes++; throw Error("No REST write expected"); } }) };
      if (name === "@/lib/notifications/wedding-hero-email.mjs") return { WEDDING_HERO_SUBMITTED_NOTIFICATION: "submitted", sendWeddingHeroOwnerNotification: () => { sends++; } };
      return require(name.replace("@/lib/", "../lib/"));
    } });
    const result = await exports.submitPublicWeddingHeroPlanAction({ draftId, submissionId: "22222222-2222-4222-8222-222222222222", contactName: "Synthetic contact", email: "synthetic@example.invalid", mode: "form", answers: { partner_one_name: "Synthetic person" } });
    assert.equal(result.ok, false);
    assert.match(result.message, response.error ? /temporarily unavailable/ : /managed privately/);
    assert.equal(calls, 1);
    assert.equal(writes, 0);
    assert.equal(sends, 0);
  }
});
