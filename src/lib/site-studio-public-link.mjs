/** Resolve navigation only; this never changes content, bindings or Auth. */
export function siteStudioPublicLink(env = process.env) {
  const local = env.EVENTSIBLE_LOCAL_DEMO === "true" &&
    env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:56521" &&
    !env.VERCEL_ENV && env.NETLIFY !== "true" && !env.EVENTSIBLE_CLOUDFLARE_CONTEXT;
  return local
    ? { href: "http://127.0.0.1:5173/", label: "Open matching public Preview" }
    : { href: "https://eventsible.info", label: "View live website" };
}
