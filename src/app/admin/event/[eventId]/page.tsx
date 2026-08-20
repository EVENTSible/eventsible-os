import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { formatEventAnswer } from "@/lib/event-hero.mjs";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export const metadata = { title: "Event Hero review | EVENTSible OS" };
type PageProps = { params: Promise<{ eventId: string }> };

function formatDate(value: unknown) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "full", timeStyle: "short" }).format(new Date(String(value)));
}

function statusLabel(value: unknown) {
  return value ? String(value).replaceAll("_", " ") : "Not started";
}

export default async function EventHeroReviewPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");
  if (!isStaffRole(user.app_metadata?.role)) redirect("/login?error=access");

  const eventResult = await supabase
    .from("os_event_dashboard_v")
    .select("event_id,title,event_type,starts_at,venue_name,primary_contact_name,assignment_id,planning_template_name,planning_status,progress_percent")
    .eq("event_id", eventId)
    .eq("planning_template_name", "Event Hero")
    .maybeSingle();
  if (eventResult.error || !eventResult.data?.assignment_id) notFound();

  const assignmentResult = await supabase.from("os_planning_assignments").select("template_id").eq("id", eventResult.data.assignment_id).maybeSingle();
  if (assignmentResult.error || !assignmentResult.data) notFound();
  const sectionResult = await supabase.from("os_planning_sections").select("id,section_key,title,description,sort_order").eq("template_id", assignmentResult.data.template_id).order("sort_order");
  const sectionIds = (sectionResult.data ?? []).map((section) => section.id);
  const [questionResult, answersResult] = await Promise.all([
    sectionIds.length ? supabase.from("os_planning_questions").select("section_id,question_key,label,field_type,is_required,sort_order").in("section_id", sectionIds).order("sort_order") : Promise.resolve({ data: [], error: null }),
    supabase.from("os_planning_answers").select("question_key,value,updated_at").eq("assignment_id", eventResult.data.assignment_id),
  ]);
  const answers = Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.value]));
  const latestUpdate = (answersResult.data ?? []).map((row) => row.updated_at).filter(Boolean).sort().at(-1) ?? null;

  return (
    <div className="review-shell">
      <nav className="review-nav"><div><Wordmark compact /><span>Event Hero review</span></div><div><Link href="/admin">Back to Mission Control</Link><Link href={`/client/event/${eventId}`}>Open client preview</Link></div></nav>
      <main className="review-main">
        <header className="review-header">
          <div><span className="eyebrow">Event Hero summary</span><h1>{eventResult.data.title ?? "Event"}</h1><p>{eventResult.data.primary_contact_name ?? "Client"} · {formatDate(eventResult.data.starts_at)} · {eventResult.data.venue_name ?? "Venue not set"}</p></div>
          <div className="review-status"><b>{eventResult.data.progress_percent ?? 0}%</b><span>{statusLabel(eventResult.data.planning_status)}</span><small>{latestUpdate ? `Last answer ${formatDate(latestUpdate)}` : "No answers saved yet"}</small></div>
        </header>
        {sectionResult.error || questionResult.error || answersResult.error ? <div className="alert error">Event Hero answers could not be fully loaded.</div> : null}
        <div className="review-sections">{(sectionResult.data ?? []).map((section) => (
          <section className="review-section" key={section.id}>
            <header><span className="eyebrow">{section.title}</span><p>{section.description}</p></header>
            <dl>{(questionResult.data ?? []).filter((question) => question.section_id === section.id).map((question) => {
              const value = answers[question.question_key];
              const unanswered = value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length);
              return <div key={question.question_key} className={unanswered ? "unanswered" : ""}><dt>{question.label}</dt><dd>{formatEventAnswer(question, value).split("\n").map((line, index) => <span key={`${question.question_key}-${index}`}>{line}</span>)}</dd></div>;
            })}</dl>
          </section>
        ))}</div>
      </main>
    </div>
  );
}
