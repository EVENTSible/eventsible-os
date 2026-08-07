import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationKey } from "./builder-lead-email.mjs";
import {
  classifyNotificationCandidate,
  collectActionableNotificationCandidates,
} from "./builder-lead-queue.mjs";

const now = new Date("2026-08-07T16:00:00.000Z");

function outboxEvent(index, overrides = {}) {
  const builderSubmissionId = overrides.builderSubmissionId || `submission-${index}`;
  return {
    id: `outbox-${String(index).padStart(2, "0")}`,
    created_at: new Date(now.getTime() + index * 1000).toISOString(),
    related_record_ids: builderSubmissionId ? { builder_submission_id: builderSubmissionId } : {},
    status: "pending",
    ...overrides,
  };
}

function deliveryFor(builderSubmissionId, status, overrides = {}) {
  return {
    notification_key: createNotificationKey(builderSubmissionId),
    status,
    attempt_count: 1,
    max_attempts: 5,
    next_attempt_at: null,
    ...overrides,
  };
}

async function select({ events, deliveries = [], limit, batchSize = 2 }) {
  const calls = { outbox: 0, delivery: 0 };
  const result = await collectActionableNotificationCandidates({
    limit,
    batchSize,
    now,
    fetchOutboxBatch: async ({ offset, limit: batchLimit }) => {
      calls.outbox += 1;
      return events.slice(offset, offset + batchLimit);
    },
    fetchDeliveriesByNotificationKeys: async (notificationKeys) => {
      calls.delivery += 1;
      const keySet = new Set(notificationKeys);
      return deliveries.filter((delivery) => keySet.has(delivery.notification_key));
    },
  });
  return { ...result, calls };
}

function actionableIds(selection) {
  return selection.actionable.map((candidate) => candidate.outboxEvent.id);
}

test("oldest dry-run delivery does not consume a limit of one", async () => {
  const events = [outboxEvent(1), outboxEvent(2)];
  const deliveries = [deliveryFor("submission-1", "dry_run")];

  const selection = await select({ events, deliveries, limit: 1 });

  assert.deepEqual(actionableIds(selection), ["outbox-02"]);
  assert.equal(selection.scanned, 2);
  assert.equal(selection.skipped, 1);
});

test("oldest sent delivery does not consume a limit of one", async () => {
  const events = [outboxEvent(1), outboxEvent(2)];
  const deliveries = [deliveryFor("submission-1", "sent")];

  const selection = await select({ events, deliveries, limit: 1 });

  assert.deepEqual(actionableIds(selection), ["outbox-02"]);
  assert.equal(selection.skippedResults[0].status, "skipped");
});

test("several terminal deliveries are scanned until the next actionable event", async () => {
  const events = [outboxEvent(1), outboxEvent(2), outboxEvent(3), outboxEvent(4)];
  const deliveries = [
    deliveryFor("submission-1", "dry_run"),
    deliveryFor("submission-2", "sent"),
    deliveryFor("submission-3", "failed"),
  ];

  const selection = await select({ events, deliveries, limit: 1, batchSize: 2 });

  assert.deepEqual(actionableIds(selection), ["outbox-04"]);
  assert.equal(selection.scanned, 4);
  assert.equal(selection.skipped, 3);
  assert.equal(selection.calls.delivery, 2);
});

test("limit two processes exactly the first two actionable events after terminal rows", async () => {
  const events = [outboxEvent(1), outboxEvent(2), outboxEvent(3), outboxEvent(4)];
  const deliveries = [deliveryFor("submission-1", "dry_run"), deliveryFor("submission-2", "sent")];

  const selection = await select({ events, deliveries, limit: 2, batchSize: 3 });

  assert.deepEqual(actionableIds(selection), ["outbox-03", "outbox-04"]);
  assert.equal(selection.scanned, 4);
});

test("future retry-scheduled delivery does not consume the actionable limit", async () => {
  const events = [outboxEvent(1), outboxEvent(2)];
  const deliveries = [
    deliveryFor("submission-1", "retry", {
      attempt_count: 2,
      next_attempt_at: new Date(now.getTime() + 60_000).toISOString(),
    }),
  ];

  const selection = await select({ events, deliveries, limit: 1 });

  assert.deepEqual(actionableIds(selection), ["outbox-02"]);
  assert.equal(selection.skippedResults[0].status, "retry_scheduled");
});

test("due retry delivery is actionable", async () => {
  const events = [outboxEvent(1), outboxEvent(2)];
  const dueDelivery = deliveryFor("submission-1", "retry", {
    attempt_count: 2,
    next_attempt_at: new Date(now.getTime() - 60_000).toISOString(),
  });

  const selection = await select({ events, deliveries: [dueDelivery], limit: 1 });

  assert.deepEqual(actionableIds(selection), ["outbox-01"]);
  assert.equal(selection.actionable[0].existingDelivery, dueDelivery);
});

test("final failed delivery does not block later actionable events", async () => {
  const events = [outboxEvent(1), outboxEvent(2)];
  const deliveries = [deliveryFor("submission-1", "failed", { attempt_count: 5, max_attempts: 5 })];

  const selection = await select({ events, deliveries, limit: 1 });

  assert.deepEqual(actionableIds(selection), ["outbox-02"]);
  assert.equal(selection.skippedResults[0].status, "failed");
});

test("oldest actionable ordering is preserved after skipped rows", async () => {
  const events = [outboxEvent(1), outboxEvent(2), outboxEvent(3), outboxEvent(4)];
  const deliveries = [deliveryFor("submission-1", "sent")];

  const selection = await select({ events, deliveries, limit: 3 });

  assert.deepEqual(actionableIds(selection), ["outbox-02", "outbox-03", "outbox-04"]);
});

test("duplicate notification keys are not created during batch delivery lookup", async () => {
  const events = [
    outboxEvent(1, { builderSubmissionId: "same-submission" }),
    outboxEvent(2, { builderSubmissionId: "same-submission" }),
    outboxEvent(3),
  ];
  const seenKeySets = [];

  const selection = await collectActionableNotificationCandidates({
    limit: 1,
    batchSize: 2,
    now,
    fetchOutboxBatch: async ({ offset, limit: batchLimit }) => events.slice(offset, offset + batchLimit),
    fetchDeliveriesByNotificationKeys: async (notificationKeys) => {
      seenKeySets.push(notificationKeys);
      return [deliveryFor("same-submission", "sent")];
    },
  });

  assert.deepEqual(seenKeySets[0], [createNotificationKey("same-submission")]);
  assert.deepEqual(actionableIds(selection), ["outbox-03"]);
});

test("candidate classification does not mutate outbox rows", () => {
  const event = outboxEvent(1);
  const before = JSON.stringify(event);

  classifyNotificationCandidate({ outboxEvent: event, existingDelivery: null, now });

  assert.equal(JSON.stringify(event), before);
});
test("duplicate actionable notification keys are selected only once per worker call", async () => {
  const events = [
    outboxEvent(1, { builderSubmissionId: "same-submission" }),
    outboxEvent(2, { builderSubmissionId: "same-submission" }),
    outboxEvent(3, { builderSubmissionId: "different-submission" }),
  ];

  const selection = await select({ events, limit: 2, batchSize: 3 });

  assert.deepEqual(actionableIds(selection), ["outbox-01", "outbox-03"]);
  assert.deepEqual(
    selection.actionable.map((candidate) => candidate.notificationKey),
    [createNotificationKey("same-submission"), createNotificationKey("different-submission")],
  );
  assert.equal(selection.skippedResults[0].reason, "duplicate notification key in current worker selection");
});
