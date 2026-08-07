import { createNotificationKey } from "./builder-lead-email.mjs";

const TERMINAL_DELIVERY_STATUSES = new Set(["sent", "dry_run", "failed"]);

export function resolveBuilderSubmissionId(outboxEvent) {
  return outboxEvent?.related_record_ids?.builder_submission_id || null;
}

export function classifyNotificationCandidate({ outboxEvent, existingDelivery, now = new Date() }) {
  const builderSubmissionId = resolveBuilderSubmissionId(outboxEvent);
  if (!builderSubmissionId) {
    return {
      actionable: false,
      status: "skipped",
      reason: "missing builder_submission_id",
      notificationKey: null,
    };
  }

  const notificationKey = createNotificationKey(builderSubmissionId);
  const status = existingDelivery?.status;

  if (TERMINAL_DELIVERY_STATUSES.has(status)) {
    return {
      actionable: false,
      status: status === "failed" ? "failed" : "skipped",
      reason: `terminal delivery status: ${status}`,
      notificationKey,
    };
  }

  if (existingDelivery?.next_attempt_at) {
    const nextAttemptAt = new Date(existingDelivery.next_attempt_at).getTime();
    if (Number.isFinite(nextAttemptAt) && nextAttemptAt > now.getTime()) {
      return {
        actionable: false,
        status: "retry_scheduled",
        reason: "retry is not due",
        notificationKey,
      };
    }
  }

  return {
    actionable: true,
    status: existingDelivery ? "retry_due" : "pending",
    reason: null,
    notificationKey,
  };
}

export async function collectActionableNotificationCandidates({
  fetchOutboxBatch,
  fetchDeliveriesByNotificationKeys,
  limit,
  batchSize = 25,
  now = new Date(),
}) {
  const actionable = [];
  const selectedNotificationKeys = new Set();
  const skippedResults = [];
  let offset = 0;
  let scanned = 0;

  while (actionable.length < limit) {
    const batch = await fetchOutboxBatch({ offset, limit: batchSize });
    if (!batch.length) break;

    const notificationKeys = [
      ...new Set(
        batch
          .map(resolveBuilderSubmissionId)
          .filter(Boolean)
          .map((builderSubmissionId) => createNotificationKey(builderSubmissionId)),
      ),
    ];
    const deliveries = notificationKeys.length
      ? await fetchDeliveriesByNotificationKeys(notificationKeys)
      : [];
    const deliveriesByKey = new Map();
    for (const delivery of deliveries) {
      if (delivery?.notification_key && !deliveriesByKey.has(delivery.notification_key)) {
        deliveriesByKey.set(delivery.notification_key, delivery);
      }
    }

    for (const outboxEvent of batch) {
      scanned += 1;
      const builderSubmissionId = resolveBuilderSubmissionId(outboxEvent);
      const notificationKey = builderSubmissionId ? createNotificationKey(builderSubmissionId) : null;
      const existingDelivery = notificationKey ? deliveriesByKey.get(notificationKey) : null;
      const classification = classifyNotificationCandidate({ outboxEvent, existingDelivery, now });

      if (classification.actionable) {
        if (selectedNotificationKeys.has(notificationKey)) {
          skippedResults.push({
            outbox_event_id: outboxEvent.id,
            status: "skipped",
            reason: "duplicate notification key in current worker selection",
            notification_key: notificationKey,
          });
          continue;
        }

        selectedNotificationKeys.add(notificationKey);
        actionable.push({ outboxEvent, existingDelivery, notificationKey });
        if (actionable.length >= limit) break;
        continue;
      }

      skippedResults.push({
        outbox_event_id: outboxEvent.id,
        status: classification.status,
        reason: classification.reason,
        notification_key: classification.notificationKey || undefined,
      });
    }

    offset += batch.length;
    if (batch.length < batchSize) break;
  }

  return {
    actionable,
    scanned,
    skipped: skippedResults.length,
    skippedResults,
  };
}
