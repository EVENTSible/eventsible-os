"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import { bookingServicesFromQuoteItems, buildBookingPayload } from "@/lib/mission-control.mjs";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function adminRedirect(message: string, type: "notice" | "error" = "notice"): never {
  redirect(`/admin?${type}=${encodeURIComponent(message)}`);
}

async function requireStaffSupabase() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user || !isStaffRole(user.app_metadata?.role)) {
    adminRedirect("Sign in with an approved staff account.", "error");
  }

  return { supabase, user };
}

async function recordActivity(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  eventId: string,
  userId: string,
  eventType: string,
  summary: string,
  payload: Record<string, unknown> = {},
) {
  await supabase.from("os_activity_events").insert({
    event_id: eventId,
    actor_user_id: userId,
    event_type: eventType,
    visibility: "staff",
    payload: { summary, ...payload },
  });
}

export async function updateLeadStatusAction(formData: FormData) {
  const leadId = value(formData, "lead_id");
  const eventId = value(formData, "event_id");
  const status = value(formData, "status");

  if (!leadId || !status) adminRedirect("Lead status update was missing required data.", "error");

  const { supabase, user } = await requireStaffSupabase();
  const { error } = await supabase.from("os_leads").update({ status }).eq("id", leadId);

  if (error) adminRedirect("Lead status could not be updated.", "error");

  if (eventId) {
    await recordActivity(supabase, eventId, user.id, "lead.status_changed", `Lead marked ${status}.`, { lead_id: leadId });
  }

  revalidatePath("/admin");
  adminRedirect("Lead status updated.");
}

export async function approveQuoteAction(formData: FormData) {
  const quoteVersionId = value(formData, "quote_version_id");
  const leadId = value(formData, "lead_id");
  const eventId = value(formData, "event_id");

  if (!quoteVersionId || !eventId) adminRedirect("Quote approval was missing required data.", "error");

  const { supabase, user } = await requireStaffSupabase();
  const { error: quoteError } = await supabase.from("os_quote_versions").update({ status: "ready" }).eq("id", quoteVersionId);
  if (quoteError) adminRedirect("Quote could not be approved.", "error");

  if (leadId) {
    const { error: leadError } = await supabase.from("os_leads").update({ status: "quoted" }).eq("id", leadId);
    if (leadError) adminRedirect("Quote was approved, but lead status could not be updated.", "error");
  }

  await supabase.from("os_events").update({ status: "quoted" }).eq("id", eventId);
  await recordActivity(supabase, eventId, user.id, "quote.ready", "Quote approved for customer follow-up.", {
    lead_id: leadId,
    quote_version_id: quoteVersionId,
  });

  revalidatePath("/admin");
  adminRedirect("Quote approved.");
}

export async function convertToGigAction(formData: FormData) {
  const quoteVersionId = value(formData, "quote_version_id");
  const leadId = value(formData, "lead_id");
  const eventId = value(formData, "event_id");

  if (!quoteVersionId || !leadId || !eventId) adminRedirect("Convert to Gig was missing required data.", "error");

  const { supabase, user } = await requireStaffSupabase();

  const [quoteResult, eventResult, bookingResult, itemResult] = await Promise.all([
    supabase
      .from("os_quote_versions")
      .select("id,lead_id,event_id,status,currency,total_amount,deposit_amount,metadata")
      .eq("id", quoteVersionId)
      .maybeSingle(),
    supabase.from("os_events").select("id,starts_at,ends_at,title,event_type").eq("id", eventId).maybeSingle(),
    supabase.from("os_bookings").select("id,event_id,status,booked_at,contract_status,payment_status,metadata").eq("event_id", eventId).limit(1),
    supabase
      .from("os_quote_items")
      .select("id,service_id,service_code,service_name,quantity,unit,line_total,metadata")
      .eq("quote_version_id", quoteVersionId)
      .order("created_at", { ascending: true }),
  ]);

  if (quoteResult.error || !quoteResult.data) adminRedirect("Quote could not be loaded for conversion.", "error");
  if (eventResult.error || !eventResult.data) adminRedirect("Event could not be loaded for conversion.", "error");
  if (bookingResult.error) adminRedirect("Existing booking status could not be checked.", "error");
  if (itemResult.error) adminRedirect("Quote items could not be loaded for conversion.", "error");

  const existingBooking = bookingResult.data?.[0] ?? null;
  const now = new Date().toISOString();
  const bookingPayload = buildBookingPayload({ quote: quoteResult.data, existingBooking, now });

  const bookingWrite = existingBooking
    ? await supabase.from("os_bookings").update(bookingPayload).eq("id", existingBooking.id).select("id").single()
    : await supabase.from("os_bookings").insert(bookingPayload).select("id").single();

  if (bookingWrite.error || !bookingWrite.data) adminRedirect("Booking could not be created.", "error");

  const bookingId = bookingWrite.data.id;
  const existingServices = await supabase.from("os_booking_services").select("id").eq("booking_id", bookingId).limit(1);
  if (existingServices.error) adminRedirect("Booking service status could not be checked.", "error");

  if (!existingServices.data?.length) {
    const services = bookingServicesFromQuoteItems({
      bookingId,
      quoteVersionId,
      event: eventResult.data,
      quoteItems: itemResult.data ?? [],
    });

    if (services.length) {
      const serviceWrite = await supabase.from("os_booking_services").insert(services);
      if (serviceWrite.error) adminRedirect("Booking was created, but services could not be seeded.", "error");
    }
  }

  const [leadUpdate, quoteUpdate, eventUpdate] = await Promise.all([
    supabase.from("os_leads").update({ status: "won" }).eq("id", leadId),
    supabase.from("os_quote_versions").update({ status: "accepted" }).eq("id", quoteVersionId),
    supabase.from("os_events").update({ status: "booked" }).eq("id", eventId),
  ]);

  if (leadUpdate.error || quoteUpdate.error || eventUpdate.error) {
    adminRedirect("Booking was created, but final lead/event statuses need review.", "error");
  }

  await recordActivity(supabase, eventId, user.id, "quote.accepted", "Quote converted to a booked gig.", {
    lead_id: leadId,
    quote_version_id: quoteVersionId,
    booking_id: bookingId,
  });
  await recordActivity(supabase, eventId, user.id, "booking.confirmed", "Booked Gig workspace started.", {
    lead_id: leadId,
    quote_version_id: quoteVersionId,
    booking_id: bookingId,
  });

  revalidatePath("/admin");
  adminRedirect("Converted to booked gig.");
}
