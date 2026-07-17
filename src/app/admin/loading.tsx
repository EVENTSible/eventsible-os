export default function Loading() {
  return (
    <main className="loading-shell">
      <div className="loading-card" />
      <div className="loading-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="loading-card small" key={index} />
        ))}
      </div>
      <div className="loading-card tall" />
    </main>
  );
}
