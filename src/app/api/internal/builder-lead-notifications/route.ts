import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildBuilderLeadEmail,
  processBuilderLeadOutboxEvent,
  resolveNotificationConfig,
  sendWithResend,
} from "@/lib/notifications/builder-lead-email.mjs";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.EVENTSIBLE_NOTIFICATION_WORKER_SECRET;
  if (!expected) return false;
  const authorization = request.headers.get("authorization") || "";
  const workerHeader = request.headers.get("x-eventsible-worker-secret") || "";
  return authorization === `Bearer ${expected}` || workerHeader === expected;
}

async function single<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} lookup failed.`);
  if (!data) throw new Error(`${label} was not found.`);
  return data;
}

function centsFromAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function normalizeQuoteVersion(row: Record<string, unknown>) {
  return {
    ...row,
    subtotal_cents: centsFromAmount(row.subtotal),
    package_savings_cents: centsFromAmount(row.discount_amount),
    travel_cents: centsFromAmount(row.travel_amount),
    total_cents: centsFromAmount(row.total_amount),
  };
}

async function loadChain(supabase: ReturnType<typeof createAdminSupabase>, related: Record<string, string>) {
  const builderSubmissionId = related.builder_submission_id;
  const eventId = related.event_id;
  const leadId = related.lead_id;
  const quoteVersionId = related.quote_version_id;
  const contactId = related.contact_id;

  const [submission, contact, event, lead, quoteVersion, quoteItems] = await Promise.all([
    single(
      supabase.from("os_builder_submissions").select("id,contact_id,normalized_payload,submitted_from,created_at").eq("id", builderSubmissionId).maybeSingle(),
      "Builder submission",
    ),
    single(
      supabase.from("os_contacts").select("id,display_name,primary_email,primary_phone,preferred_channel").eq("id", contactId).maybeSingle(),
      "Contact",
    ),
    single(
      supabase.from("os_events").select("id,event_type,starts_at,ends_at,venue_city,venue_state,timezone").eq("id", eventId).maybeSingle(),
      "Event",
    ),
    single(
      supabase.from("os_leads").select("id,status,source").eq("id", leadId).maybeSingle(),
      "Lead",
    ),
    single(
      supabase.from("os_quote_versions").select("id,subtotal,discount_amount,travel_amount,total_amount,currency").eq("id", quoteVersionId).maybeSingle(),
      "Quote version",
    ),
    supabase
      .from("os_quote_items")
      .select("id,service_code,service_name,line_total,metadata")
      .eq("quote_version_id", quoteVersionId)
      .order("created_at", { ascending: true }),
  ]);

  if (quoteItems.error) throw new Error("Quote items lookup failed.");

  return {
    submission,
    contact,
    event,
    lead,
    quoteVersion: normalizeQuoteVersion(quoteVersion as Record<string, unknown>),
    quoteItems: quoteItems.data ?? [],
  };
}

async function processPending(limit = 5) {
  const supabase = createAdminSupabase();
  const config = resolveNotificationConfig();
  const { data: outboxEvents, error } = await supabase
    .from("os_integration_outbox")
    .select("id,event_type,payload_version,source_application,related_record_ids,payload,status,created_at")
    .eq("event_type", "builder.submission_received")
    .in("status", ["pending", "retry"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error("Outbox lookup failed.");

  const results = [];
  for (const outboxEvent of outboxEvents ?? []) {
    const builderSubmissionId = outboxEvent.related_record_ids?.builder_submission_id;
    if (!builderSubmissionId) {
      results.push({ outbox_event_id: outboxEvent.id, status: "skipped", reason: "missing builder_submission_id" });
      continue;
    }

    const notificationKey = `builder-lead-email:${builderSubmissionId}`;
    const existingResult = await supabase
      .from("os_notification_deliveries")
      .select("status,attempt_count,max_attempts,next_attempt_at")
      .eq("notification_key", notificationKey)
      .maybeSingle();

    if (existingResult.error) throw new Error("Notification delivery lookup failed.");
    if (existingResult.data?.status === "sent" || existingResult.data?.status === "dry_run") {
      results.push({ outbox_event_id: outboxEvent.id, status: "skipped" });
      continue;
    }
    if (existingResult.data?.status === "failed") {
      results.push({ outbox_event_id: outboxEvent.id, status: "failed" });
      continue;
    }
    if (
      existingResult.data?.next_attempt_at &&
      new Date(existingResult.data.next_attempt_at).getTime() > Date.now()
    ) {
      results.push({ outbox_event_id: outboxEvent.id, status: "retry_scheduled" });
      continue;
    }

    const chain = await loadChain(supabase, outboxEvent.related_record_ids);
    const result = await processBuilderLeadOutboxEvent({
      outboxEvent,
      chain,
      existingDelivery: existingResult.data,
      config,
      sendEmail: sendWithResend,
      recordDelivery: async (record: Record<string, unknown>) => {
        const { error: writeError } = await supabase
          .from("os_notification_deliveries")
          .upsert(
            {
              ...record,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "notification_key" },
          );
        if (writeError) throw new Error("Notification delivery write failed.");
      },
    });

    results.push({
      outbox_event_id: outboxEvent.id,
      notification_key: notificationKey,
      status: result.status,
      email_preview: config.dryRun ? buildBuilderLeadEmail({ chain, outboxEvent, config }).subject : undefined,
    });
  }

  return results;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || "5");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 25) : 5;
    const results = await processPending(limit);

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Notification worker failed safely." }, { status: 500 });
  }
}
