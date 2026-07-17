import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in | EVENTSible OS",
};

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect("/admin");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup">
          <Wordmark />
          <span className="eyebrow">EVENTSible OS</span>
        </div>
        <h1>Your event business, connected.</h1>
        <p className="lede">
          Secure access to leads, bookings, Wedding Hero, Event Hero, client messages, and event readiness.
        </p>
        <LoginForm />
      </section>
      <aside className="auth-story" aria-label="EVENTSible operating system overview">
        <div>
          <span className="eyebrow light">Excellence in Event Entertainment</span>
          <h2>One event record. Every detail in sync.</h2>
        </div>
        <div className="story-grid">
          <article><b>Build</b><span>Turn inquiries into tailored quotes.</span></article>
          <article><b>Book</b><span>Track contracts, deposits, and services.</span></article>
          <article><b>Plan</b><span>Guide clients with Hero experiences.</span></article>
          <article><b>Deliver</b><span>Give hosts the right event-day details.</span></article>
        </div>
      </aside>
    </main>
  );
}
