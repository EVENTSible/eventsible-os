export const SUPABASE_KEEPALIVE_CHECKS = Object.freeze([
  Object.freeze({ table: "os_events", column: "id" }),
  Object.freeze({ table: "os_contacts", column: "id" }),
  Object.freeze({ table: "os_bookings", column: "id" }),
]);

const NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
});

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function normalizeCount(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeCheckSummary(summary) {
  const attempted = normalizeCount(summary?.checksAttempted);
  const passed = Math.min(normalizeCount(summary?.checksPassed), attempted);

  return {
    ok: summary?.ok === true && attempted > 0 && passed === attempted,
    checksAttempted: attempted,
    checksPassed: passed,
  };
}

export async function runSupabaseKeepaliveChecks(
  supabase,
  checks = SUPABASE_KEEPALIVE_CHECKS,
) {
  const results = await Promise.all(
    checks.map(async ({ table, column }) => {
      try {
        const { error } = await supabase
          .from(table)
          .select(column, { count: "exact", head: true })
          .limit(1);

        return !error;
      } catch {
        return false;
      }
    }),
  );

  const checksPassed = results.filter(Boolean).length;
  return {
    ok: checks.length > 0 && checksPassed === checks.length,
    checksAttempted: checks.length,
    checksPassed,
  };
}

export function createSupabaseKeepaliveHandler({
  env = process.env,
  performChecks,
  notifyFailure = async (_summary) => {},
  logger = console,
  now = () => new Date(),
  clock = () => Date.now(),
}) {
  if (typeof performChecks !== "function") {
    throw new TypeError("performChecks is required");
  }

  return async function handleSupabaseKeepalive(request) {
    const cronSecret = env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const startedAt = clock();
    const timestamp = now().toISOString();
    let summary;

    try {
      summary = normalizeCheckSummary(await performChecks());
    } catch {
      summary = normalizeCheckSummary(null);
    }

    const durationMs = Math.max(0, Math.round(clock() - startedAt));
    const responseBody = {
      ok: summary.ok,
      timestamp,
      checksAttempted: summary.checksAttempted,
      checksPassed: summary.checksPassed,
      durationMs,
    };

    if (summary.ok) {
      return jsonResponse(responseBody, 200);
    }

    logger.error(
      `[supabase-keepalive] database_checks_failed attempted=${summary.checksAttempted} passed=${summary.checksPassed}`,
    );

    try {
      await notifyFailure(responseBody);
    } catch {
      logger.error("[supabase-keepalive] failure_notification_failed");
    }

    return jsonResponse(responseBody, 503);
  };
}
