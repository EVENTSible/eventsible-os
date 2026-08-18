"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWeddingSectionAction } from "@/app/client/wedding/actions";
import {
  answerHasValue,
  isQuestionVisible,
  weddingProgress,
  WEDDING_SECTIONS,
} from "@/lib/wedding-companion.mjs";

type WeddingQuestion = {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  helpText?: string | null;
  options?: string[];
  condition?: { answer?: string; equals?: unknown };
};

type WeddingSection = {
  key: string;
  title: string;
  description: string;
  questions: WeddingQuestion[];
};

type Props = {
  eventId: string;
  assignmentId: string;
  initialAnswers: Record<string, unknown>;
  initialProgress: number;
  initialSectionKey?: string | null;
  initialStatus?: string | null;
};

const sections = WEDDING_SECTIONS as WeddingSection[];

function answerText(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

export function WeddingQuestionnaire({
  eventId,
  assignmentId,
  initialAnswers,
  initialProgress,
  initialSectionKey,
  initialStatus,
}: Props) {
  const initialIndex = Math.max(0, sections.findIndex((section) => section.key === initialSectionKey));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [progress, setProgress] = useState(Math.max(initialProgress, weddingProgress(initialAnswers)));
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [message, setMessage] = useState(initialStatus === "submitted" ? "Submitted to EVENTSible" : "All changes saved");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const currentSection = sections[currentIndex];

  const persist = useCallback(async (submit = false, sectionIndex = currentIndex) => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const section = sections[sectionIndex];
    const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.key, answers[question.key] ?? null]));
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(submit ? "Submitting…" : "Saving…");

    const result = await saveWeddingSectionAction({
      eventId,
      assignmentId,
      sectionKey: section.key,
      answers: sectionAnswers,
      submit,
    });

    if (!result.ok) {
      setSaveState("error");
      setMessage(result.message);
      return result;
    }

    setProgress(result.progress ?? weddingProgress(answers));
    setLastSaved(result.savedAt ?? null);
    if (dirtyRef.current) {
      setSaveState("dirty");
      setMessage("Unsaved changes");
      return result;
    }
    setSaveState("saved");
    setMessage(result.message);
    return result;
  }, [answers, assignmentId, currentIndex, eventId]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => void persist(false), 1400);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [answers, persist]);

  const sectionCompletion = useMemo(() => sections.map((section) => {
    const required = section.questions.filter((question) => question.required && isQuestionVisible(question, answers));
    return required.length > 0 && required.every((question) => answerHasValue(answers[question.key]));
  }), [answers]);

  function updateAnswer(key: string, value: unknown) {
    dirtyRef.current = true;
    setSaveState("dirty");
    setMessage("Unsaved changes");
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function move(direction: -1 | 1) {
    if (dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }
    setCurrentIndex((index) => Math.max(0, Math.min(sections.length - 1, index + direction)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const result = await persist(true);
    if (result.ok) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="wedding-workspace">
      <aside className="wedding-sections" aria-label="Wedding Companion sections">
        <div className="wedding-progress-card">
          <span>Planning progress</span>
          <b>{progress}%</b>
          <div className="wedding-progress"><span style={{ width: `${progress}%` }} /></div>
          <small>{message}{lastSaved ? ` · ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</small>
        </div>
        <nav>
          {sections.map((section, index) => (
            <button
              type="button"
              className={index === currentIndex ? "active" : ""}
              key={section.key}
              onClick={async () => {
                if (index === currentIndex) return;
                if (dirtyRef.current) {
                  const result = await persist(false);
                  if (!result.ok) return;
                }
                setCurrentIndex(index);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span>{sectionCompletion[index] ? "✓" : index + 1}</span>
              <div><b>{section.title}</b><small>{sectionCompletion[index] ? "Core details complete" : "Ready when you are"}</small></div>
            </button>
          ))}
        </nav>
      </aside>

      <main className="wedding-form-card">
        <header>
          <span className="eyebrow">Section {currentIndex + 1} of {sections.length}</span>
          <h2>{currentSection.title}</h2>
          <p>{currentSection.description}</p>
        </header>

        <div className="wedding-question-list">
          {currentSection.questions.filter((question) => isQuestionVisible(question, answers)).map((question) => (
            <QuestionField
              key={question.key}
              question={question}
              value={answers[question.key]}
              onChange={(value) => updateAnswer(question.key, value)}
            />
          ))}
        </div>

        {saveState === "error" ? <div className="wedding-save-error">{message}</div> : null}

        <footer className="wedding-form-actions">
          <button type="button" className="secondary-button" disabled={currentIndex === 0 || saveState === "saving"} onClick={() => void move(-1)}>Back</button>
          <button type="button" className="secondary-button" disabled={saveState === "saving"} onClick={() => void persist(false)}>
            {saveState === "saving" ? "Saving…" : "Save for later"}
          </button>
          {currentIndex < sections.length - 1 ? (
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void move(1)}>Save & continue</button>
          ) : (
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void submit()}>Submit to EVENTSible</button>
          )}
        </footer>
      </main>
    </div>
  );
}

function QuestionField({ question, value, onChange }: { question: WeddingQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const id = `wedding-${question.key}`;
  const label = <><span>{question.label}{question.required ? <b className="required-mark"> *</b> : null}</span>{question.helpText ? <small>{question.helpText}</small> : null}</>;

  if (question.fieldType === "yes_no") {
    return (
      <fieldset className="wedding-question yes-no">
        <legend>{label}</legend>
        <div>
          {[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => (
            <button type="button" aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} key={option.label} onClick={() => onChange(option.value)}>{option.label}</button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset className="wedding-question choice-grid">
        <legend>{label}</legend>
        <div>
          {(question.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.fieldType === "single_select") {
    return (
      <label className="wedding-question" htmlFor={id}>
        {label}
        <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose one</option>
          {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (question.fieldType === "long_text" || question.fieldType === "repeater") {
    return (
      <label className="wedding-question" htmlFor={id}>
        {label}
        <textarea
          id={id}
          rows={question.fieldType === "repeater" ? 5 : 4}
          value={answerText(value)}
          onChange={(event) => onChange(question.fieldType === "repeater" ? event.target.value.split("\n") : event.target.value)}
          placeholder={question.fieldType === "repeater" ? "One item per line" : "Share the details here"}
        />
      </label>
    );
  }

  const inputType = question.fieldType === "number" ? "number"
    : question.fieldType === "time" ? "time"
      : question.fieldType === "phone" ? "tel"
        : "text";
  return (
    <label className="wedding-question" htmlFor={id}>
      {label}
      <input
        id={id}
        type={inputType}
        min={inputType === "number" ? 0 : undefined}
        value={answerText(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.fieldType === "song" ? "Song title and artist" : undefined}
      />
    </label>
  );
}
