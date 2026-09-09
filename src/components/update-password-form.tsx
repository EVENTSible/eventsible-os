"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { STAFF_PASSWORD_MIN_LENGTH } from "@/lib/staff-auth.mjs";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
      setStatus("error");
      setMessage(`Use at least ${STAFF_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("saving");
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage("Password could not be updated. Request a new setup link and try again.");
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login?notice=password-updated");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="new-password">New password</label>
      <div className="password-field">
        <input
          id="new-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={STAFF_PASSWORD_MIN_LENGTH}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="button" className="password-visibility" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <label htmlFor="confirm-password">Confirm new password</label>
      <input
        id="confirm-password"
        name="password_confirmation"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        minLength={STAFF_PASSWORD_MIN_LENGTH}
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <p className="password-guidance">Use at least {STAFF_PASSWORD_MIN_LENGTH} characters and a password unique to EVENTSible.</p>
      <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving password…" : "Save password"}</button>
      {message ? <p className="form-message error" role="alert">{message}</p> : null}
    </form>
  );
}
