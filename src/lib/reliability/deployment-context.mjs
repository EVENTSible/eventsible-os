// Provider context is authoritative; NODE_ENV also equals production in Preview builds.
export function isProductionDeployment(env = process.env) {
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
