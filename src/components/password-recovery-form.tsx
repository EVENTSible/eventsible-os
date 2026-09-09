"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

const GENERIC_RECOVERY_MESSAGE = "If this address is approved, check its inbox for password setup instructions.";

export function PasswordRecoveryForm({ initialNotice = "" }: { initialNotice?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(initialNotice ? "error" : "idle");
  const [message, setMessage] = useState(initialNotice);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const supabase = getBrowserSupabase();
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login/update-password")}`,
      });
    } catch {
      // Keep the response indistinguishable so recovery cannot enumerate staff accounts.
    } finally {
      // Supabase intentionally does not disclose whether an account exists.
      setStatus("sent");
      setMessage(GENERIC_RECOVERY_MESSAGE);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="recovery-email">Business email</label>
      <input
        id="recovery-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@eventsible.info"
      />
      <button type="submit" disabled={status === "sending" || status === "sent"}>
        {status === "sending" ? "Sending instructions…" : status === "sent" ? "Instructions sent" : "Send password instructions"}
      </button>
      {message ? <p className={`form-message ${status === "error" ? "error" : "sent"}`} role={status === "error" ? "alert" : "status"}>{message}</p> : null}
      <Link className="password-recovery-link" href="/login">Back to sign in</Link>
    </form>
  );
}
