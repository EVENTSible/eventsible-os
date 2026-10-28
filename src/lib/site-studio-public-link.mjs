/** Resolve navigation only; this never changes content, bindings or Auth. */
export function siteStudioPublicLink(env = process.env) {
  // Navigation only. Never enable the local private-draft bridge on a host.
  if (env.VERCEL_ENV === 'preview' && env.EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL) {
    try {
      const preview = new URL(env.EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL);
      if (preview.protocol === 'https:' && /^[a-z0-9-]+\.vercel\.app$/.test(preview.hostname) &&
          !preview.username && !preview.password && !preview.port &&
          preview.pathname === '/' && !preview.search && !preview.hash) {
        return { href: preview.href, label: 'Open matching public Preview' };
      }
    } catch { /* Invalid configuration retains the existing safe destination. */ }
  }
  const local = env.EVENTSIBLE_LOCAL_DEMO === "true" &&
    env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:56521" &&
    !env.VERCEL_ENV && env.NETLIFY !== "true" && !env.EVENTSIBLE_CLOUDFLARE_CONTEXT;
  return local
    ? { href: "http://127.0.0.1:5173/", label: "Open matching public Preview" }
    : { href: "https://eventsible.info", label: "View live website" };
}
