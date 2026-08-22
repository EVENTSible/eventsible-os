import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";
import { answerHasValue, formatWeddingAnswer, WEDDING_SECTIONS } from "@/lib/wedding-companion.mjs";

export const metadata = { title: "Wedding Hero review | EVENTSible OS" };

type PageProps = { params: Promise<{ eventId: string }> };

function formatDate(value: unknown) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

function statusLabel(value: unknown) {
  return value ? String(value).replaceAll("_", " ") : "Not started";
}

export default async function WeddingCompanionReviewPage({ params }: PageProps) {
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
    .eq("planning_template_name", "Wedding Hero")
    .maybeSingle();
  if (eventResult.error || !eventResult.data?.assignment_id || eventResult.data.planning_template_name !== "Wedding Hero") notFound();

  const answersResult = await supabase
    .from("os_planning_answers")
    .select("question_key,value,updated_at")
    .eq("assignment_id", eventResult.data.assignment_id);
  const answers = Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.value]));
  const latestUpdate = (answersResult.data ?? []).map((row) => row.updated_at).filter(Boolean).sort().at(-1) ?? null;

  return (
    <div className="review-shell">
      <nav className="review-nav">
        <div><Wordmark compact /><span>Wedding Hero review</span></div>
        <div><Link href="/admin">Back to Mission Control</Link><Link href={`/client/wedding/${eventId}`}>Open client preview</Link></div>
      </nav>
      <main className="review-main">
        <header className="review-header">
          <div>
            <span className="eyebrow">Wedding Hero summary</span>
            <h1>{eventResult.data.title ?? "Wedding"}</h1>
            <p>{eventResult.data.primary_contact_name ?? "Client"} · {formatDate(eventResult.data.starts_at)} · {eventResult.data.venue_name ?? "Venue not set"}</p>
          </div>
          <div className="review-status">
            <b>{eventResult.data.progress_percent ?? 0}%</b>
            <span>{statusLabel(eventResult.data.planning_status)}</span>
            <small>{latestUpdate ? `Last answer ${formatDate(latestUpdate)}` : "No answers saved yet"}</small>
          </div>
        </header>

        {answersResult.error ? <div className="alert error">Wedding answers could not be loaded.</div> : null}
        <div className="review-sections">
          {WEDDING_SECTIONS.map((section) => (
            <section className="review-section" key={section.key}>
              <header><span className="eyebrow">{section.title}</span><p>{section.description}</p></header>
              <dl>
                {section.questions.map((question) => (
                  <div key={question.key} className={answerHasValue(answers[question.key]) ? "" : "unanswered"}>
                    <dt>{question.label}</dt>
                    <dd>{formatWeddingAnswer(question, answers[question.key]).split("\n").map((line: string, index: number) => <span key={`${question.key}-${index}`}>{line}</span>)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
