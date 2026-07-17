export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "wordmark compact" : "wordmark"} aria-label="EVENTSible">
      <span className="wordmark-event">EVENT</span><span className="wordmark-sible">SIBLE</span>
      {!compact ? <small>Excellence in Event Entertainment</small> : null}
    </div>
  );
}
