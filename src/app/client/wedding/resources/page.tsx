import Link from "next/link";
import { WeddingHeroMark } from "@/components/wedding-hero-mark";
import { WEDDING_RESOURCES } from "@/lib/wedding-resources";

export const metadata = {
  title: "Wedding Resources | Wedding Hero",
  description: "Free wedding planning worksheets, guides, trackers, timelines, song ideas, and printable resources from EVENTSible Wedding Hero.",
};

export default function WeddingResourcesPage() {
  return (
    <main className="wedding-resource-hub">
      <nav className="wedding-resource-nav">
        <Link href="/client/login"><WeddingHeroMark compact /></Link>
        <div><Link href="/client/wedding?mode=guided">Open the planner</Link><Link href="/client/login">Wedding Hero home</Link></div>
      </nav>
      <header className="wedding-resource-hero">
        <div>
          <span className="wedding-kicker">Wedding Hero Resources</span>
          <h1>Helpful tools for the decisions outside the questionnaire.</h1>
          <p>Use these guides together during planning calls, venue meetings, date nights, or the final wedding-week scramble. Every worksheet works without an account, saves on this device, and prints cleanly.</p>
        </div>
        <aside><b>Start with the Meeting Companion</b><p>It is the best all-in-one agenda for keeping a couple, planner, venue, and EVENTSible on the same page.</p><Link href="/client/wedding/resources/meeting-companion">Open the meeting guide →</Link></aside>
      </header>
      <section className="wedding-resource-library">
        <header><span className="wedding-kicker">The planning library</span><h2>Pick the tool you need today.</h2></header>
        <div className="wedding-resource-grid">
          {WEDDING_RESOURCES.map((resource) => (
            <article className={resource.slug === "meeting-companion" ? "featured" : ""} key={resource.slug}>
              <div className="wedding-resource-icon" aria-hidden="true">{resource.icon}</div>
              <span>{resource.category} · {resource.badge}</span>
              <h3>{resource.shortTitle}</h3>
              <p>{resource.description}</p>
              <Link href={`/client/wedding/resources/${resource.slug}`}>{resource.guestbook ? "Open the guestbook starter" : "Open printable worksheet"} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="wedding-resource-collab-note">
        <div><span className="wedding-kicker">Collaboration roadmap</span><h2>Shared planning is the next layer.</h2></div>
        <p>These resources currently save on the device being used. Shared links, edit/view permissions, guest submissions, moderation, and one combined cloud workspace will be added with Wedding Hero collaboration. They are not being faked with an email gate.</p>
      </section>
      <footer className="wedding-hero-footer"><WeddingHeroMark compact /><p>Powered by EVENTSible · Excellence in Event Entertainment</p></footer>
    </main>
  );
}
