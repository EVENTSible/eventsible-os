import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/client-login-form";
import { Wordmark } from "@/components/wordmark";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Client sign in | EVENTSible" };

type PageProps = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> };

export default async function ClientLoginPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const query = await searchParams;
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const nextPath = requestedNext?.startsWith("/client") && !requestedNext.startsWith("//") ? requestedNext : "/client";
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  if (data.user) redirect(nextPath);

  return (
    <main className="client-login-shell">
      <section className="client-login-story">
        <Wordmark />
        <div>
          <span className="eyebrow">Wedding Companion + Event Hero</span>
          <h1>Your details. Your vision. Your event.</h1>
          <p>Start planning before you book, reconnect a legacy GigSalad event, or continue an existing EVENTSible workspace.</p>
        </div>
        <small>Excellence in Event Entertainment</small>
      </section>
      <section className="client-login-panel">
        <div>
          <span className="eyebrow">Secure event access</span>
          <h2>Start or open your event</h2>
          <p>Verify your email, then choose Wedding Companion or Event Hero. You do not need an existing EVENTSible booking.</p>
          {error ? <div className="alert error">That sign-in link could not be completed. Request a fresh link below.</div> : null}
          <ClientLoginForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
