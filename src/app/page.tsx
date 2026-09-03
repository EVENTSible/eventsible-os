import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "EVENTSible | Choose your next step",
  description: "Plan, build, celebrate, or join an EVENTSible experience.",
};

const visitorRoutes = [
  { eyebrow: "Explore", title: "Plan an event", description: "See services, ideas, and planning paths for your celebration.", href: "https://eventsible.info/discover", icon: "✦" },
  { eyebrow: "Create", title: "Build my event", description: "Start shaping an event package around what matters to you.", href: "https://build.eventsible.info/build?start=choose", icon: "+" },
  { eyebrow: "Weddings", title: "Wedding planning", description: "Open Wedding Hero and turn your priorities into a clear plan.", href: "/weddinghero", icon: "♥" },
  { eyebrow: "Right now", title: "Join a live event", description: "Enter the live party experience from your phone or device.", href: "https://eventsible.app/", icon: "▶" },
] as const;

export default function HomePage() {
  return (
    <main className="front-door">
      <header className="front-door-header">
        <Wordmark />
        <a className="front-door-help-link" href="https://eventsible.info/fast-track">Contact &amp; quick quote</a>
      </header>

      <div className="front-door-content">
        <section className="front-door-intro" aria-labelledby="front-door-title">
          <p className="front-door-kicker">Your EVENTSible front door</p>
          <h1 id="front-door-title">What are you here to do?</h1>
          <p className="front-door-lede">Plan it. Build it. Celebrate it. Run it. Choose the path that fits where you are today.</p>
        </section>

        <section className="front-door-routes" aria-label="Choose your EVENTSible experience">
          {visitorRoutes.map((route) => {
            const content = (
              <>
                <span className="front-door-route-icon" aria-hidden="true">{route.icon}</span>
                <span className="front-door-route-copy">
                  <span className="front-door-route-eyebrow">{route.eyebrow}</span>
                  <strong>{route.title}</strong>
                  <span>{route.description}</span>
                </span>
                <span className="front-door-route-arrow" aria-hidden="true">→</span>
              </>
            );
            return route.href.startsWith("/") ? (
              <Link className="front-door-route" href={route.href} key={route.title}>{content}</Link>
            ) : (
              <a className="front-door-route" href={route.href} key={route.title}>{content}</a>
            );
          })}
        </section>

        <section className="front-door-support" aria-labelledby="current-client-title">
          <div>
            <p className="front-door-kicker">Current clients</p>
            <h2 id="current-client-title">Already working with EVENTSible?</h2>
            <p>Use the planning link we sent you, or jump into one of the current options below.</p>
          </div>
          <div className="front-door-support-actions">
            <Link href="/weddinghero">Open Wedding Hero</Link>
            <a href="https://eventsible.info/fast-track">Get help from EVENTSible</a>
          </div>
        </section>

        <section className="front-door-contact" aria-labelledby="front-door-contact-title">
          <div>
            <p className="front-door-kicker">A real person can help</p>
            <h2 id="front-door-contact-title">Not sure where to start?</h2>
          </div>
          <div className="front-door-contact-actions">
            <a href="tel:+15742745213">Call EVENTSible</a>
            <a href="sms:+15742745213">Text EVENTSible</a>
            <a href="https://eventsible.info/fast-track">Quick quote &amp; contact</a>
          </div>
        </section>

        <aside className="front-door-staff" aria-labelledby="front-door-staff-title">
          <div>
            <p className="front-door-kicker">EVENTSible staff</p>
            <h2 id="front-door-staff-title">Heading to HQ?</h2>
            <p>Secure staff access for event operations and planning.</p>
          </div>
          <Link className="front-door-staff-link" href="/admin">Open HQ</Link>
        </aside>
      </div>

      <footer className="front-door-footer">
        <span>Excellence in Event Entertainment</span>
        <a href="https://eventsible.info/">Explore EVENTSible services</a>
      </footer>
    </main>
  );
}
