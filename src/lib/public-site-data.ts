// Server published-content projection only; no caller/session credentials.
export async function readSiteRows(
  endpoint: string,
  serviceKey: string,
  table: "os_site_content_revisions" | "os_site_media",
  query: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`/rest/v1/${table}`, endpoint);
  url.search = new URLSearchParams(query).toString();
  const response = await fetcher(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("site content unavailable");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("invalid site content response");
  }
  return rows as Record<string, unknown>[];
}
