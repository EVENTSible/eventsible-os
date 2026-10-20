"use client";

import { useState } from "react";

export type SiteMediaOption = {
  id: string;
  title: string;
  alt_text: string;
  public_url: string;
};

const SECTIONS = [
  { id: "home-event-types", label: "Event types" },
  { id: "home-services", label: "Services" },
  { id: "home-trust", label: "Why EVENTSible" },
  { id: "home-featured-packages", label: "Featured packages" },
  { id: "home-planning-tools", label: "Planning tools" },
  { id: "home-faq", label: "Frequently asked questions" },
] as const;
const ALL_IDS = SECTIONS.map((s) => s.id);

type Copy = {
  heading: string;
  highlight: string;
  subheading: string;
  portfolio_heading: string;
  portfolio_body: string;
  hero_media_id: string;
  event_types_heading: string;
  services_heading: string;
  services_body: string;
  featured_heading: string;
  featured_body: string;
  final_cta_heading: string;
  final_cta_body: string;
  section_order: string[];
  visible_sections?: string[];
  gallery_media_ids: string[];
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
  const [order, setOrder] = useState<string[]>(() => [
    ...new Set([...initial.section_order.filter((x) => ALL_IDS.includes(x as typeof ALL_IDS[number])), ...ALL_IDS]),
  ]);
  const [visible, setVisible] = useState<string[]>(initial.visible_sections ?? ALL_IDS);
  const [gallery, setGallery] = useState<string[]>([...initial.gallery_media_ids, "", "", ""].slice(0, 3));
  const photo = approvedMedia.find((media) => media.id === copy.hero_media_id);
  const update = (key: keyof Copy, value: string) =>
    setCopy((current) => ({ ...current, [key]: value }));

  function textField(key: keyof Copy, label: string, maxLength: number, multiline = false) {
    const val = String(copy[key] ?? "");
    return (
      <label style={{ display: "grid", gap: "0.4rem" }}>
        {label}
        {multiline ? (
          <textarea name={key} value={val} maxLength={maxLength} rows={3}
            onChange={(event) => update(key, event.target.value)} />
        ) : (
          <input name={key} value={val} maxLength={maxLength}
            required={key === "heading" || key === "highlight"}
            onChange={(event) => update(key, event.target.value)} />
        )}
      </label>
    );
  }

  function moveSection(id: string, delta: number) {
    setOrder((current) => {
      const at = current.indexOf(id);
      const next = at + delta;
      if (at < 0 || next < 0 || next >= current.length) return current;
      const changed = [...current];
      [changed[at], changed[next]] = [changed[next], changed[at]];
      return changed;
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="panel">
        <h2>Homepage editor</h2>
        <p className="panel-note">Live preview is private. Saving creates a draft; publishing is a separate owner action. The Event Builder and booking links are locked for safety.</p>
        <form action={saveAction} className="site-studio-form" style={{ display: "grid", gap: "1.2rem", maxWidth: 860 }}>
          <fieldset style={{ display: "grid", gap: "0.8rem" }}>
            <legend><strong>Welcome & hero</strong></legend>
            {textField("heading", "Headline", 110)}
            {textField("highlight", "Highlighted words", 70)}
            <label style={{ display: "grid", gap: "0.4rem" }}>
              Introduction
              <textarea name="subheading" required value={copy.subheading} maxLength={600} rows={4}
                onChange={(event) => update("subheading", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: "0.4rem" }}>
              Approved homepage photo
              <select name="hero_media_id" value={copy.hero_media_id}
                onChange={(event) => update("hero_media_id", event.target.value)}>
                <option value="">Keep existing public image</option>
                {approvedMedia.map((media) => <option key={media.id} value={media.id}>{media.title}</option>)}
              </select>
            </label>
          </fieldset>
          <fieldset style={{ display: "grid", gap: "0.8rem" }}>
            <legend><strong>Event & service copy</strong></legend>
            {textField("event_types_heading", "Event types heading", 140)}
            {textField("services_heading", "Services heading", 140)}
            {textField("services_body", "Services introduction", 600, true)}
            {textField("featured_heading", "Featured experiences heading", 140)}
            {textField("featured_body", "Featured experiences introduction", 600, true)}
          </fieldset>
          <fieldset style={{ display: "grid", gap: "0.8rem" }}>
            <legend><strong>Portfolio & real-media gallery</strong></legend>
            {textField("portfolio_heading", "Portfolio heading", 140)}
            {textField("portfolio_body", "Portfolio description", 600, true)}
            {[0, 1, 2].map((index) => (
              <label key={index} style={{ display: "grid", gap: "0.4rem" }}>
                Approved gallery photo {index + 1}
                <select name="gallery_media_ids" value={gallery[index] ?? ""}
                  onChange={(event) => setGallery((current) => current.map((id, pos) => pos === index ? event.target.value : id))}>
                  <option value="">No photo selected</option>
                  {approvedMedia.map((media) => <option key={media.id} value={media.id}>{media.title}</option>)}
                </select>
              </label>
            ))}
            <p className="panel-note">A real-photo gallery appears only when its selected media is approved and has a public rendition. Unverified reviews remain hidden.</p>
          </fieldset>
          <fieldset style={{ display: "grid", gap: "0.8rem" }}>
            <legend><strong>Page sections & order</strong></legend>
            <p className="panel-note">Move sections, or show/hide optional sections. Welcome, Event Builder, and the final call-to-action cannot be removed.</p>
            <input type="hidden" name="section_order" value={order.join(",")} />
            {order.map((id, index) => {
              const item = SECTIONS.find((section) => section.id === id);
              if (!item) return null;
              return (
                <div key={id} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 220px" }}>
                    <input type="checkbox" name="visible_sections" value={id}
                      checked={visible.includes(id)}
                      onChange={(event) => setVisible((current) => event.target.checked ? [...current, id] : current.filter((x) => x !== id))} />
                    {item.label}
                  </label>
                  <button type="button" className="secondary-button" disabled={index === 0}
                    onClick={() => moveSection(id, -1)} aria-label={`Move ${item.label} up`}>Up</button>
                  <button type="button" className="secondary-button" disabled={index === order.length - 1}
                    onClick={() => moveSection(id, 1)} aria-label={`Move ${item.label} down`}>Down</button>
                </div>
              );
            })}
          </fieldset>
          <fieldset style={{ display: "grid", gap: "0.8rem" }}>
            <legend><strong>Final call-to-action</strong></legend>
            {textField("final_cta_heading", "Call-to-action heading", 140)}
            {textField("final_cta_body", "Call-to-action message", 600, true)}
            <p className="panel-note">Navigation destinations and verified Event Builder links cannot be edited here.</p>
          </fieldset>
          <button className="primary-button" type="submit">Save private draft</button>
        </form>
      </section>
      <section className="panel" aria-label="Live private draft preview" aria-live="polite">
        <p className="eyebrow">LIVE DRAFT PREVIEW • NOT PUBLIC</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.2 }}>
              {copy.heading || "Your headline"} <span>{copy.highlight || "Highlight"}</span>
            </h2>
            <p>{copy.subheading || "Your introduction"}</p>
          </div>
          <div style={{ border: "1px solid currentColor", borderRadius: "0.75rem", overflow: "hidden" }}>
            {photo ? (
              <img src={photo.public_url} alt={photo.alt_text} style={{ width: "100%", height: "auto", objectFit: "cover" }} />
            ) : <p style={{ padding: "1rem" }}>The existing hero photo stays until an approved replacement is selected.</p>}
          </div>
        </div>
        <h3>{copy.event_types_heading}</h3>
        <h3>{copy.services_heading}</h3>
        <p>{copy.services_body}</p>
        <h3>{copy.featured_heading}</h3>
        <p>{copy.featured_body}</p>
        <h3>{copy.portfolio_heading}</h3>
        <p>{copy.portfolio_body}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.5rem" }}>
          {gallery.filter(Boolean).map((id,index) => {
            const m = approvedMedia.find((item) => item.id === id);
            return m ? <img key={index} src={m.public_url} alt={m.alt_text} style={{ width: "100%", objectFit: "cover", aspectRatio: "4/3" }} /> : null;
          })}
        </div>
        <p className="panel-note">Optional section sequence: {order.filter((id) => visible.includes(id)).map((id) => SECTIONS.find((s) => s.id === id)?.label).join(" → ")}</p>
        <h3>{copy.final_cta_heading}</h3>
        <p>{copy.final_cta_body}</p>
      </section>
    </div>
  );
}
