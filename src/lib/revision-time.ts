// Cache the locale formatter, never private records or rendered pages.
// Repeated Date.toLocaleString calls otherwise construct one per history row.
const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", second: "numeric",
});

export function formatRevisionTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : formatter.format(date);
}
