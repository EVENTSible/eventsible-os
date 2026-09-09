import { PasswordRecoveryForm } from "@/components/password-recovery-form";
import { Wordmark } from "@/components/wordmark";
import { recoveryNotice } from "@/lib/staff-auth.mjs";

export const metadata = { title: "Set your password | EVENTSible OS" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PasswordRecoveryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="auth-shell auth-shell-compact">
      <section className="auth-panel">
        <div className="brand-lockup"><Wordmark /><span className="eyebrow">EVENTSible OS</span></div>
        <h1>Set or reset your password.</h1>
        <p className="lede">Enter your approved staff email. We&apos;ll send secure password setup instructions if the account is eligible.</p>
        <PasswordRecoveryForm initialNotice={recoveryNotice(error)} />
      </section>
      <aside className="auth-story" aria-label="Password recovery guidance">
        <div><span className="eyebrow light">Secure staff access</span><h2>One account. One protected HQ.</h2></div>
        <p className="auth-story-note">Password setup never creates a new account or changes an EVENTSible role.</p>
      </aside>
    </main>
  );
}
