// Provider context is authoritative; NODE_ENV also equals production in Preview builds.
export function isProductionDeployment(env = process.env) {
  if (env.EVENTSIBLE_CLOUDFLARE_CONTEXT) return false;
  const context = netlifyContext(env);
  return context !== null ? context === "production" : env.VERCEL_ENV === "production";
}

export function isNetlifyPreview(env = process.env) {
  const context = netlifyContext(env);
  return context !== null && context !== "production";
}

export function netlifyContext(env = process.env) {
  if (env.EVENTSIBLE_NETLIFY_CONTEXT) return env.EVENTSIBLE_NETLIFY_CONTEXT;
  if (env.NETLIFY === "true") return env.CONTEXT || "unknown";
  // SITE_ID is available at runtime; NETLIFY/CONTEXT are build-only variables.
  return env.SITE_ID ? "unknown" : null;
}

// Cloudflare configuration in these drafts is deliberately QA-only. Unknown
// provider context fails closed even if stale Production metadata is present.
export function isPreviewDeployment(env = process.env) {
  return Boolean(env.EVENTSIBLE_CLOUDFLARE_CONTEXT) || isNetlifyPreview(env);
}
export function cloudflareQaOrigin(env = process.env) {
  const value = env.EVENTSIBLE_CLOUDFLARE_APP_ORIGIN;
  return env.EVENTSIBLE_CLOUDFLARE_CONTEXT === "qa" && typeof value === "string" && /^https:\/\/eventsible-qa-hq-[0-9]{8}\.firstfamdjs\.workers\.dev$/.test(value) ? value : "";
}
