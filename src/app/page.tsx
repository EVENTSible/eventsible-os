import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "EVENTSible | Excellence in Event Entertainment",
  description: "Event entertainment, interactive experiences, rentals, and planning support from South Bend across the surrounding Midwest.",
};

const services = [
  ["DJ + MC", "Music, hosting, and an event flow shaped around your room."],
  ["Karaoke", "A catalog, a microphone, and a crowd ready to sing."],
  ["Weddings", "Celebration planning, music, moments, and confident execution."],
  ["Photo Booths", "Selfie and 360 experiences that keep guests involved."],
  ["Games + Trivia", "Interactive games, trivia, and musical bingo."],
  ["Kids + Creative", "Kids parties, arts and crafts, and playful activities."],
  ["Events of Every Size", "Corporate, school, festival, and community events."],
  ["Rentals + Enhancements", "Useful add-ons and event-day upgrades."],
  ["EVENTSible Live", "Live performers and entertainment built for the occasion."],
] as const;

const planningPaths = [
  { className: "event-hero", eyebrow: "Planning companion · Preview", title: "Plan an Event", description: "Work through the whole event—not just the entertainment. Event details, flow, venue logistics, guests, music, contacts, special instructions, and the easy-to-forget questions.", note: "Event Hero preview · Full public experience coming soon", href: "/eventhero", cta: "Preview Event Hero" },
  { className: "wedding-hero", eyebrow: "Wedding-specific planning", title: "Wedding Hero", description: "Organize your schedule, music, people, special moments, logistics, and preferences in a planning experience made specifically for weddings.", note: "Current public planning experience", href: "/weddinghero", cta: "Open Wedding Hero" },
  { className: "event-builder", eyebrow: "Services + quote request", title: "Build My Event", description: "Explore services and enhancements, compare package possibilities, see pricing or estimate guidance, and build a quote request.", note: "Public Event Builder", href: "https://build.eventsible.info/build?start=choose", cta: "Start Building" },
] as const;

function EventsibleLogo({ footer = false }: { footer?: boolean }) {
  return <Image className={footer ? "front-door-footer-logo" : "front-door-logo"} src="/brand/eventsible-logo.png" alt="EVENTSible — Excellence in Event Entertainment" width={1408} height={769} sizes={footer ? "132px" : "(max-width: 700px) 138px, 176px"} priority={!footer} />;
}

export default function HomePage() {
  return (
    <main className="front-door">
      <header className="front-door-header">
        <a className="front-door-brand" href="https://eventsible.info" aria-label="EVENTSible main website"><EventsibleLogo /></a>
        <Link className="front-door-hq-link" href="/admin"><span>Heading to HQ?</span><strong>Staff access</strong></Link>
      </header>

      <section className="front-door-hero" aria-labelledby="front-door-title">
        <div className="front-door-hero-copy">
          <p className="front-door-kicker">South Bend, Indiana · Serving the surrounding Midwest</p>
          <h1 id="front-door-title">Make the event feel <em>EVENTSible.</em></h1>
          <p className="front-door-tagline">Excellence in Event Entertainment.</p>
          <p className="front-door-lede">Entertainment, interactive experiences, services, rentals, and planning support—all through one adaptable team.</p>
          <div className="front-door-hero-actions">
            <a className="front-door-primary" href="https://eventsible.info">Explore EVENTSible</a>
            <a className="front-door-secondary" href="https://eventsible.info/fast-track">Get a Quick Quote</a>
            <a className="front-door-text-link" href="tel:+15742745213">Call or text <strong>(574) 274-5213</strong></a>
          </div>
        </div>
        <aside className="front-door-hero-poster" aria-label="EVENTSible promise"><span>Party Time, Excellent!</span><strong>One team.<br />More ways to celebrate.</strong><p>From the first idea to the final song, we help the plan and the party work together.</p></aside>
      </section>

      <section className="front-door-one-sheet" aria-labelledby="services-title">
        <div className="front-door-section-heading"><p className="front-door-kicker">What we bring</p><h2 id="services-title">The entertainment lineup—and the team behind it.</h2><p>Shape a single service or a multi-experience package around your event. Find complete service details at <a href="https://eventsible.info">eventsible.info</a>.</p></div>
        <div className="front-door-service-grid">{services.map(([title, description], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
        <div className="front-door-benefits" aria-label="Why work with EVENTSible"><span>One adaptable team</span><span>Flexible event packages</span><span>Interactive guest experiences</span><span>Planning + event-day support</span></div>
      </section>

      <section className="front-door-pathways" aria-labelledby="pathways-title">
        <div className="front-door-section-heading"><p className="front-door-kicker">How can we help?</p><h2 id="pathways-title">Choose the path that matches your next move.</h2><p>Planning the event and building an entertainment quote are different jobs. Start in the right place.</p></div>
        <div className="front-door-path-grid">{planningPaths.map((path) => { const content = <><span className="front-door-path-eyebrow">{path.eyebrow}</span><h3>{path.title}</h3><p>{path.description}</p><small>{path.note}</small><strong>{path.cta} <span aria-hidden="true">→</span></strong></>; return path.href.startsWith("/") ? <Link className={`front-door-path ${path.className}`} href={path.href} key={path.title}>{content}</Link> : <a className={`front-door-path ${path.className}`} href={path.href} key={path.title}>{content}</a>; })}</div>
      </section>

      <section className="front-door-now" aria-label="Current client and live event access">
        <article><span aria-hidden="true">✓</span><div><p className="front-door-kicker">Already working with us?</p><h2>Current-client help</h2><p>Use the private planning link we sent, open Wedding Hero, or reach the EVENTSible team directly.</p></div><div><Link href="/weddinghero">Wedding Hero</Link><a href="mailto:thepartys@eventsible.info">Email EVENTSible</a></div></article>
        <article><span aria-hidden="true">▶</span><div><p className="front-door-kicker">At an event right now?</p><h2>Join the live experience</h2><p>Open the current EVENTSible party, game, karaoke, or interactive guest experience.</p></div><a className="front-door-primary" href="https://eventsible.app">Join a Live Event</a></article>
      </section>

      <section className="front-door-contact" aria-labelledby="front-door-contact-title">
        <div><p className="front-door-kicker">Let’s make it happen</p><h2 id="front-door-contact-title">Tell us what you’re planning.</h2><p>Serving South Bend and surrounding Midwest areas within approximately 300 miles.</p></div>
        <div className="front-door-contact-actions"><a href="https://eventsible.info/fast-track">Quick Quote</a><a href="tel:+15742745213" aria-label="Call EVENTSible at (574) 274-5213">Call</a><a href="sms:+15742745213" aria-label="Text EVENTSible at (574) 274-5213">Text</a><a href="mailto:thepartys@eventsible.info" aria-label="Email EVENTSible at thepartys@eventsible.info">Email</a></div>
      </section>

      <footer className="front-door-footer">
        <div><EventsibleLogo footer /><p><strong>Excellence in Event Entertainment</strong><span>Indiana + the surrounding Midwest</span></p></div>
        <nav aria-label="EVENTSible gateway links"><a href="https://eventsible.info">Main website</a><a href="https://eventsible.info/fast-track">Quick Quote</a><Link href="/weddinghero">Wedding Hero</Link><Link href="/eventhero">Event Hero</Link><a href="https://build.eventsible.info/build?start=choose">Event Builder</a><Link href="/admin">Staff HQ</Link></nav>
        <address><a href="tel:+15742745213">(574) 274-5213</a><a href="mailto:thepartys@eventsible.info">thepartys@eventsible.info</a></address>
      </footer>
    </main>
  );
}
