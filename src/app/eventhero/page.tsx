import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Event Hero Preview | EVENTSible", description: "A preview of EVENTSible's complete non-wedding event planning companion." };
const planningAreas = ["Event details + priorities", "Schedule + event flow", "Venue + logistics", "Guest experience", "Music + entertainment", "Contacts + special instructions"];

export default function EventHeroPreviewPage() {
  return <main className="event-hero-preview-page">
    <header><Link href="/" aria-label="Back to EVENTSible home"><Image src="/brand/eventsible-logo.png" alt="EVENTSible" width={1408} height={769} priority /></Link><Link href="/">Back to EVENTSible</Link></header>
    <section aria-labelledby="event-hero-title"><p className="front-door-kicker">Event Hero · Public preview</p><h1 id="event-hero-title">Plan the whole event. Miss fewer details.</h1><p>Event Hero is being prepared as EVENTSible’s non-wedding planning companion. It will help you work through the full plan—not choose services or calculate a quote.</p><div>{planningAreas.map((area) => <span key={area}>{area}</span>)}</div><aside><strong>The full public Event Hero experience is coming soon.</strong><p>Ready to explore entertainment and request pricing now? Use Event Builder. Want a person to help? Start a Quick Quote.</p></aside><nav aria-label="Available event planning options"><a href="https://build.eventsible.info/build?start=choose">Build My Event</a><a href="https://eventsible.info/fast-track">Get a Quick Quote</a><a href="tel:+15742745213">Call (574) 274-5213</a></nav></section>
  </main>;
}
