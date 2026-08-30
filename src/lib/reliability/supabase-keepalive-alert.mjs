import { sendWithResend } from "../notifications/builder-lead-email.mjs";

function resolveAlertConfig(env) {
  const recipient =
    env.EVENTSIBLE_LEAD_NOTIFICATION_TO ||
    env.EVENTSIBLE_LEAD_NOTIFICATION_RECIPIENT;
  const from = env.EVENTSIBLE_LEAD_NOTIFICATION_FROM;
  const resendApiKey = env.RESEND_API_KEY;

  if (!recipient || !from || !resendApiKey) {
    return null;
  }

  return {
    recipient,
    from,
    resendApiKey,
    dryRun: false,
  };
}

export async function sendSupabaseKeepaliveFailureAlert(
  { timestamp, checksAttempted, checksPassed },
  env = process.env,
) {
  const config = resolveAlertConfig(env);
  if (!config) {
    return { sent: false, reason: "notification_not_configured" };
  }

  const email = {
    to: config.recipient,
    from: config.from,
    subject: "EVENTSible OS Supabase keep-alive failed",
    text: [
      "The scheduled EVENTSible OS Supabase keep-alive did not complete all read-only checks.",
      `Timestamp: ${timestamp}`,
      `Checks passed: ${checksPassed} of ${checksAttempted}`,
      "Review the Vercel runtime logs for /api/cron/supabase-keepalive.",
    ].join("\n"),
    html: `<p>The scheduled EVENTSible OS Supabase keep-alive did not complete all read-only checks.</p><p>Timestamp: ${timestamp}<br>Checks passed: ${checksPassed} of ${checksAttempted}</p><p>Review the Vercel runtime logs for <code>/api/cron/supabase-keepalive</code>.</p>`,
    idempotencyKey: `eventsible-os-supabase-keepalive-failure:${timestamp.slice(0, 10)}`,
  };

  await sendWithResend(email, config);
  return { sent: true };
}
