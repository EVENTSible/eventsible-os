import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requestAuthFetch } from "@/lib/request-auth-scope";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: requestAuthFetch(SUPABASE_URL) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always set cookies. Session refresh is handled in proxy.ts.
        }
      },
    },
  });
}
