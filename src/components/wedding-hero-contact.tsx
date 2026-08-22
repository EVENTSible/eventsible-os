"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  requestWeddingHeroCallbackAction,
  type WeddingHeroContactResult,
} from "@/app/client/wedding/contact-actions";
import {
  WEDDING_HERO_PHONE_DISPLAY,
  WEDDING_HERO_PHONE_SMS,
  WEDDING_HERO_PHONE_TEL,
} from "@/lib/wedding-hero-contact.mjs";

type Props = {
  supportEmail: string;
  mode: "homepage" | "guided" | "form" | "print";
  source: "weddinghero_homepage" | "public_planner" | "private_plan";
  eventId?: string;
  assignmentId?: string;
  coupleNames?: string;
  eventDate?: string;
  progress?: number;
  initialName?: string;
  initialPhone?: string;
  onRequestRecorded?: (receipt: { requestId: string; createdAt: string }) => void;
};

export function WeddingHeroContact({
  supportEmail,
  mode,
  source,
  eventId,
  assignmentId,
  coupleNames,
  eventDate,
  progress = 0,
  initialName = "",
  initialPhone = "",
  onRequestRecorded,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WeddingHeroContactResult | null>(null);

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setResult(null);
    startTransition(async () => {
      const response = await requestWeddingHeroCallbackAction({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        preferredChannel: String(formData.get("preferredChannel") ?? "call") as "email" | "text" | "call",
        bestTime: String(formData.get("bestTime") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        company: String(formData.get("company") ?? ""),
        coupleNames,
        eventDate,
        progress,
        mode,
        source,
        eventId,
        assignmentId,
      });
      setResult(response);
      if (response.ok && response.requestId && response.createdAt) {
        onRequestRecorded?.({ requestId: response.requestId, createdAt: response.createdAt });
        form.reset();
      }
    });
  }

  return (
    <section className={`wedding-help-contact${expanded ? " expanded" : ""}`} aria-label="Wedding Hero help and contact options">
      <div className="wedding-help-contact-summary">
        <div>
          <span className="wedding-kicker">Need help?</span>
          <b>Talk with EVENTSible</b>
          <small>{WEDDING_HERO_PHONE_DISPLAY}</small>
        </div>
        <nav aria-label="Contact EVENTSible">
          <a href={`mailto:${supportEmail}`}>Email</a>
          <a href={WEDDING_HERO_PHONE_SMS}>Text</a>
          <a href={WEDDING_HERO_PHONE_TEL}>Call</a>
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Close request" : "Request callback"}
          </button>
        </nav>
      </div>

      {expanded ? (
        <form className="wedding-callback-form" onSubmit={submitRequest}>
          <div className="wedding-callback-heading">
            <b>Ask EVENTSible to follow up</b>
            <small>Share the best way and time to reach you. Unknown wedding details can wait.</small>
          </div>
          <div className="wedding-callback-fields">
            <label>
              <span>Your name</span>
              <input name="name" type="text" defaultValue={initialName} autoComplete="name" required />
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" />
            </label>
            <label>
              <span>Phone</span>
              <input name="phone" type="tel" defaultValue={initialPhone} autoComplete="tel" />
            </label>
            <label>
              <span>Best reply method</span>
              <select name="preferredChannel" defaultValue="call">
                <option value="call">Call</option>
                <option value="text">Text</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              <span>Best time</span>
              <input name="bestTime" type="text" placeholder="Weekdays after 5 PM" />
            </label>
            <label className="wedding-callback-notes">
              <span>What can we help with?</span>
              <textarea name="notes" rows={2} placeholder="A quick planning question, service details, or a good place to start" />
            </label>
            <label className="wedding-contact-honeypot" aria-hidden="true">
              <span>Company</span>
              <input name="company" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {result ? <p className={result.ok ? "wedding-callback-success" : "wedding-callback-error"} role="status">{result.message}</p> : null}
          <div className="wedding-callback-actions">
            <button type="submit" disabled={pending}>{pending ? "Sending request..." : "Send callback request"}</button>
            <small>This request only shares the contact details entered here.</small>
          </div>
        </form>
      ) : null}
    </section>
  );
}
