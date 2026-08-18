import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/client-login-form";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Client sign in | EVENTSible" };

export default async function ClientLoginPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/client");

  return (
    <main className="client-login-shell">
      <section className="client-login-story">
        <Wordmark />
        <div>
          <span className="eyebrow">Your Wedding Companion</span>
          <h1>Your details. Your music. Your day.</h1>
          <p>Plan a little at a time, save as you go, and keep the EVENTSible team working from the same answers.</p>
        </div>
        <small>Excellence in Event Entertainment</small>
      </section>
      <section className="client-login-panel">
        <div>
          <span className="eyebrow">Secure client access</span>
          <h2>Open your event</h2>
          <p>Use the email address connected to your EVENTSible booking.</p>
          <ClientLoginForm />
        </div>
      </section>
    </main>
  );
}
