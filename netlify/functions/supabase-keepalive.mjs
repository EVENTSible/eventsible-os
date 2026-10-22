import { createClient } from "@supabase/supabase-js";
import { runSupabaseKeepaliveChecks } from "../../src/lib/reliability/supabase-keepalive.mjs";
import { sendSupabaseKeepaliveFailureAlert } from "../../src/lib/reliability/supabase-keepalive-alert.mjs";
import { runNetlifyKeepalive } from "../../src/lib/reliability/netlify-keepalive.mjs";

export const config = { schedule: "20 10 * * *" };

export default async function handler(_request, context) {
  const result = await runNetlifyKeepalive({
    env: process.env,
    deployment: context?.deploy,
    check: async () => {
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }) },
      });
      return runSupabaseKeepaliveChecks(client);
    },
    notify: (summary) => sendSupabaseKeepaliveFailureAlert(summary),
  });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}
