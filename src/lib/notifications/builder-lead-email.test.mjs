import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBuilderLeadEmail,
  createNotificationKey,
  processBuilderLeadOutboxEvent,
  resolveNotificationConfig,
} from "./builder-lead-email.mjs";

const config = resolveNotificationConfig({
  EVENTSIBLE_LEAD_NOTIFICATION_DRY_RUN: "true",
  EVENTSIBLE_LEAD_NOTIFICATION_TO: "firstfamdjs@gmail.com",
  EVENTSIBLE_LEAD_NOTIFICATION_FROM: "EVENTSible Leads <thepartys@updates.eventsible.info>",
  EVENTSIBLE_ADMIN_LEADS_URL: "https://build.eventsible.info/admin",
});

function fixture({ email = "qa@example.invalid", date = "2026-08-11" } = {}) {
  const builderSubmissionId = "b48d0e5f-97ea-4d09-a9eb-3b59f4af98b4";
  return {
    outboxEvent: {
      id: "84223983-49ad-4142-85af-3faf5b60750d",
      event_type: "builder.submission_received",
      payload_version: "builder_submission_received_v1",
      source_application: "eventsible-event-builder",
      related_record_ids: {
        contact_id: "0308a168-4198-49f5-93af-1a5199945147",
        builder_submission_id: builderSubmissionId,
        lead_id: "a1ba31e5-eeef-4bb4-b164-76a4a754f79c",
        event_id: "72624d36-6db8-4839-a2b2-ecb201ebc313",
        quote_version_id: "f201f84b-aa24-4b3a-9464-1d1ed6407d16",
        activity_id: "01d45808-6121-4407-b781-b2fcee3fa9cd",
      },
      payload: {
        contract_version: "builder_submission_v1",
        selected_package_tier: "premium",
        service_codes: ["dj_mc", "selfie_booth_prints", "live_performer", "event_staff"],
        custom_quote_service_codes: ["live_performer"],
        total_cents: 72700,
        travel_cents: 0,
        package_savings_cents: 6300,
        planning_stage: "Ready for a quote",
        date_confidence: date ? "exact" : "TBD",
      },
    },
    chain: {
      contact: {
        display_name: "EVENTSible Email Preview QA",
        primary_email: email,
        primary_phone: "5745550101",
        preferred_channel: "email",
      },
      submission: {
        submitted_from: "eventsible-event-builder",
        normalized_payload: {
          contact: {
            name: "EVENTSible Email Preview QA",
            email,
            phone: "5745550101",
            preferred_contact_method: "email",
            best_contact_time: "Afternoon",
          },
          event_type: "Private Party",
          event_date: date,
          service_length: 3,
          venue: { city: "South Bend", state: "Indiana" },
          planning_stage: "Ready for a quote",
          date_confidence: date ? "exact" : "TBD",
          recommended_package: { tier: "premium" },
          pricing: {
            subtotal: 790,
            package_savings: 63,
            travel_fee: 0,
            estimated_total: 727,
          },
        },
      },
      event: {
        event_type: "Private Party",
        venue_city: "South Bend",
        venue_state: "Indiana",
      },
      lead: { status: "new" },
      quoteVersion: {
        subtotal_cents: 79000,
        package_savings_cents: 6300,
        travel_cents: 0,
        total_cents: 72700,
      },
      quoteItems: [
        { service_name: "DJ/MC", custom_quote: false },
        { service_name: "Selfie Booth with Prints", custom_quote: false },
        { service_name: "Live Singer", custom_quote: true },
        { service_name: "Event Staff", custom_quote: false },
      ],
    },
  };
}

test("builds branded HTML and plain-text internal lead email", () => {
  const { outboxEvent, chain } = fixture();
  const email = buildBuilderLeadEmail({ outboxEvent, chain, config });

  assert.equal(email.to, "firstfamdjs@gmail.com");
  assert.equal(email.from, "EVENTSible Leads <thepartys@updates.eventsible.info>");
  assert.equal(email.replyTo, "qa@example.invalid");
  assert.match(email.subject, /New EVENTSible Lead: Private Party/);
  assert.match(email.text, /Final estimate: \$727/);
  assert.match(email.text, /Package savings: -\$63/);
  assert.match(email.text, /Travel: \$0/);
  assert.match(email.text, /Live Singer \(Custom Quote\)/);
  assert.match(email.html, /Open protected Admin Leads/);
  assert.match(email.text, /https:\/\/build\.eventsible\.info\/admin/);
  assert.doesNotMatch(email.text + email.html, /raw_payload|service_role|password|token|outbox payload/i);
});

test("renders Production-shaped quote records without unsupported cent columns", () => {
  const { outboxEvent, chain } = fixture();
  chain.quoteVersion = {
    id: outboxEvent.related_record_ids.quote_version_id,
    subtotal: "790",
    discount_amount: "63",
    travel_amount: "0",
    total_amount: "727",
    currency: "USD",
  };
  chain.quoteItems = [
    { service_code: "dj_mc", service_name: "DJ/MC" },
    { service_code: "selfie_booth_prints", service_name: "Selfie Booth with Prints" },
    { service_code: "live_performer", service_name: "Live Singer" },
    { service_code: "event_staff", service_name: "Event Staff" },
  ];

  const email = buildBuilderLeadEmail({ outboxEvent, chain, config });

  assert.match(email.text, /Subtotal: \$790/);
  assert.match(email.text, /Package savings: -\$63/);
  assert.match(email.text, /Travel: \$0/);
  assert.match(email.text, /Final estimate: \$727/);
  assert.match(email.text, /Live Singer \(Custom Quote\)/);
});

test("worker route avoids Production-missing select columns", () => {
  const routeSource = readFileSync(
    new URL("../../app/api/internal/builder-lead-notifications/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(routeSource, /os_builder_submissions"\)\.select\("[^"]*\bevent_id\b/);
  assert.doesNotMatch(routeSource, /os_builder_submissions"\)\.select\("[^"]*\bsubmitted_at\b/);
  assert.doesNotMatch(routeSource, /os_quote_versions"\)\.select\("[^"]*\bsubtotal_cents\b/);
  assert.doesNotMatch(routeSource, /os_quote_versions"\)\.select\("[^"]*\bpackage_savings_cents\b/);
  assert.doesNotMatch(routeSource, /os_quote_versions"\)\.select\("[^"]*\btravel_cents\b/);
  assert.doesNotMatch(routeSource, /os_quote_versions"\)\.select\("[^"]*\btotal_cents\b/);
  assert.doesNotMatch(routeSource, /os_quote_items"\)\s*\.select\("[^"]*\blabel\b/);
  assert.doesNotMatch(routeSource, /os_quote_items"\)\s*\.select\("[^"]*\bcustom_quote\b/);
  assert.doesNotMatch(routeSource, /os_quote_items"\)\s*\.select\("[^"]*\bline_total_cents\b/);
});

test("omits Reply-To when the client email is missing or invalid", () => {
  const { outboxEvent, chain } = fixture({ email: "" });
  const email = buildBuilderLeadEmail({ outboxEvent, chain, config });

  assert.equal(email.replyTo, undefined);
  assert.match(email.text, /Email: Not provided/);
});

test("renders Date TBD safely", () => {
  const { outboxEvent, chain } = fixture({ date: "" });
  const email = buildBuilderLeadEmail({ outboxEvent, chain, config });

  assert.match(email.subject, /Date TBD/);
  assert.match(email.text, /Event date: Date TBD/);
});

test("processes one successful dry-run notification without mutating the outbox event", async () => {
  const { outboxEvent, chain } = fixture();
  const before = JSON.stringify(outboxEvent);
  const deliveries = [];

  const result = await processBuilderLeadOutboxEvent({
    outboxEvent,
    chain,
    config,
    recordDelivery: async (record) => deliveries.push(record),
  });

  assert.equal(result.status, "dry_run");
  assert.equal(result.notificationKey, createNotificationKey(outboxEvent.related_record_ids.builder_submission_id));
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].status, "dry_run");
  assert.equal(deliveries[0].attempt_count, 1);
  assert.equal(JSON.stringify(outboxEvent), before);
});

test("skips duplicate sends after a successful notification", async () => {
  const { outboxEvent, chain } = fixture();
  const deliveries = [];

  const result = await processBuilderLeadOutboxEvent({
    outboxEvent,
    chain,
    existingDelivery: { status: "sent", attempt_count: 1 },
    config,
    recordDelivery: async (record) => deliveries.push(record),
  });

  assert.equal(result.status, "skipped");
  assert.equal(deliveries.length, 0);
});

test("records retry without throwing when Resend is unavailable", async () => {
  const { outboxEvent, chain } = fixture();
  const deliveries = [];

  const result = await processBuilderLeadOutboxEvent({
    outboxEvent,
    chain,
    existingDelivery: { status: "queued", attempt_count: 0, max_attempts: 3 },
    config: { ...config, dryRun: false, resendApiKey: "test-key", maxAttempts: 3 },
    sendEmail: async () => {
      throw new Error("Resend temporary outage token_123456789012345678901234567890");
    },
    recordDelivery: async (record) => deliveries.push(record),
  });

  assert.equal(result.status, "retry");
  assert.equal(deliveries[0].status, "retry");
  assert.equal(deliveries[0].attempt_count, 1);
  assert.doesNotMatch(deliveries[0].last_safe_error, /token_123456789012345678901234567890/);
});

test("marks final failure at the maximum attempt without duplicate success", async () => {
  const { outboxEvent, chain } = fixture();
  const deliveries = [];

  const result = await processBuilderLeadOutboxEvent({
    outboxEvent,
    chain,
    existingDelivery: { status: "retry", attempt_count: 2, max_attempts: 3 },
    config: { ...config, dryRun: false, resendApiKey: "test-key", maxAttempts: 3 },
    sendEmail: async () => {
      throw new Error("Provider still unavailable");
    },
    recordDelivery: async (record) => deliveries.push(record),
  });

  assert.equal(result.status, "failed");
  assert.equal(deliveries[0].status, "failed");
  assert.equal(deliveries[0].attempt_count, 3);
});
