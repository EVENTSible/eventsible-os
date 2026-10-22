export async function runNetlifyKeepalive({ env, deployment, check, notify, now = () => new Date() }) {
  // A source change never switches the live caller. Preview cannot reach the backend.
  if (deployment?.context !== "production" || deployment?.published !== true || env.EVENTSIBLE_NETLIFY_KEEPALIVE_ENABLED !== "true") {
    return { skipped: true, reason: "not_enabled_for_production" };
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error("Keepalive runtime configuration missing");
  const summary = await check().catch(() => ({ ok: false, checksAttempted: 3, checksPassed: 0 }));
  if (!summary.ok) {
    // Alert failure must not turn a failed database check into a successful job.
    await notify({ timestamp: now().toISOString(), checksAttempted: summary.checksAttempted, checksPassed: summary.checksPassed }).catch(() => {});
    throw Error("Supabase keepalive checks failed");
  }
  return { ok: true, checksAttempted: summary.checksAttempted, checksPassed: summary.checksPassed };
}
