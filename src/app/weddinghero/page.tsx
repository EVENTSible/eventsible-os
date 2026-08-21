import Link from "next/link";
import { ClientLoginForm } from "@/components/client-login-form";
import { WeddingHeroMark } from "@/components/wedding-hero-mark";
import { FEATURED_WEDDING_RESOURCES } from "@/lib/wedding-resources";
import styles from "./weddinghero-home.module.css";

export const metadata = {
  title: "Wedding Hero | EVENTSible",
  description: "Plan your wedding your way with the EVENTSible Wedding Hero interactive wedding companion.",
};

type PageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    method?: string | string[];
  }>;
};

const METHODS = {
  guided: {
    eyebrow: "Recommended",
    title: "Interactive Companion",
    action: "Guide me step by step",
    description: "Answer one clear question at a time with helpful prompts and smart follow-ups.",
    icon: "✦",
  },
  form: {
    eyebrow: "Everything together",
    title: "Traditional Form",
    action: "Open the full form",
    description: "See every planning section together and complete the familiar wedding questionnaire view.",
    icon: "✓",
  },
  print: {
    eyebrow: "Paper friendly",
    title: "Printable Planner",
    action: "Use the printable version",
    description: "Print or save the planner as a PDF, work offline, and upload the completed copy later.",
    icon: "⇩",
  },
} as const;

type MethodKey = keyof typeof METHODS;

function EventsibleBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-label="EVENTSible, Excellence in Event Entertainment"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: "0 0 auto",
        minWidth: compact ? 104 : 164,
        padding: compact ? "5px 7px" : "8px 10px 7px",
        borderRadius: compact ? 14 : 18,
        background: "linear-gradient(135deg, rgba(248,201,111,.36), rgba(255,255,255,.76) 48%, rgba(44,120,163,.14))",
        boxShadow: "inset 0 0 0 1px rgba(20,52,95,.08)",
        color: "#14345f",
        lineHeight: 1,
        transform: "skew(-4deg)",
      }}
    >
      <span
        style={{
          color: "#14345f",
          display: "block",
          fontSize: compact ? "1rem" : "1.62rem",
          fontWeight: 1000,
          letterSpacing: "-.055em",
          textShadow: "2px 2px 0 rgba(248,201,111,.9), 3px 3px 0 rgba(44,120,163,.28)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "#f8c96f",
            display: "inline-block",
            marginRight: 1,
            textShadow: "2px 2px 0 #14345f, 4px 4px 0 #2c78a3",
            transform: "scale(1.18) skew(-6deg)",
            transformOrigin: "bottom left",
          }}
        >
          E
        </span>
        VENT<span style={{ color: "#2c78a3" }}>SIBLE</span>
      </span>
      {compact ? null : (
        <span
          style={{
            color: "#dd6f72",
            display: "block",
            fontSize: ".46rem",
            fontWeight: 1000,
            letterSpacing: ".06em",
            marginTop: 4,
            textShadow: ".7px .7px 0 rgba(255,255,255,.8)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Excellence in Event Entertainment
        </span>
      )}
    </span>
  );
}

function methodKey(value: string | string[] | undefined): MethodKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "form" || candidate === "print" ? candidate : "guided";
}

export default async function WeddingHeroHome({ searchParams }: PageProps) {
  const query = await searchParams;
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const selectedMethod = methodKey(query.method);
  const nextPath = requestedNext?.startsWith("/client") && !requestedNext.startsWith("//")
    ? requestedNext
    : `/client/start/wedding?method=${selectedMethod}`;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const heroResources = FEATURED_WEDDING_RESOURCES.slice(0, 3);

  return (
    <main className={`${styles.scope} wedding-hero-entry wedding-hero-home`}>
      <nav className="wedding-hero-entry-nav">
        <Link className="wedding-hero-brand-lockup" href="/weddinghero" aria-label="EVENTSible Wedding Hero home">
          <EventsibleBrandMark compact />
          <WeddingHeroMark compact />
        </Link>
        <div>
          <Link href="/client/wedding/resources">Wedding resources</Link>
          <a href="#hero-access">Already saved online? <b>Open your private plan</b></a>
        </div>
      </nav>

      <section className="wedding-hero-intro">
        <div className="wedding-hero-intro-copy">
          <span className="wedding-kicker">Your wedding. Your people. Your soundtrack.</span>
          <div className="wedding-hero-intro-brand">
            <EventsibleBrandMark />
            <WeddingHeroMark />
          </div>
          <h1>Plan the day your way.</h1>
          <p>Wedding Hero keeps your timeline, music, introductions, ceremony details, vendor information, and big ideas together. It also gives you practical planning resources, including meeting guides, budget and guest trackers, day-of timelines, vow prompts, song ideas, and printable helpers, without making wedding planning feel like homework.</p>
          <div className="wedding-hero-resource-callout">
            <div>
              <span className="wedding-kicker">Plan it. Organize it. Make it yours.</span>
              <p>The companion and resource library work together, so the celebration and the practical details stay in one place.</p>
            </div>
            <div className="wedding-hero-resource-links">
              {heroResources.map((resource) => (
                <Link key={resource.slug} href={`/client/wedding/resources/${resource.slug}`}>
                  <span aria-hidden="true">{resource.icon}</span>{resource.shortTitle}
                </Link>
              ))}
              <Link className="all-resources" href="/client/wedding/resources">See all resources <span aria-hidden="true">→</span></Link>
            </div>
          </div>
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
          <div className="hero-preview-card hero-preview-resources"><span>✦</span><b>Guides + trackers</b><small>Budget, guests, vendors, vows + more.</small></div>
        </div>
      </section>

      <section className="wedding-method-section" id="choose-your-way">
        <div className="wedding-method-heading">
          <header>
            <span className="wedding-kicker">One Wedding Hero. Three ways to use it.</span>
            <h2>How would you like to plan?</h2>
            <p>Pick what feels easiest today. You can switch methods later without starting over.</p>
          </header>
          <aside className="wedding-method-help">
            <span>Need planning help?</span>
            <b>Start with Interactive.</b>
            <p>It breaks the work into small steps. Full Form is best for a complete overview, and Printable is best for paper or an in-person meeting.</p>
          </aside>
        </div>

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

      <section className="wedding-home-resources" id="wedding-resources">
        <header>
          <div>
            <span className="wedding-kicker">Wedding resources</span>
            <h2>Planning help beyond the DJ form.</h2>
          </div>
          <p>Use these practical guides, trackers, timelines, and writing prompts on your own or during calls and meetings with your planner and EVENTSible.</p>
        </header>

        <div>
          {FEATURED_WEDDING_RESOURCES.map((resource) => (
            <article key={resource.slug}>
              <div className="wedding-resource-icon" aria-hidden="true">{resource.icon}</div>
              <div>
                <small>{resource.badge}</small>
                <h3>{resource.shortTitle}</h3>
                <p>{resource.description}</p>
              </div>
              <Link href={`/client/wedding/resources/${resource.slug}`} aria-label={`Open ${resource.title}`}>→</Link>
            </article>
          ))}
        </div>

        <Link className="wedding-resource-library-link" href="/client/wedding/resources">
          Explore all Wedding Hero resources <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="wedding-hero-access" id="hero-access">
        <div className="wedding-access-copy">
          <span className="wedding-kicker">Optional private access</span>
          <h2>Save online only when you want to.</h2>
          <p>Start planning with no account or email. Use a private email link later when you want cross-device access, an online saved plan, or collaborators.</p>
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
        <div className="wedding-hero-footer-brand">
          <EventsibleBrandMark compact />
          <WeddingHeroMark compact />
        </div>
        <p>Powered by EVENTSible · Excellence in Event Entertainment</p>
      </footer>
    </main>
  );
}
