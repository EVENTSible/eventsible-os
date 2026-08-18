"use client";

import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function ClientLoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const supabase = getBrowserSupabase();
      const redirectTo = `${window.location.origin}/auth/callback?next=/client`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (error) throw error;

      setStatus("sent");
      setMessage("Check your inbox for your secure sign-in link.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not send the sign-in link.");
    }
  }

  return (
    <form className="client-login-form" onSubmit={handleSubmit}>
      <label htmlFor="client-email">Email connected to your booking</label>
      <input
        id="client-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending secure link…" : "Email my sign-in link"}
      </button>
      {message ? <p className={`form-message ${status}`}>{message}</p> : null}
      <p className="login-help">No password to remember. Access is limited to email addresses connected to an EVENTSible booking.</p>
    </form>
  );
}
