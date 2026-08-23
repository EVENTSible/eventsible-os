"use client";

type ItemField = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  placeholder?: string;
};

type HelperInfo = {
  title: string;
  body: string;
  expandableTitle?: string;
  items?: string[][];
};

export type StructuredWeddingQuestion = {
  key: string;
  label: string;
  required: boolean;
  fieldType: string;
  helpText?: string | null;
  options?: string[];
  itemFields?: ItemField[];
  fields?: ItemField[];
  legacyField?: string;
  defaultRows?: number;
  starterItems?: string[];
  addLabel?: string;
  helperInfo?: HelperInfo;
  additionalFieldKeys?: string[];
  additionalFieldsLabel?: string;
  condition?: { answer?: string; equals?: unknown; includes?: string; hasValue?: boolean };
};

type Props = {
  question: StructuredWeddingQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  revealAll?: boolean;
};

const STRUCTURED_TYPES = new Set([
  "reorderable_people_list",
  "introduction_list",
  "speaker_list",
  "timeline_list",
  "song_list",
  "song_moment",
  "details_group",
  "sensitive_checklist",
  "service_checklist",
]);

export function isStructuredWeddingField(fieldType: string) {
  return STRUCTURED_TYPES.has(fieldType);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function inputValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function questionLabel(question: StructuredWeddingQuestion, revealAll = false) {
  return <><span>{question.label}{question.required ? <b className="required-mark"> *</b> : null}{revealAll && question.condition?.answer ? <em> If applicable</em> : null}</span>{question.helpText ? <small>{question.helpText}</small> : null}</>;
}

function HelperInfoCard({ info }: { info?: HelperInfo }) {
  if (!info) return null;
  return (
    <details className="wedding-helper-card">
      <summary>{info.title}</summary>
      <p>{info.body}</p>
      {info.expandableTitle && info.items?.length ? (
        <details>
          <summary>{info.expandableTitle}</summary>
          <dl>
            {info.items.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
          </dl>
        </details>
      ) : null}
    </details>
  );
}

function FieldControl({ field, value, onChange, id }: { field: ItemField; value: unknown; onChange: (value: string) => void; id: string }) {
  if (field.type === "select") {
    return (
      <select id={id} value={inputValue(value)} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose one</option>
        {(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") return <textarea id={id} rows={2} value={inputValue(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />;
  const type = ["time", "url", "email", "tel"].includes(field.type ?? "") ? field.type : "text";
  return <input id={id} type={type} value={inputValue(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function listItems(question: StructuredWeddingQuestion, value: unknown) {
  const legacyField = question.legacyField ?? question.itemFields?.[0]?.key ?? "name";
  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(value)) {
    items = value.map((item) => typeof item === "string" ? { [legacyField]: item } : objectValue(item));
  } else if (typeof value === "string" && value.trim()) {
    items = value.split("\n").filter(Boolean).map((item) => ({ [legacyField]: item }));
  }
  if (items.length === 0 && question.defaultRows) items = Array.from({ length: question.defaultRows }, () => ({}));
  return items;
}

function StructuredList({ question, value, onChange, revealAll = false }: Props) {
  const items = listItems(question, value);
  const fields = question.itemFields ?? [];
  const additionalFieldKeys = new Set(question.additionalFieldKeys ?? []);
  const primaryFields = fields.filter((field) => !additionalFieldKeys.has(field.key));
  const additionalFields = fields.filter((field) => additionalFieldKeys.has(field.key));
  const primaryKey = question.legacyField ?? fields[0]?.key ?? "name";

  function updateItem(index: number, key: string, nextValue: string) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: nextValue } : item));
  }

  function addItem(seed: Record<string, unknown> = {}) {
    onChange([...items, seed]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
    onChange(nextItems);
  }

  return (
    <fieldset className="wedding-question wedding-structured-question">
      <legend>{questionLabel(question, revealAll)}</legend>
      <HelperInfoCard info={question.helperInfo} />
      {question.starterItems?.length ? (
        <div className="wedding-starter-moments">
          <b>Common moments</b>
          <div>{question.starterItems.map((starter) => <button type="button" key={starter} onClick={() => addItem({ [primaryKey]: starter })}>+ {starter}</button>)}</div>
        </div>
      ) : null}
      <div className="wedding-module-list">
        {items.map((item, index) => {
          const title = inputValue(item[primaryKey]) || `${question.fieldType === "timeline_list" ? "Moment" : question.fieldType === "speaker_list" ? "Speaker" : "Entry"} ${index + 1}`;
          return (
            <article className="wedding-module" key={`${question.key}-${index}`}>
              <header>
                <span className="wedding-drag-handle" aria-hidden="true">⋮⋮</span>
                <b>{index + 1}. {title}</b>
                <div className="wedding-reorder-actions">
                  <button type="button" title="Move up" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</button>
                  <button type="button" title="Move down" aria-label={`Move ${title} down`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}>↓</button>
                  <button type="button" title="Remove" aria-label={`Remove ${title}`} onClick={() => removeItem(index)}>×</button>
                </div>
              </header>
              <div className="wedding-module-fields">
                {primaryFields.map((field) => {
                  const id = `${question.key}-${index}-${field.key}`;
                  return <label className={field.type === "textarea" ? "wide" : ""} htmlFor={id} key={field.key}><span>{field.label}</span><FieldControl id={id} field={field} value={item[field.key]} onChange={(nextValue) => updateItem(index, field.key, nextValue)} /></label>;
                })}
              </div>
              {additionalFields.length ? (
                <details className="wedding-module-additional" open={additionalFields.some((field) => inputValue(item[field.key]).trim()) || undefined}>
                  <summary>{question.additionalFieldsLabel ?? "Additional details"}{additionalFields.some((field) => inputValue(item[field.key]).trim()) ? " (added)" : ""}</summary>
                  <div className="wedding-module-fields unfolding">
                    {additionalFields.map((field) => {
                      const id = `${question.key}-${index}-${field.key}`;
                      return <label className={field.type === "textarea" ? "wide" : ""} htmlFor={id} key={field.key}><span>{field.label}</span><FieldControl id={id} field={field} value={item[field.key]} onChange={(nextValue) => updateItem(index, field.key, nextValue)} /></label>;
                    })}
                  </div>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
      <button className="wedding-add-module" type="button" onClick={() => addItem()}>+ {question.addLabel ?? "Add another"}</button>
    </fieldset>
  );
}

function SongMoment({ question, value, onChange, revealAll = false }: Props) {
  const song = typeof value === "string" ? { status: "chosen", songTitle: value } : objectValue(value);
  const status = inputValue(song.status);
  const statuses = [{ value: "chosen", label: "Add song" }, { value: "not_sure", label: "Not sure yet" }, { value: "not_doing", label: "Not doing this" }];
  return (
    <fieldset className="wedding-question wedding-song-moment">
      <legend>{questionLabel(question, revealAll)}</legend>
      <div className="wedding-segmented-control">
        {statuses.map((option) => <button type="button" key={option.value} aria-pressed={status === option.value} className={status === option.value ? "selected" : ""} onClick={() => onChange({ ...song, status: option.value })}>{option.label}</button>)}
      </div>
      {revealAll || status === "chosen" ? (
        <div className="wedding-module-fields unfolding">
          {(question.fields ?? []).map((field) => {
            const id = `${question.key}-${field.key}`;
            return <label className={field.type === "textarea" ? "wide" : ""} htmlFor={id} key={field.key}><span>{field.label}</span><FieldControl id={id} field={field} value={song[field.key]} onChange={(nextValue) => onChange({ ...song, [field.key]: nextValue })} /></label>;
          })}
        </div>
      ) : status === "not_sure" ? <p className="wedding-pending-note">Marked for a future planning conversation. Wedding Hero will keep moving.</p> : null}
    </fieldset>
  );
}

function DetailsGroup({ question, value, onChange, revealAll = false }: Props) {
  const details = typeof value === "string" ? { notes: value } : objectValue(value);
  return (
    <fieldset className="wedding-question wedding-structured-question">
      <legend>{questionLabel(question, revealAll)}</legend>
      <div className="wedding-module-fields">
        {(question.fields ?? []).map((field) => {
          const id = `${question.key}-${field.key}`;
          return <label className={field.type === "textarea" ? "wide" : ""} htmlFor={id} key={field.key}><span>{field.label}</span><FieldControl id={id} field={field} value={details[field.key]} onChange={(nextValue) => onChange({ ...details, [field.key]: nextValue })} /></label>;
        })}
      </div>
    </fieldset>
  );
}

function SensitiveChecklist({ question, value, onChange, revealAll = false }: Props) {
  const source = typeof value === "string" ? { items: [], otherNotes: value } : objectValue(value);
  const items = Array.isArray(source.items) ? source.items.map(objectValue) : [];

  function toggle(topic: string) {
    const selected = items.some((item) => item.topic === topic);
    onChange({ ...source, items: selected ? items.filter((item) => item.topic !== topic) : [...items, { topic, notes: "" }] });
  }

  function updateTopicNotes(topic: string, notes: string) {
    const existing = items.some((item) => item.topic === topic);
    onChange({
      ...source,
      items: existing
        ? items.map((item) => item.topic === topic ? { ...item, notes } : item)
        : [...items, { topic, notes }],
    });
  }

  return (
    <fieldset className="wedding-question wedding-sensitive-checklist">
      <legend>{questionLabel(question, revealAll)}</legend>
      <div className="wedding-check-card-grid">
        {(question.options ?? []).map((topic) => {
          const item = items.find((candidate) => candidate.topic === topic);
          return (
            <div className={item ? "selected" : ""} key={topic}>
              <label><input type="checkbox" checked={Boolean(item)} onChange={() => toggle(topic)} /><span>{topic}</span></label>
              {item || revealAll ? <textarea rows={2} value={inputValue(item?.notes)} aria-label={`Notes for ${topic}`} placeholder="What should the team know, if applicable?" onChange={(event) => updateTopicNotes(topic, event.target.value)} /> : null}
            </div>
          );
        })}
      </div>
      <label htmlFor={`${question.key}-other`}><span>Other details</span><textarea id={`${question.key}-other`} rows={3} value={inputValue(source.otherNotes)} onChange={(event) => onChange({ ...source, otherNotes: event.target.value })} /></label>
    </fieldset>
  );
}

function ServiceChecklist({ question, value, onChange, revealAll = false }: Props) {
  const items = Array.isArray(value) ? value.map((item) => typeof item === "string" ? { service: item, status: "booked" } : objectValue(item)) : [];

  function setStatus(service: string, status: string) {
    const existing = items.find((item) => item.service === service);
    if (existing?.status === status) onChange(items.filter((item) => item.service !== service));
    else if (existing) onChange(items.map((item) => item.service === service ? { ...item, status } : item));
    else onChange([...items, { service, status }]);
  }

  function updateService(service: string, key: string, nextValue: string) {
    const existing = items.some((item) => item.service === service);
    onChange(existing
      ? items.map((item) => item.service === service ? { ...item, [key]: nextValue } : item)
      : [...items, { service, status: "considering", [key]: nextValue }]);
  }

  return (
    <fieldset className="wedding-question wedding-service-checklist">
      <legend>{questionLabel(question, revealAll)}</legend>
      <div className="wedding-service-grid">
        {(question.options ?? []).map((service) => {
          const item = items.find((candidate) => candidate.service === service);
          return (
            <article className={item ? "selected" : ""} key={service}>
              <b>{service}</b>
              <div className="wedding-service-status">
                {[{ value: "booked", label: "Booked" }, { value: "considering", label: "Not sure yet" }, { value: "recommendation", label: "Need recommendation" }].map((status) => <button type="button" className={item?.status === status.value ? "selected" : ""} aria-pressed={item?.status === status.value} key={status.value} onClick={() => setStatus(service, status.value)}>{status.label}</button>)}
              </div>
              {item || revealAll ? <div className="wedding-service-details"><label><span>Setup location</span><input value={inputValue(item?.location)} onChange={(event) => updateService(service, "location", event.target.value)} /></label><label><span>Time needed</span><input value={inputValue(item?.time)} onChange={(event) => updateService(service, "time", event.target.value)} /></label><label><span>Notes</span><textarea rows={2} value={inputValue(item?.notes)} onChange={(event) => updateService(service, "notes", event.target.value)} /></label></div> : null}
            </article>
          );
        })}
      </div>
    </fieldset>
  );
}

export function StructuredWeddingField(props: Props) {
  if (["reorderable_people_list", "introduction_list", "speaker_list", "timeline_list", "song_list"].includes(props.question.fieldType)) return <StructuredList {...props} />;
  if (props.question.fieldType === "song_moment") return <SongMoment {...props} />;
  if (props.question.fieldType === "details_group") return <DetailsGroup {...props} />;
  if (props.question.fieldType === "sensitive_checklist") return <SensitiveChecklist {...props} />;
  if (props.question.fieldType === "service_checklist") return <ServiceChecklist {...props} />;
  return null;
}
