import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/hq-authorization";

export const metadata = { title: "Access required | EVENTSible OS" };

export default async function AccessDeniedPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  if (isStaffRole(data.user.app_metadata?.role)) redirect("/admin");

  return <main className="auth-shell access-denied-shell">
    <section className="auth-panel">
      <div className="brand-lockup"><Wordmark /><span className="eyebrow">EVENTSible OS</span></div>
      <h1>HQ access has not been assigned.</h1>
      <p className="lede">You are signed in, but this account does not have an approved EVENTSible staff role.</p>
      <p className="panel-note">Ask an EVENTSible owner to review access. Signing in again will not change this account&apos;s authorization.</p>
      <LogoutButton />
    </section>
  </main>;
}
