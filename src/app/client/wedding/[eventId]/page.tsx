import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientLogoutButton } from "@/components/client-logout-button";
import { WeddingQuestionnaire } from "@/components/wedding-questionnaire";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Wedding Companion | EVENTSible" };

type PageProps = { params: Promise<{ eventId: string }> };

function formatDate(value: unknown) {
  if (!value) return "Date being finalized";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

export default async function WeddingCompanionPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect(`/client/login`);

  const eventResult = await supabase
    .from("os_client_portal_v")
    .select("event_id,title,event_type,starts_at,venue_name,assignment_id,planning_template_name,planning_status,progress_percent")
    .eq("event_id", eventId)
    .eq("planning_template_name", "Wedding Hero")
    .maybeSingle();
  if (eventResult.error || !eventResult.data) notFound();

  const assignmentId = String(eventResult.data.assignment_id ?? "");
  if (!assignmentId) notFound();

  const assignmentResult = await supabase
    .from("os_planning_assignments")
    .select("id,status,progress_percent,current_section_key")
    .eq("id", assignmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (assignmentResult.error || !assignmentResult.data) notFound();

  const answersResult = await supabase
    .from("os_planning_answers")
    .select("question_key,value")
    .eq("assignment_id", assignmentResult.data.id);
  const initialAnswers = Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.value]));

  return (
    <div className="client-shell wedding-shell">
      <nav className="client-nav">
        <div><Wordmark compact /><span>Wedding Companion</span></div>
        <div className="client-nav-actions"><Link href="/client">My events</Link><ClientLogoutButton /></div>
      </nav>
      <header className="wedding-hero">
        <div>
          <span className="eyebrow">Wedding Hero by EVENTSible</span>
          <h1>{eventResult.data.title ?? "Your wedding"}</h1>
          <p>{formatDate(eventResult.data.starts_at)} · {eventResult.data.venue_name ?? "Venue details coming soon"}</p>
        </div>
        <div className="wedding-save-promise"><b>Save and return anytime</b><span>Your answers automatically stay connected to your event.</span></div>
      </header>
      {answersResult.error ? <div className="alert error">Saved answers could not be loaded. Please contact EVENTSible before making changes.</div> : null}
      <WeddingQuestionnaire
        eventId={eventId}
        assignmentId={assignmentResult.data.id}
        initialAnswers={initialAnswers}
        initialProgress={assignmentResult.data.progress_percent ?? 0}
        initialSectionKey={assignmentResult.data.current_section_key}
        initialStatus={assignmentResult.data.status}
      />
    </div>
  );
}
