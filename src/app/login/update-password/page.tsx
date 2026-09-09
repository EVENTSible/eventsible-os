import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { Wordmark } from "@/components/wordmark";
import { isStaffRole } from "@/lib/hq-authorization";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Choose a password | EVENTSible OS" };

export default async function UpdatePasswordPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login/recover?error=recovery");
  if (!isStaffRole(data.user.app_metadata?.role)) redirect("/access-denied");

  return (
    <main className="auth-shell auth-shell-compact">
      <section className="auth-panel">
        <div className="brand-lockup"><Wordmark /><span className="eyebrow">EVENTSible OS</span></div>
        <h1>Choose your HQ password.</h1>
        <p className="lede">Set a strong password for this approved staff account. You&apos;ll sign in again when it is saved.</p>
        <UpdatePasswordForm />
      </section>
      <aside className="auth-story" aria-label="Password security guidance">
        <div><span className="eyebrow light">EVENTSible HQ</span><h2>Keep the backstage door protected.</h2></div>
        <p className="auth-story-note">Use a unique password and keep it in a trusted password manager.</p>
      </aside>
    </main>
  );
}
