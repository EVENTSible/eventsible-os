import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  contractNames,
  contracts,
  idMap,
  integrationEventTypes,
  publicCatalogServiceFromBuilderService,
} from "./ecosystem-contracts.mjs";

describe("ecosystem contracts", () => {
  it("defines every required versioned contract", () => {
    assert.deepEqual(Object.keys(contracts).sort(), [...contractNames].sort());
    for (const name of contractNames) {
      assert.equal(contracts[name].properties.version.const, name);
    }
  });

  it("documents the universal IDs without replacing existing identifiers", () => {
    const required = [
      "contact_id",
      "lead_id",
      "builder_submission_id",
      "event_id",
      "quote_id",
      "quote_version_id",
      "quote_item_id",
      "booking_id",
      "task_id",
      "staff_id",
      "equipment_id",
      "client_membership_id",
      "room_id",
      "media_asset_id",
      "content_job_id",
      "order_id",
    ];

    assert.deepEqual(Object.keys(idMap).sort(), required.sort());
    assert.match(idMap.event_id.compatibility, /Universal business-event identifier/);
    assert.match(idMap.room_id.compatibility, /not a business event_id/);
  });

  it("keeps public catalog output free of private cost fields", () => {
    const publicService = publicCatalogServiceFromBuilderService({
      id: "dj-mc-foundation",
      name: "DJ / MC",
      category: "dj",
      blurb: "Public description",
      tier: "foundation",
      pricing: { kind: "hourly", perHour: 145, minHours: 2 },
      private_cost_cents: 1000,
      margin_notes: "private",
    });

    assert.equal(publicService.stable_service_id, "dj-mc-foundation");
    assert.equal(publicService.public_starting_price_cents, 14500);
    assert.equal("private_cost_cents" in publicService, false);
    assert.equal("margin_notes" in publicService, false);
  });

  it("covers integration event names needed for the first outbox foundation", () => {
    assert.ok(integrationEventTypes.includes("builder.submission_received"));
    assert.ok(integrationEventTypes.includes("quote.accepted"));
    assert.ok(integrationEventTypes.includes("content.review_ready"));
  });
});
