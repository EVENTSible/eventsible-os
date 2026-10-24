import { redirect } from "next/navigation";
import { HqShell } from "@/components/site-studio-shell";
import { verifiedHqSession } from "@/lib/hq-session";
import { isStaffRole } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await verifiedHqSession();
  if (!user) redirect("/login");
  const role = user.app_metadata?.role;
  if (!isStaffRole(role)) redirect("/access-denied");

  return <HqShell role={String(role)}>{children}</HqShell>;
}
