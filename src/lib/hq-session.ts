import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";

// Render-local deduplication only. Actions/handlers verify on every call.
// No identity, token or private response is retained across requests.
export const verifiedHqSession = cache(async () => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
});
