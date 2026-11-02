import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authorizeHqCapability } from "@/lib/hq-auth";
import { buildWeddingOperations } from "@/lib/wedding-operations.mjs";

export const metadata = { title: "Wedding operations review | EVENTSible HQ", robots: { index: false, follow: false } };

export default async function WeddingOperationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeHqCapability("hq.read");
  if (!auth.ok) redirect(auth.reason === "unauthenticated" ? "/login" : "/access-denied");
  const { eventId } = await params;
  const { supabase } = auth;
  const eventResult = await supabase.from("os_event_dashboard_v").select("event_id,title,event_status,assignment_id,planning_template_name,booked_services").eq("event_id", eventId).eq("planning_template_name", "Wedding Hero").maybeSingle();
  if (eventResult.error) return <div className="review-main"><h1>Wedding operations unavailable</h1><p>The event could not be verified. No record was changed.</p></div>;
  if (!eventResult.data?.assignment_id) notFound();
  const event = eventResult.data;
  const [assignmentResult, answersResult, tasksResult] = await Promise.all([
    supabase.from("os_planning_assignments").select("id,event_id,submitted_at,status").eq("id", event.assignment_id).eq("event_id", eventId).maybeSingle(),
    supabase.from("os_planning_answers").select("question_key,value").eq("assignment_id", event.assignment_id),
    supabase.from("os_tasks").select("id,title,status,metadata").eq("event_id", eventId),
  ]);
  if (assignmentResult.error || answersResult.error || tasksResult.error || !assignmentResult.data) return <div className="review-main"><h1>Wedding operations unavailable</h1><p>The linked plan or task list could not be verified. No record was changed.</p></div>;
  const services = Array.isArray(event.booked_services) ? event.booked_services.map((service: { code?: string }) => ({ service_code: service.code ?? "" })) : [];
  const packet = buildWeddingOperations({ event: { id: eventId, status: event.event_status }, assignment: assignmentResult.data, answers: Object.fromEntries((answersResult.data ?? []).map(row => [row.question_key, row.value])), services, tasks: tasksResult.data ?? [] });
  return <div className="review-main">
    <header className="review-header"><div><span className="eyebrow">Private operations review</span><h1>{event.title ?? "Wedding"}</h1><p>Read-only projection of the saved Wedding Hero answers. Nothing is created, published or sent.</p></div><Link className="secondary-button" href={`/admin/wedding/${eventId}`}>Back to Wedding Hero review</Link></header>
    <p>Submitted: {packet.submittedAt ?? "Not submitted"}. {packet.provenance}</p>
    <p>Source version: <code>{packet.sourceDigest.slice(0, 16)}</code></p>
    {packet.reviewWarnings.length ? <section className="review-section"><h2>Owner confirmations</h2><ul>{packet.reviewWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section> : null}
    <section className="review-section"><h2>Day-of sequence</h2><p>Clock times retain the client’s input. Confirm timezone and contracted coverage before use.</p><ol>{packet.timeline.map((row, i) => <li key={`${row.sourceKey}-${i}`}><b>{row.time ?? "NEEDS CONFIRMATION"} · {row.moment}</b><p>{row.people} {row.notes}</p></li>)}</ol></section>
    <section className="review-section"><h2>Music preparation</h2><p>Client requests, not verified local files. A recording version and cue point still need review.</p><ul>{packet.music.map(row => <li key={row.sourceKey}><b>{row.moment}: {row.title}</b> · {row.artist || "Artist needs confirmation"}<p>{row.group} · {row.approval} · {row.version || "Version needs confirmation"} · {row.cue} {row.fade} {row.notes}</p></li>)}</ul></section>
    <section className="review-section"><h2>Task suggestions — review only</h2><p>Review existing tasks for duplicates before creating anything. Opening this page never creates tasks or notifies staff.</p><ul>{packet.tasks.map(task => <li key={task.key}><b>{task.title}</b> · {task.status}</li>)}</ul><p>{tasksResult.data?.length ?? 0} existing event-linked tasks.</p><ul>{(tasksResult.data ?? []).map(task => <li key={task.id}>{task.title} · {task.status}</li>)}</ul></section>
    {packet.sheet.sections.map(section => <section className="review-section" key={section.title}><h2>{section.title}</h2><dl>{section.items.map((item: { label: string; value: string }) => <div key={item.label}><dt>{item.label}</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.value}</dd></div>)}</dl></section>)}
  </div>;
}
