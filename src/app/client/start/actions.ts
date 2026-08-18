"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  cleanText,
  normalizeEmail,
  normalizeHeroStartInput,
  splitDisplayName,
} from "@/lib/hero-self-start.mjs";

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function startRedirect(heroKey: string, message: string): never {
  const safeHero = heroKey === "wedding" ? "wedding" : "event";
  redirect(`/client/start/${safeHero}?error=${encodeURIComponent(message)}`);
}

function planningMethod(value: string) {
  return value === "form" || value === "print" ? value : "guided";
}

export async function startHeroWorkspaceAction(formData: FormData) {
  const heroKey = cleanText(formValue(formData, "hero_key"), 20);
  const selectedPlanningMethod = planningMethod(cleanText(formValue(formData, "planning_method"), 20));
  const normalized = normalizeHeroStartInput(heroKey, {
    clientName: formValue(formData, "client_name"),
    phone: formValue(formData, "phone"),
    eventTitle: formValue(formData, "event_title"),
    eventType: formValue(formData, "event_type"),
    startsAt: formValue(formData, "starts_at"),
    venueName: formValue(formData, "venue_name"),
    city: formValue(formData, "city"),
    relationship: formValue(formData, "relationship"),
  });
  if (!normalized.ok || !normalized.data) startRedirect(heroKey, normalized.message ?? "Your event setup was incomplete.");

  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  const email = normalizeEmail(user?.email);
  if (!user || !email) redirect(`/client/login?error=${encodeURIComponent("Verify your email before starting an event workspace.")}`);

  const admin = createAdminSupabase();
  const input = normalized.data!;
  const now = new Date().toISOString();
  const linkedContactResult = await admin
    .from("os_contact_users")
    .select("contact_id")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (linkedContactResult.error) startRedirect(heroKey, "Your client profile could not be checked. Please try again.");

  let contactId = linkedContactResult.data?.contact_id ?? null;
  if (!contactId) {
    const existingContactResult = await admin
      .from("os_contacts")
      .select("id")
      .ilike("primary_email", email)
      .limit(1)
      .maybeSingle();
    if (existingContactResult.error) startRedirect(heroKey, "Your client profile could not be matched. Please try again.");
    contactId = existingContactResult.data?.id ?? null;
  }

  if (!contactId) {
    const name = splitDisplayName(input.clientName);
    const contactWrite = await admin.from("os_contacts").insert({
      first_name: name.firstName,
      last_name: name.lastName,
      display_name: name.displayName,
      primary_email: email,
      primary_phone: input.phone,
      source: "hero_self_start",
      status: "active",
      metadata: {
        source: "hero_self_start",
        verified_email: true,
        auth_user_id: user.id,
      },
      created_by: user.id,
    }).select("id").single();
    if (contactWrite.error || !contactWrite.data) startRedirect(heroKey, "Your client profile could not be created. Please try again.");
    contactId = contactWrite.data.id;
  }

  const contactLink = await admin.from("os_contact_users").upsert({
    contact_id: contactId,
    user_id: user.id,
    relationship: "self",
    is_primary: true,
  }, { onConflict: "contact_id,user_id" });
  if (contactLink.error) startRedirect(heroKey, "Your secure client access could not be connected. Please try again.");

  const templateResult = await admin
    .from("os_planning_templates")
    .select("id")
    .eq("slug", input.hero.templateSlug)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (templateResult.error || !templateResult.data) startRedirect(heroKey, `${input.hero.title} is temporarily unavailable.`);

  const eventWrite = await admin.from("os_events").insert({
    primary_contact_id: contactId,
    title: input.eventTitle,
    event_type: input.eventType,
    status: "inquiry",
    starts_at: input.startsAt,
    timezone: "America/Indiana/Indianapolis",
    venue_name: input.venueName,
    venue_city: input.city,
    source: "hero_self_start",
    settings: {
      hero_self_start: true,
      declared_relationship: input.relationship,
      requested_hero: input.hero.templateName,
      requested_planning_method: selectedPlanningMethod,
      verified_email: email,
    },
    created_by: user.id,
  }).select("id").single();
  if (eventWrite.error || !eventWrite.data) startRedirect(heroKey, "Your event workspace could not be created. Please try again.");
  const eventId = eventWrite.data.id;

  const memberWrite = await admin.from("os_event_members").insert({
    event_id: eventId,
    user_id: user.id,
    contact_id: contactId,
    member_role: "client",
    permissions: { planning: "edit", source: "hero_self_start" },
    is_active: true,
    invited_at: now,
    accepted_at: now,
  });
  if (memberWrite.error) startRedirect(heroKey, "The event was started, but secure workspace access could not be completed. Contact EVENTSible.");

  const assignmentWrite = await admin.from("os_planning_assignments").insert({
    event_id: eventId,
    template_id: templateResult.data.id,
    status: "assigned",
    progress_percent: 0,
    current_section_key: "event_basics",
    settings: {
      source: "hero_self_start",
      declared_relationship: input.relationship,
      needs_staff_review: true,
      requested_planning_method: selectedPlanningMethod,
    },
  }).select("id").single();
  if (assignmentWrite.error || !assignmentWrite.data) startRedirect(heroKey, "The event was started, but the planning form could not be opened. Contact EVENTSible.");

  const leadWrite = await admin.from("os_leads").insert({
    contact_id: contactId,
    event_id: eventId,
    status: "new",
    source: "hero_self_start",
    inquiry_summary: `${input.hero.title} self-start from a ${input.relationship} client.`,
    metadata: {
      declared_relationship: input.relationship,
      planning_assignment_id: assignmentWrite.data.id,
      verified_email: email,
    },
  });

  await admin.from("os_activity_events").insert({
    event_id: eventId,
    contact_id: contactId,
    actor_user_id: user.id,
    event_type: "client.hero_self_started",
    visibility: "staff",
    payload: {
      summary: `${input.hero.title} started by a verified client.`,
      declared_relationship: input.relationship,
      lead_created: !leadWrite.error,
      requested_planning_method: selectedPlanningMethod,
      source: "hero_self_start",
    },
  });

  revalidatePath("/client");
  revalidatePath("/admin");
  const modeQuery = input.hero.key === "wedding" ? `?mode=${selectedPlanningMethod}` : "";
  redirect(`/client/${input.hero.routeSegment}/${eventId}${modeQuery}`);
}
