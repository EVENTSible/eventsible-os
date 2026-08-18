export function WeddingHeroMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`wedding-hero-mark${compact ? " compact" : ""}`} aria-label="EVENTSible Wedding Hero, Interactive Wedding Companion">
      <span className="wedding-hero-byline">EVENTSIBLE</span>
      <span className="wedding-hero-name"><b>Wedding</b><strong>Hero</strong></span>
      {compact ? null : <small>Interactive Wedding Companion</small>}
    </div>
  );
}
