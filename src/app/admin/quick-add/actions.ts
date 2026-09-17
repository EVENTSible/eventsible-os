"use server";

import { revalidatePath } from "next/cache";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { localDateTimeToIso } from "@/lib/team-availability.mjs";

export type QuickAddState = {
  status: "idle" | "success" | "warning" | "error";
  message: string;
  result?: Record<string, unknown>;
};

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const fail = (message: string): QuickAddState => ({ status: "error", message });

function refreshOperationalViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/data-readiness");
  revalidatePath("/admin/quick-add");
}

function rpcMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === "42501") return "Owner authorization is required.";
  if (error?.code === "23505") return "That canonical record already exists.";
  if (["22023", "22P02", "23503", "23514"].includes(String(error?.code ?? ""))) {
    return error?.message || "Check the required fields. Nothing was saved.";
  }
  return "The record could not be saved. Nothing was changed.";
}

function quickContact(form: FormData) {
  return {
    displayName: value(form, "new_contact_display_name"),
    firstName: value(form, "new_contact_first_name"),
    lastName: value(form, "new_contact_last_name"),
    organizationName: value(form, "new_contact_organization"),
    primaryEmail: value(form, "new_contact_email"),
    primaryPhone: value(form, "new_contact_phone"),
    preferredChannel: value(form, "new_contact_preferred_channel") || "email",
    notes: value(form, "new_contact_notes"),
  };
}

export async function quickAddAction(_state: QuickAddState, form: FormData): Promise<QuickAddState> {
  const auth = await authorizeHqCapability("data.readiness.manage");
  if (!auth.ok) return fail("Owner authorization is required.");

  const recordType = value(form, "record_type");
  const confirmDuplicates = value(form, "confirm_duplicates") === "true";
  let payload: Record<string, unknown>;

  if (recordType === "contact") {
    payload = {
      displayName: value(form, "display_name"),
      firstName: value(form, "first_name"),
      lastName: value(form, "last_name"),
      organizationName: value(form, "organization"),
      primaryEmail: value(form, "email"),
      primaryPhone: value(form, "phone"),
      preferredChannel: value(form, "preferred_channel") || "email",
      notes: value(form, "notes"),
    };
  } else if (recordType === "lead") {
    const followUp = value(form, "next_follow_up_at");
    const useNewContact = value(form, "contact_mode") === "new";
    payload = {
      contactId: useNewContact ? null : value(form, "contact_id"),
      newContact: useNewContact ? quickContact(form) : null,
      source: value(form, "source") || "owner_manual",
      status: value(form, "status") || "new",
      summary: value(form, "summary"),
      nextFollowUpAt: followUp ? new Date(`${followUp}T12:00:00Z`).toISOString() : null,
      notes: value(form, "notes"),
    };
  } else if (recordType === "event") {
    const date = value(form, "event_date");
    const start = value(form, "start_time");
    const end = value(form, "end_time");
    const timezone = value(form, "timezone") || "America/Indiana/Indianapolis";
    payload = {
      title: value(form, "title"),
      eventType: value(form, "event_type"),
      status: value(form, "status") || "inquiry",
      contactId: value(form, "contact_id"),
      historicalDate: date && !start ? date : null,
      startsAt: date && start ? localDateTimeToIso(`${date}T${start}`, timezone) : null,
      endsAt: date && end ? localDateTimeToIso(`${date}T${end}`, timezone) : null,
      timezone: start ? timezone : null,
      venueName: value(form, "venue_name"),
      venueAddress1: value(form, "venue_address_1"),
      venueAddress2: value(form, "venue_address_2"),
      venueCity: value(form, "venue_city"),
      venueState: value(form, "venue_state"),
      venuePostalCode: value(form, "venue_postal_code"),
      guestCount: value(form, "guest_count"),
      serviceIds: form.getAll("service_ids").map(String),
      notes: value(form, "notes"),
    };
  } else if (recordType === "booking") {
    payload = {
      eventId: value(form, "event_id"),
      status: value(form, "status") || "pending",
      contractedAmount: value(form, "contracted_amount"),
      paymentStatus: value(form, "payment_status"),
      serviceIds: form.getAll("service_ids").map(String),
      notes: value(form, "notes"),
    };
  } else if (recordType === "note") {
    payload = {
      entityType: value(form, "entity_type"),
      entityId: value(form, "entity_id"),
      body: value(form, "body"),
    };
  } else {
    return fail("Choose Contact, Lead, Gig, Booking, or Note.");
  }

  const result = await auth.supabase.rpc("os_owner_quick_add", {
    p_record_type: recordType,
    p_payload: payload,
    p_confirm_duplicates: confirmDuplicates,
  });
  if (result.error) return fail(rpcMessage(result.error));

  const data = (result.data && typeof result.data === "object" ? result.data : {}) as Record<string, unknown>;
  if (data.status === "duplicate_warning") {
    return {
      status: "warning",
      message: data.cannotOverride
        ? "This event already has a booking. Open the existing booking instead of creating another."
        : "A likely active or archived match already exists. Review it, then deliberately continue only if this is a different record.",
      result: data,
    };
  }

  refreshOperationalViews();
  const label = recordType === "event" ? "gig" : recordType;
  return { status: "success", message: `${label[0].toUpperCase()}${label.slice(1)} saved to EVENTSible HQ.`, result: data };
}
