import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientLogoutButton } from "@/components/client-logout-button";
import { EventHeroQuestionnaire, type EventHeroSection } from "@/components/event-hero-questionnaire";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Event Hero | EVENTSible" };
type PageProps = { params: Promise<{ eventId: string }> };

function formatDate(value: unknown) {
  if (!value) return "Date being finalized";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "full", timeStyle: "short" }).format(new Date(String(value)));
}

export default async function EventHeroPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect(`/client/login?next=/client/event/${eventId}`);

  const eventResult = await supabase
    .from("os_client_portal_v")
    .select("event_id,title,event_type,starts_at,venue_name,assignment_id,planning_template_name,planning_status,progress_percent")
    .eq("event_id", eventId)
    .eq("planning_template_name", "Event Hero")
    .maybeSingle();
  if (eventResult.error || !eventResult.data?.assignment_id) notFound();

  const assignmentResult = await supabase
    .from("os_planning_assignments")
    .select("id,template_id,status,progress_percent,current_section_key")
    .eq("id", eventResult.data.assignment_id)
    .eq("event_id", eventId)
    .maybeSingle();
  if (assignmentResult.error || !assignmentResult.data) notFound();

  const sectionResult = await supabase
    .from("os_planning_sections")
    .select("id,section_key,title,description,sort_order")
    .eq("template_id", assignmentResult.data.template_id)
    .order("sort_order");
  if (sectionResult.error) notFound();
  const sectionIds = (sectionResult.data ?? []).map((section) => section.id);

  const [questionResult, answersResult] = await Promise.all([
    sectionIds.length
      ? supabase.from("os_planning_questions").select("id,section_id,question_key,label,help_text,field_type,is_required,sort_order,options").in("section_id", sectionIds).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("os_planning_answers").select("question_key,value").eq("assignment_id", assignmentResult.data.id),
  ]);

  const sections: EventHeroSection[] = (sectionResult.data ?? []).map((section) => ({
    id: section.id,
    key: section.section_key,
    title: section.title,
    description: section.description,
    questions: (questionResult.data ?? []).filter((question) => question.section_id === section.id).map((question) => ({
      id: question.id,
      key: question.question_key,
      label: question.label,
      helpText: question.help_text,
      fieldType: question.field_type,
      required: question.is_required,
      options: Array.isArray(question.options) ? question.options.map(String) : [],
    })),
  }));
  const initialAnswers = Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.value]));

  return (
    <div className="client-shell wedding-shell">
      <nav className="client-nav">
        <div><Wordmark compact /><span>Event Hero</span></div>
        <div className="client-nav-actions"><Link href="/client">My events</Link><ClientLogoutButton /></div>
      </nav>
      <header className="wedding-hero event-hero-header">
        <div><span className="eyebrow">Event Hero by EVENTSible</span><h1>{eventResult.data.title ?? "Your event"}</h1><p>{formatDate(eventResult.data.starts_at)} · {eventResult.data.venue_name ?? "Venue details coming soon"}</p></div>
        <div className="wedding-save-promise"><b>Save and return anytime</b><span>Your private answers stay connected to your event and the EVENTSible team.</span></div>
      </header>
      {questionResult.error || answersResult.error ? <div className="alert error event-hero-alert">Event Hero details could not be fully loaded. Contact EVENTSible before making changes.</div> : null}
      <EventHeroQuestionnaire
        eventId={eventId}
        assignmentId={assignmentResult.data.id}
        sections={sections}
        initialAnswers={initialAnswers}
        initialProgress={assignmentResult.data.progress_percent ?? 0}
        initialSectionKey={assignmentResult.data.current_section_key}
        initialStatus={assignmentResult.data.status}
      />
    </div>
  );
}
