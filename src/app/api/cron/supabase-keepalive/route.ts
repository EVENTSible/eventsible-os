import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendSupabaseKeepaliveFailureAlert } from "@/lib/reliability/supabase-keepalive-alert.mjs";
import {
  createSupabaseKeepaliveHandler,
  runSupabaseKeepaliveChecks,
} from "@/lib/reliability/supabase-keepalive.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createSupabaseKeepaliveHandler({
  performChecks: async () =>
    runSupabaseKeepaliveChecks(createAdminSupabase()),
  notifyFailure: async (summary: {
    timestamp: string;
    checksAttempted: number;
    checksPassed: number;
  }) => {
    await sendSupabaseKeepaliveFailureAlert(summary);
  },
});
