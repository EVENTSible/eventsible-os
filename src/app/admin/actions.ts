"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import { WEDDING_COMPANION_VERSION } from "@/lib/wedding-companion.mjs";
import {
  bookingServicesFromQuoteItems,
  buildBookingPayload,
  CONVERSION_QUOTE_SELECT,
  QUOTE_APPROVAL_STATUS,
} from "@/lib/mission-control.mjs";
import {
  buildOperationalTimingMutation,
  operationalTimingRpcArgs,
  operationalTimingRpcError,
  OPERATIONAL_TIMING_FACT_KEY_LIST,
} from "@/lib/operational-timing.mjs";
import {
  buildEventDayLogisticsMutation,
  eventDayLogisticsHasChanges,
  eventDayLogisticsRpcArgs,
  eventDayLogisticsRpcError,
} from "@/lib/event-day-logistics.mjs";
import { dayOfContactRpcArgs, dayOfContactRpcError } from "@/lib/day-of-contact.mjs";
import { extractOperationalDetails } from "@/lib/gig-readiness.mjs";
import type { OperationalTimingActionState } from "@/components/operational-timing-editor";
import type { EventDayLogisticsActionState } from "@/components/event-day-logistics-editor";
import type { DayOfContactActionState } from "@/components/day-of-contact-editor";

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

async function clientPortalOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (!host) throw new Error("The client portal URL is not configured.");
  return `${protocol}://${host}`;
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
  const { error: quoteError } = await supabase.from("os_quote_versions").update({ status: QUOTE_APPROVAL_STATUS }).eq("id", quoteVersionId);
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
      .select(CONVERSION_QUOTE_SELECT)
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

export async function updateOperationalTimingAction(
  _previousState: OperationalTimingActionState,
  formData: FormData,
): Promise<OperationalTimingActionState> {
  const eventId = value(formData, "event_id");
  if (!eventId) return { status: "error", message: "The event was missing. No timing details were changed." };

  const submitted = {
    arrival_time: value(formData, "arrival_time"),
    load_in_start: value(formData, "load_in_start"),
    load_in_end: value(formData, "load_in_end"),
    setup_complete_by: value(formData, "setup_complete_by"),
    breakdown_start: value(formData, "breakdown_start"),
    must_be_out: value(formData, "must_be_out"),
  };
  const { supabase, user } = await requireStaffSupabase();
  const [eventResult, bookingResult, factResult] = await Promise.all([
    supabase.from("os_events").select("id,settings").eq("id", eventId).maybeSingle(),
    supabase.from("os_bookings").select("metadata").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("os_event_facts").select("fact_key,value").eq("event_id", eventId).in("fact_key", OPERATIONAL_TIMING_FACT_KEY_LIST),
  ]);

  if (eventResult.error || !eventResult.data) return { status: "error", message: "The canonical event could not be loaded. No timing details were changed." };
  if (bookingResult.error || factResult.error) return { status: "error", message: "Existing operational times could not be verified. No timing details were changed." };

  const current = extractOperationalDetails({ event: eventResult.data, booking: bookingResult.data, facts: factResult.data ?? [] });
  const mutation = buildOperationalTimingMutation({ eventId, userId: user.id, submitted, current });
  if (Object.keys(mutation.errors).length) return { status: "error", message: "Check the highlighted times. Nothing was saved.", errors: mutation.errors };
  if (!mutation.rows.length) return { status: "success", message: "No operational timing changes were needed." };

  const rpcResult = await supabase.rpc("os_update_event_operational_timing", operationalTimingRpcArgs(eventId, mutation.rows));
  if (rpcResult.error) return { status: "error", message: operationalTimingRpcError(rpcResult.error) };
  if (rpcResult.data?.status === "noop") return { status: "success", message: "No operational timing changes were needed." };
  if (rpcResult.data?.status !== "updated") return { status: "error", message: "Operational times could not be verified. Nothing was changed." };

  revalidatePath(`/admin/gigs/${eventId}`);
  return { status: "success", message: `${mutation.changedLabels.join(", ")} updated.` };
}

export async function updateEventDayLogisticsAction(
  _previousState: EventDayLogisticsActionState,
  formData: FormData,
): Promise<EventDayLogisticsActionState> {
  const eventId = value(formData, "event_id");
  if (!eventId) return { status: "error", message: "The event was missing. No logistics details were changed." };

  const submitted = {
    staff_call_time: value(formData, "staff_call_time"),
    setup_start: value(formData, "setup_start"),
    room_area: value(formData, "room_area"),
    load_in_details: value(formData, "load_in_details"),
  };
  const { supabase } = await requireStaffSupabase();
  const eventResult = await supabase.from("os_events").select("id,settings").eq("id", eventId).maybeSingle();

  if (eventResult.error || !eventResult.data) {
    return { status: "error", message: "The canonical event could not be loaded. No logistics details were changed." };
  }

  const mutation = buildEventDayLogisticsMutation({ submitted, currentSettings: eventResult.data.settings ?? {} });
  if (Object.keys(mutation.errors).length) {
    return { status: "error", message: "Check the highlighted logistics fields. Nothing was saved.", errors: mutation.errors };
  }
  if (!eventDayLogisticsHasChanges(mutation.args)) {
    return { status: "success", message: "No event-day logistics changes were needed." };
  }

  const rpcResult = await supabase.rpc("os_update_event_day_logistics", eventDayLogisticsRpcArgs(eventId, mutation.args));
  if (rpcResult.error) return { status: "error", message: eventDayLogisticsRpcError(rpcResult.error) };
  if (rpcResult.data?.status === "noop") return { status: "success", message: "No event-day logistics changes were needed." };
  if (rpcResult.data?.status !== "updated") {
    return { status: "error", message: "Event-day logistics could not be verified. Nothing was changed." };
  }

  revalidatePath(`/admin/gigs/${eventId}`);
  return { status: "success", message: `${mutation.changedLabels.join(", ")} updated.` };
}

export async function updateDayOfContactAction(
  _previousState: DayOfContactActionState,
  formData: FormData,
): Promise<DayOfContactActionState> {
  const eventId = value(formData, "event_id");
  const contactId = value(formData, "day_of_contact_id");
  if (!eventId || !contactId) {
    return { status: "error", message: "Select an existing contact. Nothing was changed.", errors: { day_of_contact_id: "Choose an existing contact." } };
  }

  let rpcArgs: ReturnType<typeof dayOfContactRpcArgs>;
  try {
    rpcArgs = dayOfContactRpcArgs(eventId, contactId);
  } catch {
    return { status: "error", message: "Select an existing contact. Nothing was changed.", errors: { day_of_contact_id: "Choose a valid existing contact." } };
  }

  const { supabase } = await requireStaffSupabase();
  const rpcResult = await supabase.rpc("os_update_event_day_of_contact", rpcArgs);
  if (rpcResult.error) return { status: "error", message: dayOfContactRpcError(rpcResult.error) };
  if (rpcResult.data?.status === "noop") return { status: "success", message: "That contact is already assigned for the event day." };
  if (rpcResult.data?.status !== "updated") return { status: "error", message: "The day-of contact could not be verified. Nothing was changed." };

  revalidatePath(`/admin/gigs/${eventId}`);
  return { status: "success", message: "Day-of contact updated." };
}

export async function activateWeddingCompanionAction(formData: FormData) {
  const eventId = value(formData, "event_id");
  if (!eventId) adminRedirect("Wedding Hero activation was missing the event.", "error");

  const { supabase, user } = await requireStaffSupabase();
  const eventResult = await supabase
    .from("os_events")
    .select("id,title,event_type,primary_contact_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventResult.error || !eventResult.data) adminRedirect("The wedding event could not be loaded.", "error");
  if (!String(eventResult.data.event_type ?? "").toLowerCase().includes("wedding")) {
    adminRedirect("Wedding Hero can only be activated for a wedding event.", "error");
  }

  const contactId = String(eventResult.data.primary_contact_id ?? "");
  if (!contactId) adminRedirect("Add a primary client to this wedding before activation.", "error");

  const contactResult = await supabase
    .from("os_contacts")
    .select("id,primary_email")
    .eq("id", contactId)
    .maybeSingle();
  const clientEmail = String(contactResult.data?.primary_email ?? "").trim().toLowerCase();
  if (contactResult.error || !clientEmail) adminRedirect("Add the client email before activating Wedding Hero.", "error");

  let successMessage = "Wedding Hero activated.";

  try {
    const admin = createAdminSupabase();
    const templateResult = await admin
      .from("os_planning_templates")
      .select("id")
      .eq("slug", "wedding-hero")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (templateResult.error || !templateResult.data) throw new Error("The published Wedding Hero template is unavailable.");

    const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersResult.error) throw usersResult.error;

    let clientUser = usersResult.data.users.find((candidate) => candidate.email?.trim().toLowerCase() === clientEmail) ?? null;
    let inviteSent = false;

    if (!clientUser) {
      const portalOrigin = await clientPortalOrigin();
      const inviteResult = await admin.auth.admin.inviteUserByEmail(clientEmail, {
        redirectTo: `${portalOrigin}/auth/callback?next=/client`,
        data: { source: WEDDING_COMPANION_VERSION },
      });
      if (inviteResult.error || !inviteResult.data.user) throw inviteResult.error ?? new Error("The client invitation could not be created.");
      clientUser = inviteResult.data.user;
      inviteSent = true;
    }

    const contactLink = await admin.from("os_contact_users").upsert({
      contact_id: contactId,
      user_id: clientUser.id,
      relationship: "self",
      is_primary: true,
    }, { onConflict: "contact_id,user_id" });
    if (contactLink.error) throw contactLink.error;

    const memberResult = await admin
      .from("os_event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", clientUser.id)
      .maybeSingle();
    if (memberResult.error) throw memberResult.error;

    const memberPayload = {
      event_id: eventId,
      user_id: clientUser.id,
      contact_id: contactId,
      member_role: "client",
      is_active: true,
      invited_at: new Date().toISOString(),
      permissions: { planning: "edit", source: WEDDING_COMPANION_VERSION },
    };
    const memberWrite = memberResult.data
      ? await admin.from("os_event_members").update(memberPayload).eq("id", memberResult.data.id)
      : await admin.from("os_event_members").insert(memberPayload);
    if (memberWrite.error) throw memberWrite.error;

    const assignmentResult = await admin
      .from("os_planning_assignments")
      .select("id")
      .eq("event_id", eventId)
      .eq("template_id", templateResult.data.id)
      .maybeSingle();
    if (assignmentResult.error) throw assignmentResult.error;

    if (!assignmentResult.data) {
      const assignmentWrite = await admin.from("os_planning_assignments").insert({
        event_id: eventId,
        template_id: templateResult.data.id,
        status: "assigned",
        progress_percent: 0,
        current_section_key: "event_basics",
        settings: { source: WEDDING_COMPANION_VERSION },
      });
      if (assignmentWrite.error) throw assignmentWrite.error;
    }

    await admin.from("os_activity_events").insert({
      event_id: eventId,
      actor_user_id: user.id,
      contact_id: contactId,
      event_type: "client.portal_ready",
      visibility: "staff",
      payload: {
        summary: inviteSent ? "Wedding Hero activated and client invitation sent." : "Wedding Hero access activated for an existing client user.",
        source: WEDDING_COMPANION_VERSION,
      },
    });

    successMessage = inviteSent
      ? "Wedding Hero activated and the secure client invitation was sent."
      : "Wedding Hero activated. The client can use the Wedding Hero access page.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wedding Hero could not be activated.";
    adminRedirect(message, "error");
  }

  revalidatePath("/admin");
  adminRedirect(successMessage);
}
