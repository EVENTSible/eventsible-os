import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingServicesFromQuoteItems,
  buildBookingPayload,
  formatMoney,
  isActiveLeadStatus,
  isBookedStatus,
  latestQuoteByLead,
} from "../lib/mission-control.mjs";

test("Mission Control status helpers match lead and booking workflow states", () => {
  assert.equal(isActiveLeadStatus("new"), true);
  assert.equal(isActiveLeadStatus("won"), false);
  assert.equal(isBookedStatus("confirmed"), true);
  assert.equal(isBookedStatus("new"), false);
});

test("Mission Control selects the latest quote by version and creation time", () => {
  const latest = latestQuoteByLead([
    { id: "old", lead_id: "lead-1", version_number: 1, created_at: "2026-08-01T10:00:00Z" },
    { id: "newer-time", lead_id: "lead-2", version_number: 1, created_at: "2026-08-01T12:00:00Z" },
    { id: "winner", lead_id: "lead-1", version_number: 2, created_at: "2026-08-01T09:00:00Z" },
    { id: "lead-2-winner", lead_id: "lead-2", version_number: 1, created_at: "2026-08-01T13:00:00Z" },
  ]);

  assert.equal(latest.get("lead-1").id, "winner");
  assert.equal(latest.get("lead-2").id, "lead-2-winner");
});

test("Convert to Gig booking payload preserves existing booking and quote identity", () => {
  const payload = buildBookingPayload({
    now: "2026-08-17T15:00:00.000Z",
    quote: {
      id: "quote-version-1",
      lead_id: "lead-1",
      event_id: "event-1",
      total_amount: 1275,
      deposit_amount: 300,
    },
    existingBooking: {
      booked_at: "2026-08-16T15:00:00.000Z",
      contract_status: "sent",
      payment_status: "deposit_due",
      metadata: { previous: true },
    },
  });

  assert.equal(payload.status, "confirmed");
  assert.equal(payload.booked_at, "2026-08-16T15:00:00.000Z");
  assert.equal(payload.balance_due, 975);
  assert.deepEqual(payload.metadata.previous, true);
  assert.equal(payload.metadata.quote_version_id, "quote-version-1");
});

test("Convert to Gig services are seeded only from quote item services", () => {
  const services = bookingServicesFromQuoteItems({
    bookingId: "booking-1",
    quoteVersionId: "quote-version-1",
    event: { starts_at: "2026-09-01T18:00:00Z", ends_at: "2026-09-01T22:00:00Z" },
    quoteItems: [
      { id: "item-1", service_id: "dj-mc", service_code: "dj_mc", service_name: "DJ / MC", line_total: 475 },
      { id: "item-2", service_code: "live_performer", service_name: "Live Performer", line_total: null },
      { id: "empty" },
    ],
  });

  assert.equal(services.length, 2);
  assert.equal(services[0].booking_id, "booking-1");
  assert.equal(services[0].configuration.quote_item_id, "item-1");
  assert.equal(services[1].service_code, "live_performer");
});

test("Mission Control money formatting avoids fake exact totals for missing values", () => {
  assert.equal(formatMoney(null), "Custom quote");
  assert.equal(formatMoney(1275), "$1,275");
});
