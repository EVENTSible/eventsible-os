import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { eventDateLabel, eventLocalDateTimeInput, eventTimeLabel, eventWhenLabel } from "../lib/event-time.mjs";

const migration=readFileSync("supabase/migrations/20260917032706_hq_vera_warren_bounded_correction.sql","utf8");

test("event displays use the stored event timezone, not the browser timezone",()=>{
  assert.equal(eventTimeLabel("2026-08-22T23:00:00.000Z","America/Chicago"),"6:00 PM CDT");
  assert.equal(eventTimeLabel("2026-08-23T03:30:00.000Z","America/Chicago"),"10:30 PM CDT");
  assert.equal(eventLocalDateTimeInput("2026-08-22T23:00:00.000Z","America/Chicago"),"2026-08-22T18:00");
  assert.match(eventDateLabel("2026-08-22T23:00:00.000Z","America/Chicago"),/August 22, 2026/);
  assert.equal(eventWhenLabel({historical_date:"2027-06-12",starts_at:null,timezone:null}),"2027-06-12 · Time not provided");
});

test("bounded correction pins the exact chain and preserves audit history",()=>{
  for(const id of [
    "4c277aa1-fbcd-4422-ba6b-7ce294a32ea5","95b7bf33-f26d-485e-be03-b4fe67ddf0ef","173b88a0-c451-4dc3-a1d9-79b6aaf91ae8","f179beac-b1e3-4cf6-a5d8-6e6edab1db80","b5bf5927-f0d1-459a-a17e-93f886d7c2f7","1a3ea9b8-ef94-44b6-8463-981b9abd8371","62421a88-2c6f-4e04-8ec9-5f15047b36b9","5dfdb5ee-3436-4b12-9c58-edf47b98924e","7244fb1e-4896-44b4-858f-9dfeee6b4b25","d4549943-7e9b-40eb-9ffb-888d75ed62a2","4beb47eb-3087-4e51-9fda-ddb2eaa84893",
  ]) assert.match(migration,new RegExp(id));
  assert.match(migration,/70th Birthday Celebration/);
  assert.match(migration,/Vera service agreement/);
  assert.match(migration,/review_status='ignored'/);
  assert.doesNotMatch(migration,/delete\s+from/i);
  assert.doesNotMatch(migration,/os_(integration|automation)_outbox\s+(set|values)/i);
});

test("correction boundary is Owner-only and Warren remains noncanonical",()=>{
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/os_has_hq_capability\('data\.readiness\.manage'\)/);
  assert.match(migration,/security definer[\s\S]*set search_path = ''/i);
  assert.match(migration,/revoke all on function public\.os_apply_vera_warren_correction\(text,text\) from public, anon, authenticated/);
  assert.match(migration,/Warren’s 70th Birthday/);
  assert.match(migration,/'contact',null/);
  assert.match(migration,/'services','\[\]'::jsonb/);
  assert.match(migration,/'financial_facts',null/);
  assert.doesNotMatch(migration,/insert into public\.os_(contacts|leads|events|bookings|booking_services|booking_payment_facts|staff_assignments)/i);
});
