"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { safeStaffNext } from "@/lib/staff-auth.mjs";

type Props = { next?: string; initialNotice?: string };
type Status = "idle" | "signing-in" | "sending-link" | "sent" | "error";

export function LoginForm({ next = "/admin", initialNotice = "" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(initialNotice ? "error" : "idle");
  const [message, setMessage] = useState(initialNotice);

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("signing-in");
    setMessage("");

    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      router.replace(safeStaffNext(next));
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Email or password was not accepted. Check your details and try again.");
    }
  }

  async function sendMagicLink() {
    setStatus("sending-link");
    setMessage("");

    try {
      const supabase = getBrowserSupabase();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeStaffNext(next))}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      setStatus("sent");
      setMessage("Check your inbox for a secure one-time sign-in link.");
    } catch {
      setStatus("error");
      setMessage("We could not send a sign-in link right now. Wait a moment before trying again.");
    }
  }

  const busy = status === "signing-in" || status === "sending-link";

  return (
    <form className="login-form" onSubmit={handlePasswordSignIn}>
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
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" disabled={busy}>
        {status === "signing-in" ? "Signing in…" : "Sign in"}
      </button>
      <div className="login-alternative" aria-label="Password help">
        <p><b>Forgot password?</b> Use a secure magic link to sign in without creating another account.</p>
        <button className="secondary-button" type="button" disabled={busy || status === "sent" || !email.trim()} onClick={sendMagicLink}>
          {status === "sending-link" ? "Sending secure link…" : status === "sent" ? "Magic link sent" : "Email me a magic link instead"}
        </button>
      </div>
      {message ? <p className={`form-message ${status === "sent" ? "sent" : "error"}`} role={status === "error" ? "alert" : "status"}>{message}</p> : null}
      <p className="login-help">
        No public signup is available. Access is limited to approved EVENTSible owners, managers, staff, and hosts.
      </p>
    </form>
  );
}
