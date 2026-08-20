"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WeddingResource } from "@/lib/wedding-resources";

type WorksheetValues = Record<string, string | boolean>;
type GuestbookEntry = { id: string; name: string; message: string; createdAt: string };

function storageKey(slug: string) {
  return `eventsible:wedding-resource:${slug}:v1`;
}

export function WeddingResourceWorksheet({ resource }: { resource: WeddingResource }) {
  const [values, setValues] = useState<WorksheetValues>({});
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey(resource.slug));
        if (stored) {
          const parsed = JSON.parse(stored) as { values?: WorksheetValues; guestbookEntries?: GuestbookEntry[]; savedAt?: string };
          setValues(parsed.values ?? {});
          setGuestbookEntries(Array.isArray(parsed.guestbookEntries) ? parsed.guestbookEntries : []);
          setSavedAt(parsed.savedAt ?? null);
        }
      } catch {
        setSavedAt(null);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [resource.slug]);

  function saveDraft(nextValues: WorksheetValues, nextEntries: GuestbookEntry[]) {
    const nextSavedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(storageKey(resource.slug), JSON.stringify({ values: nextValues, guestbookEntries: nextEntries, savedAt: nextSavedAt }));
      setSavedAt(nextSavedAt);
    } catch {
      setSavedAt(null);
    }
  }

  function updateValue(key: string, value: string | boolean) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    saveDraft(nextValues, guestbookEntries);
  }

  function addGuestbookEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    if (!name || !message) return;
    const nextEntries = [
      ...guestbookEntries,
      { id: `${Date.now()}-${guestbookEntries.length}`, name: name.slice(0, 80), message: message.slice(0, 800), createdAt: new Date().toISOString() },
    ];
    setGuestbookEntries(nextEntries);
    saveDraft(values, nextEntries);
    event.currentTarget.reset();
  }

  return (
    <>
      <div className="wedding-resource-controls">
        <div>
          <b>{ready ? "Saved on this device" : "Opening your worksheet"}</b>
          <span>{savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No account or email needed"}</span>
        </div>
        <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
      </div>

      {resource.guestbook ? (
        <GuestbookWorksheet entries={guestbookEntries} onAdd={addGuestbookEntry} />
      ) : (
        <div className="wedding-resource-sheet">
          <header>
            <span>EVENTSIBLE WEDDING HERO</span>
            <h1>{resource.title}</h1>
            <p>{resource.description}</p>
          </header>
          {resource.sections.map((section, sectionIndex) => (
            <section key={section.title}>
              <header>
                <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                <div><h2>{section.title}</h2>{section.description ? <p>{section.description}</p> : null}</div>
              </header>
              {section.tips?.length ? (
                <div className="wedding-resource-tips">
                  <b>Helpful starting points</b>
                  <ul>{section.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                </div>
              ) : null}
              {section.fields?.length ? (
                <div className="wedding-resource-fields">
                  {section.fields.map((field) => field.type === "checklist" ? (
                    <fieldset className="wedding-resource-checklist" key={field.key}>
                      <legend>{field.label}</legend>
                      {(field.options ?? []).map((option, optionIndex) => {
                        const optionKey = `${field.key}:${optionIndex}`;
                        return <label key={option}><input type="checkbox" checked={values[optionKey] === true} onChange={(event) => updateValue(optionKey, event.target.checked)} /> <span>{option}</span></label>;
                      })}
                    </fieldset>
                  ) : (
                    <label className={field.type === "textarea" ? "wide" : ""} key={field.key}>
                      <span>{field.label}</span>
                      {field.type === "textarea" ? (
                        <textarea value={String(values[field.key] ?? "")} placeholder={field.placeholder} onChange={(event) => updateValue(field.key, event.target.value)} />
                      ) : (
                        <input value={String(values[field.key] ?? "")} placeholder={field.placeholder} onChange={(event) => updateValue(field.key, event.target.value)} />
                      )}
                    </label>
                  ))}
                </div>
              ) : null}
              {section.table ? (
                <ResourceTable resourceSlug={resource.slug} table={section.table} values={values} onChange={updateValue} />
              ) : null}
            </section>
          ))}
          <footer><b>Wedding Hero</b><span>Interactive Wedding Companion by EVENTSible</span></footer>
        </div>
      )}
    </>
  );
}

function ResourceTable({ resourceSlug, table, values, onChange }: {
  resourceSlug: string;
  table: NonNullable<WeddingResource["sections"][number]["table"]>;
  values: WorksheetValues;
  onChange: (key: string, value: string) => void;
}) {
  const rowCount = table.rowLabels?.length ?? table.rowCount ?? 10;
  return (
    <div className="wedding-resource-table-wrap">
      <table className="wedding-resource-table">
        <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr key={`${resourceSlug}-${table.key}-${rowIndex}`}>
              {table.columns.map((column, columnIndex) => {
                const valueKey = `${table.key}:${rowIndex}:${columnIndex}`;
                const rowLabel = columnIndex === 0 ? table.rowLabels?.[rowIndex] : null;
                return <td key={column}>{rowLabel ? <b>{rowLabel}</b> : <input aria-label={`${column} row ${rowIndex + 1}`} value={String(values[valueKey] ?? "")} onChange={(event) => onChange(valueKey, event.target.value)} />}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuestbookWorksheet({ entries, onAdd }: { entries: GuestbookEntry[]; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="wedding-resource-sheet wedding-guestbook-sheet">
      <header>
        <span>EVENTSIBLE WEDDING HERO</span>
        <h1>Our Wedding Guestbook</h1>
        <p>Leave a memory, a little advice, or a message for the couple.</p>
      </header>
      <div className="wedding-guestbook-notice">
        <b>Device-based starter</b>
        <p>Messages currently stay on this device and can be printed as a keepsake. A shareable guest link, moderation, and online gallery require the collaboration release and are not active yet.</p>
      </div>
      <form className="wedding-guestbook-form" onSubmit={onAdd}>
        <label><span>Your name</span><input name="name" required maxLength={80} /></label>
        <label><span>Your message</span><textarea name="message" required maxLength={800} /></label>
        <button type="submit">Add to the guestbook</button>
      </form>
      <section className="wedding-guestbook-entries" aria-live="polite">
        <header><span>{String(entries.length).padStart(2, "0")}</span><div><h2>Messages for the couple</h2><p>{entries.length ? "A keepsake in progress." : "The first message is waiting to be written."}</p></div></header>
        <div>
          {entries.map((entry) => (
            <article key={entry.id}><p>{entry.message}</p><b>{entry.name}</b><small>{new Date(entry.createdAt).toLocaleDateString()}</small></article>
          ))}
        </div>
      </section>
      <footer><b>Wedding Hero</b><span>Interactive Wedding Companion by EVENTSible</span></footer>
    </div>
  );
}
