import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/client-login-form";
import { WeddingHeroMark } from "@/components/wedding-hero-mark";
import { createServerSupabase } from "@/lib/supabase/server";
import { FEATURED_WEDDING_RESOURCES } from "@/lib/wedding-resources";

export const metadata = {
  title: "Wedding Hero | EVENTSible",
  description: "Plan your wedding your way with the EVENTSible Wedding Hero interactive wedding companion.",
};

type PageProps = { searchParams: Promise<{ next?: string | string[]; error?: string | string[]; method?: string | string[] }> };

const METHODS = {
  guided: {
    eyebrow: "Recommended",
    title: "Interactive Companion",
    action: "Guide me step by step",
    description: "Move through the wedding one moment at a time with helpful prompts, smart follow-ups, and save-as-you-go planning.",
    icon: "✦",
  },
  form: {
    eyebrow: "Straightforward",
    title: "Traditional Form",
    action: "Open the full form",
    description: "See the familiar planning sections together and work through them like a traditional wedding questionnaire.",
    icon: "✓",
  },
  print: {
    eyebrow: "Paper friendly",
    title: "Printable Planner",
    action: "Use the printable version",
    description: "Print or download the planner, complete it away from the screen, then return it to the same Wedding Hero workspace.",
    icon: "⇩",
  },
} as const;

type MethodKey = keyof typeof METHODS;

function methodKey(value: string | string[] | undefined): MethodKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "form" || candidate === "print" ? candidate : "guided";
}

export default async function ClientLoginPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const query = await searchParams;
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const selectedMethod = methodKey(query.method);
  const nextPath = requestedNext?.startsWith("/client") && !requestedNext.startsWith("//")
    ? requestedNext
    : `/client/start/wedding?method=${selectedMethod}`;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  if (data.user) redirect(nextPath);

  return (
    <main className="wedding-hero-entry">
      <nav className="wedding-hero-entry-nav">
        <WeddingHeroMark compact />
        <div><Link href="/client/wedding/resources">Wedding resources</Link><a href="#hero-access">Already saved online? <b>Open your private plan</b></a></div>
      </nav>

      <section className="wedding-hero-intro">
        <div className="wedding-hero-intro-copy">
          <span className="wedding-kicker">Your wedding. Your people. Your soundtrack.</span>
          <WeddingHeroMark />
          <h1>Plan the day your way.</h1>
          <p>Wedding Hero keeps your timeline, music, introductions, ceremony details, vendor information, and big ideas together without making wedding planning feel like homework.</p>
          <a className="wedding-hero-primary" href="#choose-your-way">Choose how you want to plan <span aria-hidden="true">↓</span></a>
        </div>
        <div className="wedding-hero-preview" aria-label="Wedding Hero planning preview">
          <div className="hero-preview-card hero-preview-main">
            <span>YOUR DAY AT A GLANCE</span>
            <b>Ceremony</b><small>4:30 PM · Music + cues ready</small>
            <b>Grand entrance</b><small>6:15 PM · Names + song ready</small>
            <b>First dance</b><small>6:25 PM · Song selected</small>
          </div>
          <div className="hero-preview-card hero-preview-note"><span>♫</span><b>Your must-plays</b><small>Keep every request in one place.</small></div>
          <div className="hero-preview-card hero-preview-people"><span>3</span><b>Planning together</b><small>Couple · Planner · EVENTSible</small></div>
        </div>
      </section>

      <section className="wedding-method-section" id="choose-your-way">
        <header>
          <span className="wedding-kicker">One Wedding Hero. Three ways to use it.</span>
          <h2>How would you like to plan?</h2>
          <p>Pick what feels easiest today. Your answers belong to the same Wedding Hero plan, so you can switch methods later.</p>
        </header>
        <div className="wedding-method-grid">
          {(Object.entries(METHODS) as [MethodKey, typeof METHODS[MethodKey]][]).map(([key, method], index) => (
            <article className={`wedding-method-card${key === selectedMethod ? " selected" : ""}`} key={key}>
              <div className="wedding-method-icon" aria-hidden="true">{method.icon}</div>
              <span>{method.eyebrow}</span>
              <p className="wedding-method-number">0{index + 1}</p>
              <h3>{method.title}</h3>
              <p>{method.description}</p>
              <Link href={`/client/wedding?mode=${key}`}>{method.action} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="wedding-home-resources">
        <header>
          <div><span className="wedding-kicker">Wedding Resources</span><h2>Planning help that goes beyond the DJ form.</h2></div>
          <p>Printable meeting guides, trackers, timelines, writing prompts, and idea starters for couples, planners, and the EVENTSible team.</p>
        </header>
        <div>
          {FEATURED_WEDDING_RESOURCES.map((resource) => (
            <article key={resource.slug}>
              <span className="wedding-resource-icon" aria-hidden="true">{resource.icon}</span>
              <div><small>{resource.badge}</small><h3>{resource.shortTitle}</h3><p>{resource.description}</p></div>
              <Link href={`/client/wedding/resources/${resource.slug}`} aria-label={`Open ${resource.title}`}>→</Link>
            </article>
          ))}
        </div>
        <Link className="wedding-resource-library-link" href="/client/wedding/resources">Explore all Wedding Hero resources <span aria-hidden="true">→</span></Link>
      </section>

      <section className="wedding-hero-access" id="hero-access">
        <div className="wedding-access-copy">
          <span className="wedding-kicker">Optional private access</span>
          <h2>Want your plan on every device?</h2>
          <p>You can plan without signing in. Use a private email link only when you want to reopen an online plan, save across devices, or add collaborators later.</p>
          <ul>
            <li>Planning starts before any email screen</li>
            <li>No password and no payment required</li>
            <li>Booked, GigSalad, and potential clients are welcome</li>
          </ul>
        </div>
        <div className="wedding-access-form-card">
          <span className="wedding-kicker">Only if you want it</span>
          <h3>Open a private saved plan</h3>
          {error ? <div className="alert error">That link could not be completed. Request a fresh one below.</div> : null}
          <ClientLoginForm nextPath={nextPath} />
        </div>
      </section>

      <footer className="wedding-hero-footer">
        <WeddingHeroMark compact />
        <p>Powered by EVENTSible · Excellence in Event Entertainment</p>
      </footer>
    </main>
  );
}
