import { redirect } from "next/navigation";
import {
  createManualImportCandidateAction,
  importExistingGigAction,
  reviewImportCandidateAction,
  syncGigSaladCandidatesAction,
} from "@/app/admin/imports/actions";
import { ExistingGigImportReview } from "@/components/existing-gig-import-review";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { HQ_CALENDAR_TIME_ZONE, localDateKey } from "@/lib/hq-calendar.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Existing Gig Intake | EVENTSible HQ" };

type CandidateRow = {
  id: string;
  contract_version: string;
  source: string;
  external_reference: string;
  proposed_data: Record<string, unknown>;
  review_status: string;
  matched_event_id: string | null;
  imported_event_id: string | null;
  imported_contact_id: string | null;
  imported_booking_id: string | null;
  created_at: string;
};

function label(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function eventLabel(row: Record<string, unknown>) {
  const title = label(row.title, "Untitled event");
  if (!row.starts_at) return `${title} · date missing`;
  try {
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: label(row.timezone, HQ_CALENDAR_TIME_ZONE),
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(String(row.starts_at)));
    return `${title} · ${date}`;
  } catch {
    return `${title} · date unavailable`;
  }
}

export default async function ExistingGigIntakePage() {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");
  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/login?error=access");

  const [candidateResult, contactResult, serviceResult, eventResult] = await Promise.all([
    supabase
      .from("os_event_import_candidates")
      .select("id,contract_version,source,external_reference,proposed_data,review_status,matched_event_id,imported_event_id,imported_contact_id,imported_booking_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("os_contacts")
      .select("id,display_name,first_name,last_name,organization_name,primary_email,primary_phone")
      .eq("status", "active")
      .order("display_name", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("os_service_catalog")
      .select("id,code,name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("os_event_dashboard_v")
      .select("event_id,title,starts_at,timezone")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(300),
  ]);

  const warnings = [
    candidateResult.error ? "Import candidates could not be loaded." : null,
    contactResult.error ? "Canonical contacts could not be loaded." : null,
    serviceResult.error ? "Canonical services could not be loaded." : null,
    eventResult.error ? "Existing events could not be loaded for matching." : null,
  ].filter(Boolean);

  const contacts = (contactResult.data ?? []).map((row) => ({
    id: row.id,
    label: label(row.display_name, [row.first_name, row.last_name].filter(Boolean).join(" ") || label(row.organization_name, "Unnamed contact")),
    email: row.primary_email,
    phone: row.primary_phone,
  }));
  const services = (serviceResult.data ?? []).map((row) => ({ id: row.id, code: row.code, name: row.name }));
  const events = (eventResult.data ?? []).filter((row) => row.event_id).map((row) => ({ id: row.event_id as string, label: eventLabel(row), startsAt: row.starts_at }));
  const todayKey = localDateKey(new Date(), HQ_CALENDAR_TIME_ZONE) ?? new Date().toISOString().slice(0, 10);

  return <div className="admin-shell intake-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><Wordmark compact /><span>Operating System</span></div>
      <nav>
        <a href="/admin">Mission Control</a>
        <a href="/admin/calendar">Calendar / Date Book</a>
        <a className="active" href="/admin/imports">Existing Gig Intake</a>
        <a href="/admin#lead-review">Lead Review</a>
        <a href="/admin#gig-workspace">Booked Gigs</a>
      </nav>
      <div className="sidebar-footer"><span className="role-pill">{String(role)}</span><LogoutButton /></div>
    </aside>
    <main className="admin-main intake-main">
      <header className="admin-header intake-header">
        <div><span className="eyebrow">Existing Gig Intake / Import Review</span><h1>Review first. Import once. Keep one canonical gig.</h1><p>Manual and future source adapters create bounded staff-private proposals. Only an explicit Import as New Gig decision creates the canonical contact, event, confirmed booking, services, and workspace.</p></div>
        <div className="header-actions"><a className="secondary-button" href="/admin/calendar">Calendar</a><a className="primary-button" href="/admin">Mission Control</a></div>
      </header>
      {warnings.length ? <div className="alert warning"><b>Some review data is unavailable.</b>{warnings.map((warning) => <p key={warning}>{warning}</p>)}<p>No import will be represented as safe while required canonical data is unavailable.</p></div> : null}
      <ExistingGigImportReview
        candidates={(candidateResult.data ?? []) as CandidateRow[]}
        contacts={contacts}
        createAction={createManualImportCandidateAction}
        events={events}
        gigsaladConfigured={Boolean(process.env.GIGSALAD_ICAL_FEED_URL?.trim())}
        importAction={importExistingGigAction}
        reviewAction={reviewImportCandidateAction}
        services={services}
        syncGigSaladAction={syncGigSaladCandidatesAction}
        todayKey={todayKey}
      />
    </main>
  </div>;
}
