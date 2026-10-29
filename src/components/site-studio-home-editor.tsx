"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useFormStatus } from "react-dom";
import { formatRevisionTime } from "@/lib/revision-time";
import {
  STUDIO_SECTIONS,
  STUDIO_POWER,
  OPTIONAL_SECTIONS,
  normalizeStudioCopy,
  studioDraftForm,
  studioPreviewCopy,
} from "@/lib/site-studio-workspace.mjs";
import { SiteStudioVisualPreview } from "./site-studio-visual-preview";
import "./site-studio-workspace.css";

export type SiteMediaOption = {
  id: string;
  title: string;
  alt_text: string;
  public_url: string;
};
export type SiteStudioCopy = {
  heading: string;
  highlight: string;
  subheading: string;
  portfolio_heading: string;
  portfolio_body: string;
  hero_media_id: string;
  power_welcome: string;
  power_subtitles: Record<string, string>;
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
export type SiteStudioRevision = {
  id: string;
  revision: number;
  state: string;
  created_at: string;
  summary: string;
  power: string;
};
function SaveControl({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="studio-save"
      aria-label={pending ? "Saving…" : "Save private draft"}
      type="submit"
      disabled={disabled || pending}
    >
      {pending ? (
        "Saving…"
      ) : (
        <>
          <span className="studio-save-full">Save private draft</span>
          <span className="studio-save-short" aria-hidden="true">
            Save draft
          </span>
        </>
      )}
    </button>
  );
}
function ConfirmPublish() {
  const { pending } = useFormStatus();
  return (
    <button className="studio-publish" type="submit" disabled={pending}>
      {pending ? "Publishing…" : "Confirm publication"}
    </button>
  );
}

export function SiteStudioHomeEditor({
  initial,
  approvedMedia,
  saveAction,
  publishAction,
  currentRevision,
  publishedRevision,
  revisions,
  publicLink,
  mediaPanel,
  hasOlder,
  before,
  notice,
  visualPreviewEnabled,
  visualPreviewUrl,
}: {
  initial: SiteStudioCopy;
  approvedMedia: SiteMediaOption[];
  saveAction: (data: FormData) => Promise<void>;
  publishAction: (data: FormData) => Promise<void>;
  currentRevision: SiteStudioRevision | null;
  publishedRevision: number | null;
  revisions: SiteStudioRevision[];
  publicLink: { href: string; label: string };
  mediaPanel: ReactNode;
  hasOlder: boolean;
  before?: number;
  notice: string;
  visualPreviewEnabled: boolean;
  visualPreviewUrl?: string;
}) {
  const [copy, setCopy] = useState(
    () =>
      normalizeStudioCopy(initial) as SiteStudioCopy & {
        visible_sections: string[];
      },
  );
  const [mode, setMode] = useState<"classic" | "power">("classic"),
    [section, setSection] = useState("hero"),
    [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [target, setTarget] = useState<SiteStudioRevision | null>(null);
  const history = useRef<HTMLDialogElement>(null),
    media = useRef<HTMLDialogElement>(null),
    confirmation = useRef<HTMLDialogElement>(null),
    allowNavigation = useRef(false);
  const controls = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(300);
  const dirty =
    JSON.stringify(copy) !== JSON.stringify(normalizeStudioCopy(initial));
  const valid =
    !!copy.heading.trim() &&
    !!copy.highlight.trim() &&
    !!copy.subheading.trim();
  const active =
      STUDIO_SECTIONS.find((s) => s.id === section) ?? STUDIO_SECTIONS[0],
    powerLabel =
      STUDIO_POWER.find(([id]) => id === section)?.[1] ?? "Welcome Banner";
  const previewContent = studioPreviewCopy(
    copy,
    approvedMedia,
    process.env.NEXT_PUBLIC_EVENTSIBLE_MEDIA_FREE_RELEASE === "true",
  );
  const previewTarget =
    mode === "classic"
      ? active.target
      : section === "welcome"
        ? ""
        : `power:${section}`;
  const status = dirty
    ? "Unsaved changes"
    : currentRevision
      ? `${currentRevision.state === "published" ? "Published" : "Saved"} revision ${currentRevision.revision}`
      : "Not yet saved";
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !allowNavigation.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const guard = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.("a[href]");
      if (
        !dirty ||
        !anchor ||
        anchor.getAttribute("target") === "_blank" ||
        (anchor as HTMLAnchorElement).origin !== location.origin
      )
        return;
      if (
        !window.confirm("You have unsaved edits. Leave without saving them?")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else allowNavigation.current = true;
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty]);
  function update(key: string, value: string) {
    setCopy((current) => ({ ...current, [key]: value }));
  }
  function chooseMode(next: "classic" | "power") {
    setMode(next);
    setSection(next === "classic" ? "hero" : "welcome");
    controls.current?.scrollTo({ top: 0 });
  }
  function chooseSection(id: string) {
    setSection(id);
    controls.current?.scrollTo({ top: 0 });
  }
  function requestPublish(revision: SiteStudioRevision) {
    if (dirty) return;
    setTarget(revision);
    confirmation.current?.showModal();
  }
  function move(id: string, delta: number) {
    setCopy((current) => {
      const order = [...current.section_order],
        at = order.indexOf(id),
        next = at + delta;
      if (next < 0 || next >= order.length) return current;
      [order[at], order[next]] = [order[next], order[at]];
      return { ...current, section_order: order };
    });
  }
  function field(key: string, label: string, max: number, multiline = false) {
    const value = String(copy[key as keyof SiteStudioCopy] ?? "");
    return (
      <label key={key} className="studio-field">
        {label}
        {multiline ? (
          <textarea
            aria-label={label}
            name={key}
            value={value}
            maxLength={max}
            rows={4}
            onChange={(e) => update(key, e.target.value)}
          />
        ) : (
          <input
            aria-label={label}
            name={key}
            value={value}
            maxLength={max}
            onChange={(e) => update(key, e.target.value)}
          />
        )}
        <span className="studio-field-meta">
          {value.length} / {max}
        </span>
      </label>
    );
  }
  function mediaSelect(key: "hero_media_id" | "gallery_media_ids", index = 0) {
    return (
      <label className="studio-field">
        {key === "hero_media_id"
          ? "Approved homepage photo"
          : `Approved gallery photo ${index + 1}`}
        <select
          name={key}
          value={
            key === "hero_media_id"
              ? copy.hero_media_id
              : copy.gallery_media_ids[index]
          }
          onChange={(e) =>
            key === "hero_media_id"
              ? update(key, e.target.value)
              : setCopy((c) => ({
                  ...c,
                  gallery_media_ids: c.gallery_media_ids.map((id, i) =>
                    i === index ? e.target.value : id,
                  ),
                }))
          }
        >
          <option value="">
            {key === "hero_media_id"
              ? "Keep existing public image"
              : "No replacement photo"}
          </option>
          {approvedMedia.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div
      className="studio-workspace"
      data-mobile-panel={mobileTab}
      style={{ "--studio-editor-width": `${editorWidth}px` } as CSSProperties}
    >
      <form
        id="studio-draft-form"
        className="studio-command"
        action={async () => {
          allowNavigation.current = true;
          try {
            await saveAction(studioDraftForm(copy));
          } finally {
            allowNavigation.current = false;
          }
        }}
      >
        <div className="studio-command-heading">
          <div>
            <span className="eyebrow">WEBSITE WORKSPACE</span>
            <h1>
              Site Studio <span>Home</span>
            </h1>
          </div>
          <label className="studio-panel-size">
            Editor width
            <input
              type="range"
              min={260}
              max={420}
              step={10}
              value={editorWidth}
              onChange={(e) => setEditorWidth(Number(e.target.value))}
              aria-valuetext={`${editorWidth} pixels`}
            />
          </label>
          <div className="studio-segment" aria-label="Editing layout">
            <button
              type="button"
              aria-pressed={mode === "classic"}
              onClick={() => chooseMode("classic")}
            >
              Classic View
            </button>
            <button
              type="button"
              aria-pressed={mode === "power"}
              onClick={() => chooseMode("power")}
            >
              Power Mode
            </button>
          </div>
        </div>
        <div className="studio-command-actions">
          <div
            className="studio-revision-status"
            aria-label="Editor and publication status"
          >
            <strong className={dirty ? "studio-dirty" : ""}>
              {dirty ? "● Unsaved changes" : status}
            </strong>
            <span>
              {currentRevision
                ? `Editing ${currentRevision.state} revision ${currentRevision.revision}`
                : "New homepage"}{" "}
              · Public website:{" "}
              {publishedRevision
                ? `revision ${publishedRevision}`
                : "static fallback"}
            </span>
          </div>
          <div className="studio-actions">
            <SaveControl disabled={!dirty || !valid} />
            <button
              type="button"
              className="studio-publish"
              disabled={
                dirty ||
                !currentRevision ||
                currentRevision.state === "published"
              }
              onClick={() => currentRevision && requestPublish(currentRevision)}
            >
              Publish
            </button>
            <button
              type="button"
              aria-controls="studio-private-preview"
              onClick={() => {
                setMobileTab("preview");
                requestAnimationFrame(() => {
                  const node = document.getElementById(
                    "studio-private-preview",
                  );
                  node?.focus({ preventScroll: true });
                });
              }}
            >
              Preview
            </button>
            <button type="button" onClick={() => history.current?.showModal()}>
              History
            </button>
            <a
              href={publicLink.href}
              aria-label={publicLink.label}
              title={publicLink.label}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="studio-public-link-label">
                {publicLink.label}
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        {dirty && (
          <p className="studio-sr-only">
            Save a new private draft before publishing. Existing saved revisions
            stay intact.
          </p>
        )}
        {!valid && (
          <p role="alert" className="studio-toolbar-note">
            Headline, highlighted words and introduction are required. Preview
            holds the last valid content until these are filled.
          </p>
        )}
      </form>
      {notice && (
        <p className="studio-notice" role="status">
          {notice}
        </p>
      )}
      <div className="studio-mobile-tabs" aria-label="Workspace panel">
        <button
          aria-pressed={mobileTab === "edit"}
          onClick={() => setMobileTab("edit")}
        >
          Edit
        </button>
        <button
          aria-pressed={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
        >
          Preview
        </button>
      </div>
      <div className="studio-split">
        <section className="studio-edit" aria-label="Homepage editing controls">
          <div className="studio-section-heading">
            <label className="studio-section-picker">
              <span>
                {mode === "classic" ? "Classic section" : "Power section"}
              </span>
              <select
                value={section}
                onChange={(e) => chooseSection(e.target.value)}
              >
                {(mode === "classic"
                  ? STUDIO_SECTIONS.map((s) => [s.id, s.label])
                  : STUDIO_POWER
                ).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => media.current?.showModal()}>
              Media review
            </button>
          </div>
          <div
            ref={controls}
            className="studio-controls"
            role="region"
            aria-labelledby="studio-section-title"
            tabIndex={0}
          >
            <div className="studio-controls-title">
              <h2 id="studio-section-title">
                {mode === "classic" ? active.label : powerLabel}
              </h2>
              <span className="studio-chip">
                {mode === "classic" ? "Classic" : "Power"} only
              </span>
            </div>
            {mode === "power" ? (
              <>
                {section === "welcome" ? (
                  field("power_welcome", "Power Mode welcome", 32)
                ) : (
                  <label className="studio-field">
                    {powerLabel}
                    <input
                      aria-label={powerLabel}
                      name={`power_subtitle_${section}`}
                      value={copy.power_subtitles[section] ?? ""}
                      maxLength={52}
                      onChange={(e) =>
                        setCopy((c) => ({
                          ...c,
                          power_subtitles: {
                            ...c.power_subtitles,
                            [section]: e.target.value,
                          },
                        }))
                      }
                    />
                    <span className="studio-field-meta">
                      {(copy.power_subtitles[section] ?? "").length} / 52
                    </span>
                  </label>
                )}
                <p className="studio-protected">
                  {section === "welcome"
                    ? "The welcome sits above the logo and displays uppercase."
                    : "Edit the subtitle beneath the fixed panel title."}{" "}
                  Panel titles, artwork, colors and destinations are protected.
                  Blank optional text uses the existing wording.
                </p>
              </>
            ) : (
              <>
                {active.fields.map(([key, label, max, multiline]) =>
                  field(key, label, max, Boolean(multiline)),
                )}
                {section === "hero" && (
                  <>
                    {mediaSelect("hero_media_id")}
                    <p className="studio-protected">
                      These fields appear in the Classic hero. Power has its own
                      welcome banner.
                    </p>
                  </>
                )}
                {section === "portfolio" && (
                  <>
                    {[0, 1, 2].map((index) => (
                      <div key={index}>
                        {mediaSelect("gallery_media_ids", index)}
                      </div>
                    ))}
                    <p className="studio-protected">
                      Approved public renditions only. This media-free demo uses
                      generic illustrations; original Drive files stay private.
                    </p>
                  </>
                )}
                {(section === "trust" || section === "planning") && (
                  <div className="studio-protected">
                    <strong>Protected content</strong>
                    <p>
                      There are no copy controls for this section in Site Studio
                      v1. Use Section Visibility and Ordering to show, hide or
                      move it.
                    </p>
                    <button
                      type="button"
                      onClick={() => chooseSection("sections")}
                    >
                      Manage visibility and order
                    </button>
                  </div>
                )}
                {section === "sections" && (
                  <>
                    <p className="studio-protected">
                      Only optional Classic sections can move or hide. Hero,
                      Builder and final call-to-action stay fixed. Power panels
                      are separate.
                    </p>
                    {copy.section_order.map((id, index) => {
                      const label =
                        OPTIONAL_SECTIONS.find(([key]) => key === id)?.[1] ??
                        id;
                      return (
                        <div className="studio-order-row" key={id}>
                          <label>
                            <input
                              type="checkbox"
                              name="visible_sections"
                              value={id}
                              checked={copy.visible_sections.includes(id)}
                              onChange={(e) =>
                                setCopy((c) => ({
                                  ...c,
                                  visible_sections: e.target.checked
                                    ? [...c.visible_sections, id]
                                    : c.visible_sections.filter(
                                        (x) => x !== id,
                                      ),
                                }))
                              }
                            />
                            {label}
                          </label>
                          <button
                            type="button"
                            aria-label={`Move ${label} up`}
                            disabled={!index}
                            onClick={() => move(id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${label} down`}
                            disabled={index === copy.section_order.length - 1}
                            onClick={() => move(id, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
                {section === "cta" && (
                  <p className="studio-protected">
                    The final Classic heading and message are editable. Button
                    labels and navigation destinations are protected.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
        <SiteStudioVisualPreview
          content={previewContent}
          mode={mode}
          section={previewTarget}
          status={status}
          enabled={visualPreviewEnabled}
          url={visualPreviewUrl}
        />
      </div>
      <dialog
        ref={history}
        className="studio-drawer"
        aria-labelledby="studio-history-title"
      >
        <header>
          <div>
            <span className="eyebrow">SAVED VERSIONS</span>
            <h2 id="studio-history-title">Revision history</h2>
          </div>
          <button
            autoFocus
            type="button"
            onClick={() => history.current?.close()}
            aria-label="Close revision history"
          >
            ✕
          </button>
        </header>
        <p>
          Preview a saved version, then deliberately publish or restore it. No
          revisions are deleted.
        </p>
        {dirty && (
          <p className="studio-notice">
            Save your unsaved edits before publishing another revision.
          </p>
        )}
        <ol className="studio-revisions">
          {revisions.map((revision) => (
            <li key={revision.id}>
              <div className="studio-revision-heading">
                <strong>Revision {revision.revision}</strong>
                <span className={`studio-chip studio-chip--${revision.state}`}>
                  {revision.state === "published"
                    ? "Currently published"
                    : revision.state}
                </span>
              </div>
              <time>{formatRevisionTime(revision.created_at)}</time>
              <p>{revision.summary}</p>
              <small>Power: {revision.power || "Welcome To"}</small>
              <div className="studio-revision-actions">
                <a
                  href={`/admin/site-studio?revision=${revision.id}${before ? `&before=${before}` : ""}`}
                >
                  Preview revision {revision.revision}
                </a>
                {revision.state !== "published" && (
                  <button
                    type="button"
                    disabled={dirty}
                    onClick={() => requestPublish(revision)}
                  >
                    {revision.state === "archived" ? "Restore" : "Publish"}{" "}
                    revision {revision.revision}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {hasOlder && (
          <a href={`/admin/site-studio?before=${revisions.at(-1)!.revision}`}>
            Older revisions
          </a>
        )}
        {before && <a href="/admin/site-studio">Newest revisions</a>}
      </dialog>
      <dialog
        ref={confirmation}
        className="studio-confirm"
        aria-labelledby="studio-confirm-title"
      >
        <h2 id="studio-confirm-title">
          {target?.state === "archived" ? "Restore" : "Publish"} revision{" "}
          {target?.revision}?
        </h2>
        <p>
          This replaces{" "}
          {publishedRevision
            ? `public revision ${publishedRevision}`
            : "the static fallback"}{" "}
          on the matching website. It publishes the saved revision only.
          Existing drafts and revision history remain available.
        </p>
        <p className="studio-confirm-summary">
          {target?.summary}
          <br />
          Power: {target?.power || "Welcome To"}
        </p>
        <form
          action={publishAction}
          onSubmit={() => {
            allowNavigation.current = true;
          }}
        >
          <input type="hidden" name="revision_id" value={target?.id ?? ""} />
          <div className="studio-actions">
            <button
              autoFocus
              type="button"
              onClick={() => confirmation.current?.close()}
            >
              Cancel
            </button>
            <ConfirmPublish />
          </div>
        </form>
      </dialog>
      <dialog
        ref={media}
        className="studio-drawer"
        aria-labelledby="studio-media-title"
      >
        <header>
          <h2 id="studio-media-title">Private media review</h2>
          <button
            autoFocus
            type="button"
            onClick={() => media.current?.close()}
            aria-label="Close media review"
          >
            ✕
          </button>
        </header>
        <p>
          Queue existing Drive file references for private review. This does not
          approve, download, share or publish a file.
        </p>
        {mediaPanel}
      </dialog>
    </div>
  );
}
