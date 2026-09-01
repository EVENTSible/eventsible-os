import assert from "node:assert/strict";
import test from "node:test";
import { buildGigReadiness, extractOperationalDetails, READINESS_STATES } from "../lib/gig-readiness.mjs";

test("unknown operational systems never count as ready", () => {
  const result = buildGigReadiness({ event: {}, now: new Date("2026-09-01T12:00:00Z") });
  assert.equal(result.ready.length, 0);
  assert.equal(result.checks.find((check) => check.id === "staffing").state, READINESS_STATES.UNKNOWN);
  assert.equal(result.checks.find((check) => check.id === "equipment").state, READINESS_STATES.UNKNOWN);
  assert.equal(result.checks.find((check) => check.id === "tasks").state, READINESS_STATES.UNKNOWN);
});

test("readiness identifies critical schedule, venue, and overdue task gaps", () => {
  const result = buildGigReadiness({
    event: { starts_at: null },
    contact: { id: "contact-1", primary_email: "qa@example.invalid", preferred_channel: "email" },
    booking: { payment_status: "deposit_due", balance_due: 250, balance_due_at: "2026-08-30T12:00:00Z", contract_status: "sent" },
    services: [{ id: "service-1" }],
    tasks: [{ id: "task-1", status: "open", due_at: "2026-08-29T12:00:00Z" }],
    now: new Date("2026-09-01T12:00:00Z"),
  });
  assert.deepEqual(result.critical.map((check) => check.id), ["event-start", "venue", "tasks", "money"]);
  assert.equal(result.attention.some((check) => check.id === "contract"), true);
});

test("money respects a future due date instead of blocking readiness", () => {
  const result = buildGigReadiness({
    event: { starts_at: "2026-09-20T18:00:00Z", ends_at: "2026-09-20T22:00:00Z", venue_name: "QA Hall", venue_address_1: "100 Test Way", venue_city: "South Bend" },
    contact: { id: "contact-1", primary_phone: "5555550100", preferred_channel: "text" },
    booking: { payment_status: "balance_due", balance_due: 500, balance_due_at: "2026-09-20T18:00:00Z", contract_status: "signed" },
    services: [{ id: "service-1" }],
    tasks: [{ id: "task-1", status: "completed" }],
    files: [{ id: "file-1" }],
    planning: { status: "submitted" },
    now: new Date("2026-09-01T12:00:00Z"),
  });
  assert.equal(result.checks.find((check) => check.id === "money").state, READINESS_STATES.NEEDS_ATTENTION);
  assert.equal(result.checks.find((check) => check.id === "contract").state, READINESS_STATES.READY);
  assert.equal(result.critical.length, 0);
});

test("missing balance is unknown rather than ready", () => {
  const result = buildGigReadiness({ booking: { payment_status: "unpaid", contract_status: "not_sent" } });
  assert.equal(result.checks.find((check) => check.id === "money").state, READINESS_STATES.UNKNOWN);
});

test("operational extraction uses only explicit allow-listed fields", () => {
  const details = extractOperationalDetails({
    event: { settings: { arrival_time: "3:30 PM", secret_payload: "never render" } },
    contact: { metadata: { day_of_contact_name: "QA Coordinator" } },
    booking: { metadata: { load_in_window: "3:00–4:00 PM" } },
    facts: [{ fact_key: "experience.goal", value: "Keep guests engaged" }, { fact_key: "builder.full_submission", value: { private: true } }],
  });
  assert.equal(details.arrivalTime, "3:30 PM");
  assert.equal(details.dayOfContact, "QA Coordinator");
  assert.equal(details.experienceGoal, "Keep guests engaged");
  assert.equal(JSON.stringify(details).includes("never render"), false);
  assert.equal(JSON.stringify(details).includes("private"), false);
});
