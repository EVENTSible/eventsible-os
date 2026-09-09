"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { safeStaffNext } from "@/lib/staff-auth.mjs";

type Props = { next?: string; initialNotice?: string };

export function LoginForm({ next = "/admin", initialNotice = "" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "signing-in" | "error" | "notice">(initialNotice ? "notice" : "idle");
  const [message, setMessage] = useState(initialNotice);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="button"
          className="password-visibility"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <button type="submit" disabled={status === "signing-in"}>
        {status === "signing-in" ? "Signing in…" : "Sign in"}
      </button>
      <Link className="password-recovery-link" href="/login/recover">
        Forgot or need to set your password?
      </Link>
      {message ? <p className={`form-message ${status === "error" ? "error" : "sent"}`} role={status === "error" ? "alert" : "status"}>{message}</p> : null}
      <p className="login-help">
        No public signup is available. Access is limited to approved EVENTSible owners, managers, staff, and hosts.
      </p>
    </form>
  );
}
