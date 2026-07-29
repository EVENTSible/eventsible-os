export const CONTRACT_VERSION = "2026-07-29";

export const contractNames = [
  "builder_submission_v1",
  "public_service_catalog_v1",
  "quote_draft_v1",
  "booking_v1",
  "event_activation_v1",
  "client_portal_summary_v1",
  "media_asset_v1",
  "content_factory_job_v1",
];

export const ecosystemSourceApplications = [
  "event_builder",
  "eventsible_os",
  "client_portal",
  "ecc_vince",
  "booth_console",
  "content_factory",
  "custom_creations",
];

export const idMap = {
  contact_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: ["builder_submission_v1", "quote_draft_v1", "booking_v1"],
    compatibility: "Reuse existing OS contact UUIDs; dedupe by email, then phone.",
  },
  lead_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: ["builder_submission_v1", "quote_draft_v1"],
    compatibility: "Preserve lead records created by public.os_ingest_builder_submission.",
  },
  builder_submission_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: ["builder_submission_v1"],
    compatibility: "Preserve external submissionId idempotency and stored payload.",
  },
  event_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: [
      "builder_submission_v1",
      "quote_draft_v1",
      "booking_v1",
      "event_activation_v1",
      "client_portal_summary_v1",
      "media_asset_v1",
      "content_factory_job_v1",
    ],
    compatibility: "Universal business-event identifier; ECC/VINCE room_id remains separate.",
  },
  quote_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: ["quote_draft_v1", "booking_v1"],
    compatibility: "Reuse draft quote created by intake; approved quote workflow is additive.",
  },
  quote_version_id: {
    owner: "EVENTSible OS",
    status: "planned",
    connects: ["quote_draft_v1"],
    compatibility: "Add only when quote revisions are implemented; keep quote_id stable.",
  },
  quote_item_id: {
    owner: "EVENTSible OS",
    status: "implemented",
    connects: ["quote_draft_v1"],
    compatibility: "Known services should map to service_id/code; unknown labels stay custom.",
  },
  booking_id: {
    owner: "EVENTSible OS",
    status: "partial",
    connects: ["booking_v1", "client_portal_summary_v1", "event_activation_v1"],
    compatibility: "Created during convert-to-gig; do not create a Builder-side booking system.",
  },
  task_id: {
    owner: "EVENTSible OS",
    status: "partial",
    connects: ["booking_v1", "content_factory_job_v1"],
    compatibility: "Reuse OS task/workspace records once operational task flow is verified.",
  },
  staff_id: {
    owner: "EVENTSible OS / Supabase Auth app_metadata",
    status: "partial",
    connects: ["booking_v1", "event_activation_v1"],
    compatibility: "Use private staff/admin role checks; no public staff table exposure.",
  },
  equipment_id: {
    owner: "EVENTSible OS",
    status: "planned",
    connects: ["public_service_catalog_v1", "booking_v1"],
    compatibility: "Catalog may reference requirements without exposing inventory cost/private notes.",
  },
  client_membership_id: {
    owner: "EVENTSible OS",
    status: "partial",
    connects: ["client_portal_summary_v1"],
    compatibility: "Client Portal access is membership-scoped to event_id/contact_id.",
  },
  room_id: {
    owner: "ECC/VINCE",
    status: "implemented",
    connects: ["event_activation_v1"],
    compatibility: "Live room identifier is linked from OS event_activation; not a business event_id.",
  },
  media_asset_id: {
    owner: "OS / Content Factory / ECC by asset lane",
    status: "partial",
    connects: ["media_asset_v1", "content_factory_job_v1"],
    compatibility: "Separate live effects, private client files, public catalog media, and shop media.",
  },
  content_job_id: {
    owner: "EVENTSible OS / Content Factory",
    status: "planned",
    connects: ["content_factory_job_v1"],
    compatibility: "Use event_id and review-before-publish; do not create separate event records.",
  },
  order_id: {
    owner: "Custom Creations / shop lane",
    status: "planned",
    connects: ["booking_v1", "content_factory_job_v1"],
    compatibility: "Reference contact_id/event_id when event-related; shop order ownership stays additive.",
  },
};

const uuid = { type: "string", format: "uuid" };
const isoDate = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const isoDateTime = { type: "string", format: "date-time" };
const timezone = { type: "string", minLength: 3, maxLength: 64 };
const cents = { type: "integer", minimum: 0, maximum: 100000000 };
const sourceApplication = { type: "string", enum: ecosystemSourceApplications };

export const contracts = {
  builder_submission_v1: {
    $id: "https://eventsible.biz/contracts/builder_submission_v1.schema.json",
    title: "builder_submission_v1",
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "submission_id", "contact", "event", "selected_services"],
    properties: {
      version: { const: "builder_submission_v1" },
      source_application: { const: "event_builder" },
      submission_id: { type: "string", minLength: 8, maxLength: 160 },
      contact_id: uuid,
      lead_id: uuid,
      builder_submission_id: uuid,
      event_id: uuid,
      submitted_at: isoDateTime,
      contact: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          email: { type: "string", format: "email", maxLength: 254 },
          phone: { type: "string", maxLength: 40 },
        },
      },
      event: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type", "timezone"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 180 },
          type: { type: "string", minLength: 1, maxLength: 80 },
          date: isoDate,
          start_time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          end_time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          timezone,
          guest_count: { type: "integer", minimum: 0, maximum: 10000 },
        },
      },
      venue: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 180 },
          city: { type: "string", maxLength: 120 },
          state: { type: "string", maxLength: 60 },
          power_available: { type: "boolean" },
          wifi_available: { type: "boolean" },
          outdoor: { type: "boolean" },
        },
      },
      selected_services: {
        type: "array",
        minItems: 1,
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            code: { type: "string", maxLength: 100 },
            name: { type: "string", minLength: 1, maxLength: 180 },
            quantity: { type: "number", minimum: 0, maximum: 10000 },
            unit: { type: "string", maxLength: 40 },
            unit_price_cents: cents,
            line_total_cents: cents,
            custom_quote: { type: "boolean" },
            metadata: { type: "object" },
          },
        },
      },
      pricing: {
        type: "object",
        additionalProperties: false,
        properties: {
          estimated_total_cents: cents,
          deposit_amount_cents: cents,
          package_savings_cents: cents,
        },
      },
      public_fields: { type: "array", items: { type: "string" } },
      private_fields: { type: "array", items: { type: "string" } },
      backward_compatibility: { type: "string" },
    },
  },
  public_service_catalog_v1: {
    $id: "https://eventsible.biz/contracts/public_service_catalog_v1.schema.json",
    title: "public_service_catalog_v1",
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "catalog_version", "effective_date", "services"],
    properties: {
      version: { const: "public_service_catalog_v1" },
      source_application: sourceApplication,
      catalog_version: { type: "string", minLength: 1, maxLength: 80 },
      effective_date: isoDate,
      services: {
        type: "array",
        maxItems: 500,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "stable_service_id",
            "public_name",
            "internal_name",
            "category",
            "pricing_type",
            "custom_quote_status",
            "active",
          ],
          properties: {
            stable_service_id: { type: "string", minLength: 1, maxLength: 100 },
            public_name: { type: "string", minLength: 1, maxLength: 180 },
            internal_name: { type: "string", minLength: 1, maxLength: 180 },
            category: { type: "string", minLength: 1, maxLength: 80 },
            public_description: { type: "string", maxLength: 1000 },
            pricing_type: { type: "string", enum: ["flat", "hourly", "from", "custom"] },
            public_starting_price_cents: cents,
            weekday_rules: { type: "array", items: { type: "string" } },
            minimum_hours: { type: "number", minimum: 0, maximum: 24 },
            package_eligibility: { type: "array", items: { type: "string" } },
            custom_quote_status: { type: "string", enum: ["not_required", "required", "optional"] },
            public_media: { type: "array", items: { type: "object" } },
            required_staff: { type: "array", items: { type: "string" } },
            required_equipment: { type: "array", items: { type: "string" } },
            active: { type: "boolean" },
            effective_date: isoDate,
          },
        },
      },
    },
  },
  quote_draft_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "event_id", "quote_id", "status", "currency", "items"],
    properties: {
      version: { const: "quote_draft_v1" },
      source_application: sourceApplication,
      event_id: uuid,
      lead_id: uuid,
      quote_id: uuid,
      quote_version_id: uuid,
      status: { type: "string", enum: ["draft", "ready", "sent", "accepted", "declined", "void"] },
      currency: { const: "USD" },
      subtotal_cents: cents,
      discount_cents: cents,
      total_cents: cents,
      deposit_cents: cents,
      items: { type: "array", minItems: 1, maxItems: 200, items: { type: "object" } },
    },
  },
  booking_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "event_id", "booking_id", "status"],
    properties: {
      version: { const: "booking_v1" },
      source_application: sourceApplication,
      event_id: uuid,
      booking_id: uuid,
      quote_id: uuid,
      contact_id: uuid,
      client_membership_id: uuid,
      status: { type: "string", enum: ["pending", "pending_contract", "pending_deposit", "confirmed", "cancelled", "completed"] },
      booked_at: isoDateTime,
      total_cents: cents,
      balance_due_cents: cents,
    },
  },
  event_activation_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "event_id", "activation_status"],
    properties: {
      version: { const: "event_activation_v1" },
      source_application: { const: "eventsible_os" },
      event_id: uuid,
      booking_id: uuid,
      room_id: { type: "string", minLength: 3, maxLength: 80 },
      activation_status: { type: "string", enum: ["requested", "ready", "active", "completed", "cancelled"] },
      public_join_label: { type: "string", maxLength: 120 },
      event_day_starts_at: isoDateTime,
      timezone,
    },
  },
  client_portal_summary_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "event_id", "client_membership_id"],
    properties: {
      version: { const: "client_portal_summary_v1" },
      source_application: { const: "eventsible_os" },
      event_id: uuid,
      booking_id: uuid,
      contact_id: uuid,
      client_membership_id: uuid,
      visible_status: { type: "string", maxLength: 80 },
      balance_due_cents: cents,
      planning_percent: { type: "integer", minimum: 0, maximum: 100 },
    },
  },
  media_asset_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "media_asset_id", "visibility"],
    properties: {
      version: { const: "media_asset_v1" },
      source_application: sourceApplication,
      media_asset_id: uuid,
      event_id: uuid,
      content_job_id: uuid,
      order_id: { type: "string", maxLength: 120 },
      visibility: { type: "string", enum: ["public", "client", "shared", "staff", "live_room"] },
      asset_type: { type: "string", maxLength: 80 },
      url: { type: "string", maxLength: 2048 },
    },
  },
  content_factory_job_v1: {
    type: "object",
    additionalProperties: false,
    required: ["version", "source_application", "content_job_id", "event_id", "status"],
    properties: {
      version: { const: "content_factory_job_v1" },
      source_application: { const: "content_factory" },
      content_job_id: uuid,
      event_id: uuid,
      task_id: uuid,
      media_asset_id: uuid,
      order_id: { type: "string", maxLength: 120 },
      status: { type: "string", enum: ["queued", "drafting", "review_ready", "approved", "published", "failed"] },
      review_required: { const: true },
    },
  },
};

export const integrationEventTypes = [
  "builder.submission_received",
  "lead.status_changed",
  "quote.ready",
  "quote.sent",
  "quote.accepted",
  "booking.confirmed",
  "event.updated",
  "event.room_requested",
  "event.completed",
  "client.portal_ready",
  "media.asset_added",
  "content.review_ready",
];

export function publicCatalogServiceFromBuilderService(service) {
  const pricing = service.pricing ?? { kind: "custom" };
  const pricingType = pricing.kind ?? "custom";
  const publicPrice =
    pricingType === "flat"
      ? pricing.price
      : pricingType === "hourly"
        ? pricing.perHour
        : pricingType === "from"
          ? pricing.startsAt
          : undefined;

  return {
    stable_service_id: service.id,
    public_name: service.name,
    internal_name: service.name,
    category: service.category,
    public_description: service.blurb ?? "",
    pricing_type: pricingType,
    public_starting_price_cents: typeof publicPrice === "number" ? Math.round(publicPrice * 100) : undefined,
    weekday_rules: [],
    minimum_hours: pricingType === "hourly" ? pricing.minHours ?? 1 : undefined,
    package_eligibility: service.tier ? [service.tier] : [],
    custom_quote_status: service.customQuote || pricingType === "custom" ? "required" : "not_required",
    public_media: [],
    required_staff: [],
    required_equipment: [],
    active: true,
    effective_date: "2026-07-29",
  };
}
