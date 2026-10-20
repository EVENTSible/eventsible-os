"use client";

import { useState } from "react";

export type SiteMediaOption = {
  id: string;
  title: string;
  alt_text: string;
  public_url: string;
};

type Copy = {
  heading: string;
  highlight: string;
  subheading: string;
  portfolio_heading: string;
  portfolio_body: string;
  hero_media_id: string;
};

export function SiteStudioHomeEditor({
  initial,
  approvedMedia,
  saveAction,
}: {
  initial: Copy;
  approvedMedia: SiteMediaOption[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [copy, setCopy] = useState(initial);
  const photo = approvedMedia.find((media) => media.id === copy.hero_media_id);
  const update = (field: keyof Copy, value: string) =>
    setCopy((current) => ({ ...current, [field]: value }));

  function field(name: keyof Copy, label: string, maximum: number, multiline = false) {
    const control = multiline ? (
      <textarea
        name={name}
        rows={name === "subheading" ? 4 : 3}
        maxLength={maximum}
        required={name === "subheading"}
        value={copy[name]}
        onChange={(event) => update(name, event.target.value)}
      />
    ) : (
      <input
        name={name}
        maxLength={maximum}
        required={name === "heading" || name === "highlight"}
        value={copy[name]}
        onChange={(event) => update(name, event.target.value)}
      />
    );
    return <label style={{ display: "grid", gap: "0.4rem" }}>{label}{control}</label>;
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="panel">
        <h2>Homepage content</h2>
        <p className="panel-note">Changes appear in your private preview as you type. They are not public until you deliberately publish a saved revision.</p>
        <form action={saveAction} className="site-studio-form" style={{ display: "grid", gap: "1rem", maxWidth: 800 }}>
          {field("heading", "Headline", 110)}
          {field("highlight", "Highlighted words", 70)}
          {field("subheading", "Introduction", 600, true)}
          {field("portfolio_heading", "Portfolio heading", 140)}
          {field("portfolio_body", "Portfolio description", 600, true)}
          <label style={{ display: "grid", gap: "0.4rem" }}>
            Approved homepage photo
            <select
              name="hero_media_id"
              value={copy.hero_media_id}
              onChange={(event) => update("hero_media_id", event.target.value)}
            >
              <option value="">Keep existing public image</option>
              {approvedMedia.map((media) => (
                <option key={media.id} value={media.id}>{media.title}</option>
              ))}
            </select>
          </label>
          <p className="panel-note">Only permission-cleared, public-ready media can be selected. A Google Drive original cannot be hotlinked into the public website.</p>
          <button className="primary-button" type="submit">Save private draft</button>
        </form>
      </section>
      <section className="panel" aria-label="Live private draft preview" aria-live="polite">
        <p className="eyebrow">LIVE DRAFT PREVIEW • NOT PUBLIC</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: "1.25rem", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.2 }}>
              {copy.heading || "Your headline"} <span>{copy.highlight || "Highlight"}</span>
            </h2>
            <p>{copy.subheading || "Your introduction"}</p>
          </div>
          <div style={{ border: "2px solid currentColor", borderRadius: "0.75rem", overflow: "hidden", minHeight: "9rem" }}>
            {photo ? (
              // The approved public rendition is intentionally separate from its private Drive original.
              <img src={photo.public_url} alt={photo.alt_text} style={{ width: "100%", height: "100%", minHeight: "9rem", objectFit: "cover" }}/>
            ) : (
              <p style={{ padding: "1rem" }}>Current website image stays in place until you choose an approved replacement.</p>
            )}
          </div>
        </div>
        <h3>{copy.portfolio_heading || "Portfolio title"}</h3>
        <p>{copy.portfolio_body || "Portfolio introduction"}</p>
      </section>
    </div>
  );
}
