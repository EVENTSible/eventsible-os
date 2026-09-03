import { redirect } from "next/navigation";
import { HqShell } from "@/components/hq-shell";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/login?error=access");

  return <HqShell role={String(role)}>{children}</HqShell>;
}
