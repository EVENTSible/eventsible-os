import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startHeroWorkspaceAction } from "@/app/client/start/actions";
import { ClientLogoutButton } from "@/components/client-logout-button";
import { Wordmark } from "@/components/wordmark";
import { HERO_RELATIONSHIPS, heroConfig } from "@/lib/hero-self-start.mjs";
import { createServerSupabase } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ hero: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

const EVENT_TYPES = ["Birthday", "Corporate Event", "Anniversary", "Graduation", "School Event", "Community Event", "Private Party", "Other"];

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const hero = heroConfig((await params).hero);
  return { title: `${hero?.title ?? "Start an event"} | EVENTSible` };
}

export default async function StartHeroPage({ params, searchParams }: PageProps) {
  const hero = heroConfig((await params).hero);
  if (!hero) notFound();

  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect(`/client/login?next=/client/start/${hero.key}`);

  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const fullName = String(authData.user.user_metadata?.full_name ?? authData.user.user_metadata?.name ?? "");

  return (
    <div className="client-shell start-hero-shell">
      <nav className="client-nav">
        <div><Wordmark compact /><span>{hero.title}</span></div>
        <div className="client-nav-actions"><Link href="/client">My events</Link><ClientLogoutButton /></div>
      </nav>
      <main className="start-hero-main">
        <header className="start-hero-header">
          <span className="eyebrow">Start your protected workspace</span>
          <h1>{hero.key === "wedding" ? "Tell us about your wedding." : "Tell us about your event."}</h1>
          <p>This quick setup works for new prospects, current clients, and legacy GigSalad bookings. Your verified email keeps your answers private.</p>
        </header>

        {error ? <div className="alert error">{error}</div> : null}
        <form action={startHeroWorkspaceAction} className="start-hero-form">
          <input type="hidden" name="hero_key" value={hero.key} />
          <section>
            <div><span className="eyebrow">You</span><h2>Who is planning?</h2></div>
            <label><span>Your name *</span><input name="client_name" required defaultValue={fullName} autoComplete="name" /></label>
            <label><span>Best phone number</span><input name="phone" type="tel" autoComplete="tel" /></label>
          </section>

          <section>
            <div><span className="eyebrow">The event</span><h2>What should we know first?</h2></div>
            <label><span>Event name</span><input name="event_title" placeholder={hero.key === "wedding" ? "Taylor & Jordan's wedding" : "Jordan's 40th birthday"} /></label>
            {hero.key === "event" ? (
              <label><span>Event type *</span><select name="event_type" required defaultValue=""><option value="" disabled>Choose one</option>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            ) : null}
            <label><span>Date and start time *</span><input name="starts_at" type="datetime-local" required /></label>
            <label><span>Venue name</span><input name="venue_name" placeholder="If you know it" /></label>
            <label><span>City</span><input name="city" autoComplete="address-level2" /></label>
          </section>

          <fieldset className="start-relationship">
            <legend><span className="eyebrow">Where things stand</span><b>Which best describes you?</b></legend>
            {HERO_RELATIONSHIPS.map((option) => (
              <label key={option.value}><input type="radio" name="relationship" value={option.value} required /><span>{option.label}</span></label>
            ))}
            <small>If you booked through GigSalad, choose already booked. EVENTSible will match and confirm the booking from Mission Control.</small>
          </fieldset>

          <footer>
            <Link className="secondary-button" href="/client">Cancel</Link>
            <button className="primary-button" type="submit">Create my {hero.title}</button>
          </footer>
        </form>
      </main>
    </div>
  );
}
