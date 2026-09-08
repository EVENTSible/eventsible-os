"use client";

import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("thepartys@eventsible.info");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const supabase = getBrowserSupabase();
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;
      await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      setStatus("sent");
      setMessage("If this address is approved, check its inbox for a secure one-time sign-in link.");
    } catch {
      // Keep the response indistinguishable so this form cannot reveal whether
      // another person's email address has an account.
      setStatus("sent");
      setMessage("If this address is approved, check its inbox for a secure one-time sign-in link.");
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Business email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@eventsible.info"
      />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending secure link…" : "Email my sign-in link"}
      </button>
      {message ? <p className={`form-message ${status}`}>{message}</p> : null}
      <p className="login-help">
        Access is limited to approved EVENTSible owners, staff, hosts, and booked clients.
      </p>
    </form>
  );
}
