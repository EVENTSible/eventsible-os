"use client";

import { useActionState } from "react";
import type { DriveMediaIntakeState } from "@/app/admin/site-studio/actions";

const initialState: DriveMediaIntakeState = { ok: false, message: "" };

export function SiteStudioMediaIntake({
  action,
}: {
  action: (state: DriveMediaIntakeState, form: FormData) => Promise<DriveMediaIntakeState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: 800 }}>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Google Drive file link or ID
        <input name="drive_file" required placeholder="Paste a Drive photo/video file link" />
      </label>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Working title
        <input name="media_title" required maxLength={180} placeholder="Example: EVENTSible event crowd" />
      </label>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Draft image description
        <textarea name="media_alt" maxLength={240} rows={2}
          placeholder="Describe what is shown; subject permissions reviewed before publication" />
      </label>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Queuing…" : "Queue for private review"}
      </button>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.message}
      </p>
    </form>
  );
}
