import "server-only";

import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasHqCapability, staffRole, type HqCapability, type StaffRole } from "@/lib/hq-authorization";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type HqAuthorization =
  | { ok: true; role: StaffRole; user: User; supabase: ServerSupabase }
  | { ok: false; reason: "unauthenticated" | "forbidden"; role: StaffRole | null; user: User | null; supabase: ServerSupabase };

export async function authorizeHqCapability(capability: HqCapability): Promise<HqAuthorization> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, reason: "unauthenticated", role: null, user: null, supabase };

  const role = staffRole(user.app_metadata?.role);
  if (!role || !hasHqCapability(role, capability)) {
    return { ok: false, reason: "forbidden", role, user, supabase };
  }

  return { ok: true, role, user, supabase };
}
